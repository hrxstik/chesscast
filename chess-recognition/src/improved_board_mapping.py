"""
Улучшенный маппинг шахматной доски - экспорт функций из notebook
"""
import cv2
import numpy as np
import json
import os
import sys
from pathlib import Path
from typing import Tuple, List, Optional, Dict
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist
from datetime import datetime
from model.yolo11_detector import YOLO11Detector

# Параметры маппинга
OUTPUT_IMAGE_SIZE = (640, 640)
MIN_BOARD_AREA_RATIO = 0.1
MAX_BOARD_AREA_RATIO = 0.9
SQUARE_COUNT = 8
ADAPTIVE_THRESH_BLOCK_SIZE = 11
ADAPTIVE_THRESH_C = 2
CANNY_LOW_THRESHOLD = 50
CANNY_HIGH_THRESHOLD = 150


def order_points_clockwise(pts: np.ndarray) -> np.ndarray:
    """Упорядочивание точек по часовой стрелке"""
    x_sorted = pts[np.argsort(pts[:, 0]), :]
    left_most = x_sorted[:2, :]
    right_most = x_sorted[2:, :]
    left_most = left_most[np.argsort(left_most[:, 1]), :]
    top_left, bottom_left = left_most
    right_most = right_most[np.argsort(right_most[:, 1]), :]
    top_right, bottom_right = right_most
    return np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.float32)


def calculate_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Вычисление евклидова расстояния"""
    return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)


def perspective_transform(image: np.ndarray, corners: np.ndarray, output_size: Tuple[int, int]):
    """Применение перспективного преобразования"""
    ordered_corners = order_points_clockwise(corners)
    width_A = calculate_distance(ordered_corners[0], ordered_corners[1])
    width_B = calculate_distance(ordered_corners[2], ordered_corners[3])
    max_width = max(int(width_A), int(width_B))
    height_A = calculate_distance(ordered_corners[0], ordered_corners[3])
    height_B = calculate_distance(ordered_corners[1], ordered_corners[2])
    max_height = max(int(height_A), int(height_B))
    
    if output_size:
        dst_width, dst_height = output_size
    else:
        dst_width, dst_height = max_width, max_height
    
    dst_points = np.array([
        [0, 0],
        [dst_width - 1, 0],
        [dst_width - 1, dst_height - 1],
        [0, dst_height - 1]
    ], dtype=np.float32)
    
    M = cv2.getPerspectiveTransform(ordered_corners, dst_points)
    warped = cv2.warpPerspective(image, M, (dst_width, dst_height))
    
    return warped, M


def detect_board_boundaries(image: np.ndarray, 
                           min_area_ratio: float = MIN_BOARD_AREA_RATIO,
                           max_area_ratio: float = MAX_BOARD_AREA_RATIO) -> Optional[np.ndarray]:
    """
    Улучшенное определение границ доски
    
    Args:
        image: Входное изображение
        min_area_ratio: Минимальная площадь доски относительно изображения
        max_area_ratio: Максимальная площадь доски относительно изображения
    
    Returns:
        Массив из 4 углов доски (4, 2) или None
    """
    h, w = image.shape[:2]
    total_area = h * w
    min_area = total_area * min_area_ratio
    max_area = total_area * max_area_ratio
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    adaptive_thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, ADAPTIVE_THRESH_BLOCK_SIZE, ADAPTIVE_THRESH_C
    )
    
    thresh_inv = cv2.bitwise_not(adaptive_thresh)
    kernel = np.ones((3, 3), np.uint8)
    thresh_morph = cv2.morphologyEx(thresh_inv, cv2.MORPH_CLOSE, kernel, iterations=2)
    thresh_morph = cv2.morphologyEx(thresh_morph, cv2.MORPH_OPEN, kernel, iterations=1)
    
    contours, _ = cv2.findContours(thresh_morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    valid_contours = [c for c in contours if min_area <= cv2.contourArea(c) <= max_area]
    
    if not valid_contours:
        return detect_board_by_lines(image, min_area, max_area)
    
    valid_contours = sorted(valid_contours, key=cv2.contourArea, reverse=True)
    
    for contour in valid_contours[:5]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if min_area <= area <= max_area:
                corners = approx.reshape(4, 2)
                width = max(calculate_distance(corners[0], corners[1]), 
                           calculate_distance(corners[2], corners[3]))
                height = max(calculate_distance(corners[0], corners[3]), 
                            calculate_distance(corners[1], corners[2]))
                aspect_ratio = max(width, height) / min(width, height)
                
                if 0.7 <= aspect_ratio <= 1.3:
                    return corners.astype(np.float32)
    
    return detect_board_by_lines(image, min_area, max_area)


def detect_board_by_lines(image: np.ndarray, min_area: float, max_area: float) -> Optional[np.ndarray]:
    """Определение границ доски через поиск линий"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, CANNY_LOW_THRESHOLD, CANNY_HIGH_THRESHOLD)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=3)
    
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, 
                            minLineLength=min(image.shape[:2])//4, 
                            maxLineGap=50)
    
    if lines is None or len(lines) < 4:
        return None
    
    h_lines = []
    v_lines = []
    
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
        
        if abs(angle) < 45 or abs(angle) > 135:
            h_lines.append((x1, y1, x2, y2))
        else:
            v_lines.append((x1, y1, x2, y2))
    
    if len(h_lines) < 2 or len(v_lines) < 2:
        return None
    
    all_points = []
    for line in h_lines + v_lines:
        all_points.append((line[0], line[1]))
        all_points.append((line[2], line[3]))
    
    all_points = np.array(all_points)
    hull = cv2.convexHull(all_points)
    
    if len(hull) < 4:
        return None
    
    peri = cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
    
    if len(approx) == 4:
        area = cv2.contourArea(approx)
        if min_area <= area <= max_area:
            return approx.reshape(4, 2).astype(np.float32)
    
    return None


def cluster_lines(lines: List[Tuple[float, float]], target_count: int) -> List[Tuple[float, float]]:
    """
    Улучшенная кластеризация линий с использованием адаптивного порога.
    """
    if len(lines) <= target_count:
        return lines
    
    if not lines:
        return []
    
    # Сортируем линии по rho
    lines = sorted(lines, key=lambda x: x[0])
    
    # Адаптивный порог кластеризации на основе диапазона значений
    if len(lines) > 1:
        rho_range = lines[-1][0] - lines[0][0]
        cluster_threshold = max(rho_range / (target_count * 2), 10)  # Адаптивный порог
    else:
        cluster_threshold = 10
    
    clusters = []
    current_cluster = [lines[0]]
    
    for line in lines[1:]:
        # Проверяем, близка ли линия к текущему кластеру
        if abs(line[0] - current_cluster[-1][0]) < cluster_threshold:
            current_cluster.append(line)
        else:
            # Завершаем текущий кластер
            avg_rho = np.mean([l[0] for l in current_cluster])
            avg_theta = np.mean([l[1] for l in current_cluster])
            clusters.append((avg_rho, avg_theta))
            current_cluster = [line]
    
    # Добавляем последний кластер
    if current_cluster:
        avg_rho = np.mean([l[0] for l in current_cluster])
        avg_theta = np.mean([l[1] for l in current_cluster])
        clusters.append((avg_rho, avg_theta))
    
    # Если кластеров больше, чем нужно, выбираем равномерно распределенные
    if len(clusters) > target_count:
        # Используем более умный выбор - берем кластеры, которые равномерно распределены
        indices = np.linspace(0, len(clusters) - 1, target_count, dtype=int)
        clusters = [clusters[i] for i in indices]
    elif len(clusters) < target_count:
        # Если кластеров меньше, чем нужно, это проблема - возвращаем None будет обработано выше
        pass
    
    return clusters


def cluster_intersection_points(points: np.ndarray, grid_size: int) -> np.ndarray:
    """Кластеризация точек пересечения"""
    if len(points) <= grid_size ** 2:
        return points
    
    distances = pdist(points)
    linkage_matrix = linkage(distances, method='ward')
    cluster_labels = fcluster(linkage_matrix, grid_size ** 2, criterion='maxclust')
    
    clustered_points = []
    for i in range(1, grid_size ** 2 + 1):
        cluster_points = points[cluster_labels == i]
        if len(cluster_points) > 0:
            centroid = np.mean(cluster_points, axis=0)
            clustered_points.append(centroid)
    
    return np.array(clustered_points)


def sort_points_to_matrix(points: np.ndarray, grid_size: int) -> np.ndarray:
    """Сортировка точек в матрицу"""
    y_sorted = points[np.argsort(points[:, 1])]
    matrix = []
    for i in range(grid_size):
        row_start = i * grid_size
        row_end = (i + 1) * grid_size
        row_points = y_sorted[row_start:row_end]
        row_points = row_points[np.argsort(row_points[:, 0])]
        matrix.append(row_points)
    return np.array(matrix)


def detect_square_corners(warped_image: np.ndarray, square_count: int = SQUARE_COUNT) -> Optional[np.ndarray]:
    """
    Определение углов клеток доски через детекцию линий.
    Использует несколько методов для повышения надежности.
    Работает даже когда на доске есть фигуры.
    """
    gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY) if len(warped_image.shape) == 3 else warped_image
    h, w = gray.shape
    
    # Метод 1: Адаптивная пороговая обработка для выделения клеток
    # Это помогает выделить границы клеток даже при наличии фигур
    adaptive_thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # Инвертируем для лучшей детекции линий
    adaptive_thresh = cv2.bitwise_not(adaptive_thresh)
    
    # Метод 2: Морфологические операции для выделения линий
    kernel_h = np.ones((1, int(w * 0.1)), np.uint8)  # Горизонтальный kernel для горизонтальных линий
    kernel_v = np.ones((int(h * 0.1), 1), np.uint8)  # Вертикальный kernel для вертикальных линий
    
    # Выделяем горизонтальные линии
    horizontal_lines = cv2.morphologyEx(adaptive_thresh, cv2.MORPH_OPEN, kernel_h, iterations=2)
    horizontal_lines = cv2.dilate(horizontal_lines, kernel_h, iterations=1)
    
    # Выделяем вертикальные линии
    vertical_lines = cv2.morphologyEx(adaptive_thresh, cv2.MORPH_OPEN, kernel_v, iterations=2)
    vertical_lines = cv2.dilate(vertical_lines, kernel_v, iterations=1)
    
    # Объединяем линии
    lines_image = cv2.bitwise_or(horizontal_lines, vertical_lines)
    
    # Метод 3: Canny для дополнительной детекции краев
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)
    
    # Объединяем результаты
    combined = cv2.bitwise_or(lines_image, edges)
    
    all_h_lines = []
    all_v_lines = []
    
    # Используем HoughLinesP для более точной детекции
    min_line_length = int(min(h, w) * 0.15)
    max_line_gap = int(min(h, w) * 0.05)
    threshold = int(min(h, w) * 0.2)
    
    lines_p = cv2.HoughLinesP(combined, 1, np.pi/180, threshold=threshold,
                               minLineLength=min_line_length, maxLineGap=max_line_gap)
    
    if lines_p is not None:
        for line in lines_p:
            x1, y1, x2, y2 = line[0]
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            
            # Определяем направление линии
            if dx < dy * 0.5:  # Вертикальная линия
                x_center = (x1 + x2) / 2
                all_v_lines.append((x_center, np.pi/2))
            elif dy < dx * 0.5:  # Горизонтальная линия
                y_center = (y1 + y2) / 2
                all_h_lines.append((y_center, 0))
    
    # Также пробуем классический HoughLines на объединенном изображении
    lines = cv2.HoughLines(combined, 1, np.pi/180, threshold=threshold)
    if lines is not None:
    for rho, theta in lines[:, 0]:
            # Нормализуем theta
            if theta > np.pi/2:
                theta -= np.pi
            if abs(theta) < np.pi/6:  # Горизонтальная (около 0)
                all_h_lines.append((rho, theta))
            elif abs(theta) > np.pi/3:  # Вертикальная (около pi/2)
                all_v_lines.append((rho, np.pi/2))
    
    if len(all_h_lines) < square_count + 1 or len(all_v_lines) < square_count + 1:
        return None
    
    # Кластеризуем линии
    h_lines = cluster_lines(all_h_lines, square_count + 1)
    v_lines = cluster_lines(all_v_lines, square_count + 1)
    
    if len(h_lines) < square_count + 1 or len(v_lines) < square_count + 1:
        return None
    
    # Вычисляем пересечения
    intersections = []
    for h_rho, h_theta in h_lines:
        for v_rho, v_theta in v_lines:
            # Преобразуем в нормальную форму линии
            if abs(h_theta) < 0.1:  # Горизонтальная: y = h_rho
                y = h_rho
                x = v_rho
            elif abs(v_theta - np.pi/2) < 0.1:  # Вертикальная: x = v_rho
                x = v_rho
                y = h_rho
            else:
                # Общий случай через решение системы
            A = np.array([
                [np.cos(h_theta), np.sin(h_theta)],
                [np.cos(v_theta), np.sin(v_theta)]
            ])
            b = np.array([h_rho, v_rho])
            try:
                point = np.linalg.solve(A, b)
                    x, y = point[0], point[1]
            except np.linalg.LinAlgError:
                continue
            
            if 0 <= x < w and 0 <= y < h:
                intersections.append([x, y])
    
    if len(intersections) < (square_count + 1) ** 2:
        return None
    
    intersections = np.array(intersections, dtype=np.float32)
    clustered = cluster_intersection_points(intersections, square_count + 1)
    matrix = sort_points_to_matrix(clustered, square_count + 1)
    
    return matrix


def is_board_empty(warped_image: np.ndarray, square_corners: np.ndarray, 
                   threshold: float = 0.15) -> Tuple[bool, float]:
    """Проверка, пуста ли доска"""
    gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY) if len(warped_image.shape) == 3 else warped_image
    square_variations = []
    
    for i in range(SQUARE_COUNT):
        for j in range(SQUARE_COUNT):
            pt1 = square_corners[i, j].astype(int)
            pt2 = square_corners[i, j + 1].astype(int)
            pt3 = square_corners[i + 1, j + 1].astype(int)
            pt4 = square_corners[i + 1, j].astype(int)
            
            mask = np.zeros(gray.shape, dtype=np.uint8)
            pts = np.array([pt1, pt2, pt3, pt4], dtype=np.int32)
            cv2.fillPoly(mask, [pts], 255)
            
            square_pixels = gray[mask > 0]
            
            if len(square_pixels) > 0:
                std = np.std(square_pixels)
                mean = np.mean(square_pixels)
                variation = std / (mean + 1e-5)
                square_variations.append(variation)
    
    if not square_variations:
        return False, 0.0
    
    avg_variation = np.mean(square_variations)
    is_empty = avg_variation < threshold
    confidence = 1.0 - min(avg_variation / threshold, 1.0)
    
    return is_empty, confidence


def _default_model_path() -> str:
    """
    Определение пути к модели фигур по умолчанию.
    Предполагаем, что bestmerged.pt лежит в корне проекта chess-recognition.
    """
    # src/improved_board_mapping.py -> chess-recognition/
    project_root = Path(__file__).resolve().parent.parent
    model_path = project_root / 'bestmerged.pt'
    return str(model_path)


def _generate_uniform_square_grid(warped_image: np.ndarray,
                                  square_count: int = SQUARE_COUNT) -> np.ndarray:
    """
    Генерация равномерной сетки углов клеток на выровненном изображении.
    
    Возвращает матрицу (square_count+1) x (square_count+1) x 2
    с координатами углов в пикселях warped_image.
    """
    h, w = warped_image.shape[:2]
    step_x = w / square_count
    step_y = h / square_count
    
    grid = np.zeros((square_count + 1, square_count + 1, 2), dtype=np.float32)
    for i in range(square_count + 1):
        for j in range(square_count + 1):
            x = j * step_x
            y = i * step_y
            grid[i, j] = [x, y]
    return grid


def _detect_border_size(warped_image: np.ndarray) -> Tuple[int, int]:
    """
    Автоматическое определение размера полей доски через анализ краев изображения.
    
    Анализирует края изображения, чтобы найти, где начинается игровое поле.
    """
    h, w = warped_image.shape[:2]
    gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY) if len(warped_image.shape) == 3 else warped_image
    
    # Анализируем вертикальные края (левая и правая стороны)
    left_edge = gray[:, :w//10]  # Левая 10% изображения
    right_edge = gray[:, -w//10:]  # Правая 10% изображения
    
    # Анализируем горизонтальные края (верх и низ)
    top_edge = gray[:h//10, :]  # Верхние 10% изображения
    bottom_edge = gray[-h//10:, :]  # Нижние 10% изображения
    
    # Находим градиенты для определения границы поля
    # Поля обычно имеют более однородный цвет, чем клетки
    def find_border_in_edge(edge, is_horizontal=True):
        if is_horizontal:
            # Для горизонтальных краев анализируем по вертикали
            edge_mean = np.mean(edge, axis=1)
            edge_std = np.std(edge_mean)
            # Ищем место, где вариация резко увеличивается (начало клеток)
            if edge_std > 5:
                gradient = np.gradient(edge_mean)
                threshold = np.max(np.abs(gradient)) * 0.3
                for i in range(len(gradient)):
                    if abs(gradient[i]) > threshold:
                        return i
        else:
            # Для вертикальных краев анализируем по горизонтали
            edge_mean = np.mean(edge, axis=0)
            edge_std = np.std(edge_mean)
            if edge_std > 5:
                gradient = np.gradient(edge_mean)
                threshold = np.max(np.abs(gradient)) * 0.3
                for i in range(len(gradient)):
                    if abs(gradient[i]) > threshold:
                        return i
        return None
    
    border_y_top = find_border_in_edge(top_edge, is_horizontal=True)
    border_y_bottom = find_border_in_edge(bottom_edge, is_horizontal=True)
    border_x_left = find_border_in_edge(left_edge, is_horizontal=False)
    border_x_right = find_border_in_edge(right_edge, is_horizontal=False)
    
    # Используем найденные значения или значения по умолчанию
    border_x = border_x_left if border_x_left is not None else int(w * 0.05)
    border_y = border_y_top if border_y_top is not None else int(h * 0.05)
    
    # Ограничиваем максимальный размер полей (не более 15% от размера)
    border_x = min(border_x, int(w * 0.15))
    border_y = min(border_y, int(h * 0.15))
    
    return border_x, border_y


def _generate_smart_square_grid(warped_image: np.ndarray,
                                square_count: int = SQUARE_COUNT,
                                border_ratio: Optional[float] = None,
                                skip_line_detection: bool = False) -> np.ndarray:
    """
    Генерация сетки клеток с учетом полей доски (рамки вокруг игрового поля).
    
    Сначала пытается найти реальные границы клеток через детекцию линий (если не пропущено).
    Если не получается, использует умное деление с учетом полей доски (border-aware grid).
    
    Args:
        warped_image: Выровненное изображение доски
        square_count: Количество клеток (8 для стандартной доски)
        border_ratio: Отношение размера поля к размеру изображения (None = автоопределение)
        skip_line_detection: Если True, пропускает попытку детекции линий и сразу использует border-aware grid
    
    Returns:
        Матрица (square_count+1) x (square_count+1) x 2 с координатами углов
    """
    h, w = warped_image.shape[:2]
    
    # Сначала пытаемся найти реальные границы клеток через детекцию линий (если не пропущено)
    if not skip_line_detection:
        detected_grid = detect_square_corners(warped_image, square_count)
        if detected_grid is not None:
            return detected_grid
    
    # Если не получилось найти линии (или пропущено), используем умное деление с учетом полей
    if border_ratio is None:
        # Автоматически определяем размер полей
        border_x, border_y = _detect_border_size(warped_image)
    else:
        # Используем заданный коэффициент
        border_x = int(w * border_ratio)
        border_y = int(h * border_ratio)
    
    # Игровое поле начинается после полей
    play_area_x = w - 2 * border_x
    play_area_y = h - 2 * border_y
    
    # Размер одной клетки в игровой области
    cell_width = play_area_x / square_count
    cell_height = play_area_y / square_count
    
    grid = np.zeros((square_count + 1, square_count + 1, 2), dtype=np.float32)
    for i in range(square_count + 1):
        for j in range(square_count + 1):
            # Координаты с учетом полей
            x = border_x + j * cell_width
            y = border_y + i * cell_height
            grid[i, j] = [x, y]
    
    return grid


def _detect_board_from_contours(image: np.ndarray,
                                min_area_ratio: float = 0.15,
                                max_area_ratio: float = 0.85) -> Optional[np.ndarray]:
    """
    Определение границ доски через детекцию контуров (для пустой доски).
    
    Ищет большой прямоугольный контур, который может быть доской.
    Работает лучше всего на пустой доске с хорошим контрастом.
    
    Args:
        image: Исходное изображение доски
        min_area_ratio: Минимальная доля площади контура от площади изображения
        max_area_ratio: Максимальная доля площади контура от площади изображения
    
    Returns:
        Массив углов доски (4, 2) или None, если контур не найден
    """
    h, w = image.shape[:2]
    image_area = h * w
    min_area = image_area * min_area_ratio
    max_area = image_area * max_area_ratio
    
    # Преобразуем в grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Применяем размытие для уменьшения шума
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Адаптивная пороговая обработка для выделения доски
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # Также пробуем Canny edge detection
    edges = cv2.Canny(blurred, 50, 150)
    
    # Объединяем результаты - используем оба метода
    # Пробуем сначала adaptive threshold, если не найдем - используем edges
    contours_thresh, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_edges, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Объединяем контуры из обоих методов
    contours = list(contours_thresh) + list(contours_edges)
    
    if not contours:
        print("[CONTOURS] No contours found", file=sys.stderr, flush=True)
        return None
    
    # Ищем контур, который похож на прямоугольник и имеет подходящий размер
    best_contour = None
    best_score = 0.0
    
    for contour in contours:
        area = cv2.contourArea(contour)
        
        # Проверяем размер
        if area < min_area or area > max_area:
            continue
        
        # Аппроксимируем контур полигоном
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Ищем контур с 4 углами (прямоугольник)
        if len(approx) == 4:
            # Вычисляем "прямоугольность" - насколько контур похож на прямоугольник
            rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rect)
            box_area = cv2.contourArea(box)
            
            # Отношение площади контура к площади минимального прямоугольника
            # Для идеального прямоугольника это будет близко к 1.0
            rect_score = area / (box_area + 1e-5)
            
            # Комбинированный score: прямоугольность + размер
            score = rect_score * (area / image_area)
            
            if score > best_score:
                best_score = score
                best_contour = approx
    
    # Понижаем порог для более мягкой детекции
    if best_contour is None or best_score < 0.01:
        print(f"[CONTOURS] No suitable rectangular contour found (best_score={best_score:.3f}), trying fallback", file=sys.stderr, flush=True)
        # Пробуем найти хотя бы самый большой контур с 4 углами, даже если score низкий
        if best_contour is None:
            # Ищем любой контур с 4 углами, сортируем по площади
            candidate_contours = []
            for contour in contours:
                area = cv2.contourArea(contour)
                if area < min_area * 0.3 or area > max_area * 2.0:
                    continue
                epsilon = 0.05 * cv2.arcLength(contour, True)  # Более мягкая аппроксимация
                approx = cv2.approxPolyDP(contour, epsilon, True)
                if len(approx) == 4:
                    candidate_contours.append((area, approx))
            
            if candidate_contours:
                # Берем самый большой контур
                candidate_contours.sort(reverse=True, key=lambda x: x[0])
                best_contour = candidate_contours[0][1]
                print(f"[CONTOURS] Using fallback contour with area={candidate_contours[0][0]:.0f}", file=sys.stderr, flush=True)
        
        if best_contour is None:
            return None
    
    # Преобразуем контур в массив углов
    corners = best_contour.reshape(4, 2).astype(np.float32)
    
    # Сортируем углы в порядке: TL, TR, BR, BL
    # Находим центр
    center = corners.mean(axis=0)
    
    # Определяем, какой угол где
    sums = corners.sum(axis=1)
    diffs = np.diff(corners, axis=1).flatten()
    
    top_left_idx = np.argmin(sums)
    bottom_right_idx = np.argmax(sums)
    
    # Остальные два угла
    other_indices = [i for i in range(4) if i != top_left_idx and i != bottom_right_idx]
    if diffs[other_indices[0]] < diffs[other_indices[1]]:
        top_right_idx = other_indices[0]
        bottom_left_idx = other_indices[1]
    else:
        top_right_idx = other_indices[1]
        bottom_left_idx = other_indices[0]
    
    # Упорядочиваем углы: TL, TR, BR, BL
    ordered_corners = np.array([
        corners[top_left_idx],
        corners[top_right_idx],
        corners[bottom_right_idx],
        corners[bottom_left_idx]
    ], dtype=np.float32)
    
    print(f"[CONTOURS] Found board contour with score={best_score:.3f}", file=sys.stderr, flush=True)
    return ordered_corners


def _detect_board_edges_by_lines(image: np.ndarray) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """
    Поиск направляющих линий (грани доски) для уточнения перспективы.
    
    Ищет длинные горизонтальные и вертикальные линии, которые могут быть гранями доски.
    
    Returns:
        Tuple[horizontal_lines, vertical_lines] или None
        Каждая линия представлена как (rho, theta) для HoughLines
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    h, w = gray.shape
    
    # Размытие для уменьшения шума
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny edge detection
    edges = cv2.Canny(blurred, 50, 150)
    
    # Морфологические операции для соединения разрывов в линиях
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=3)
    
    # HoughLines для поиска длинных линий
    min_line_length = int(min(h, w) * 0.3)  # Минимум 30% от размера изображения
    threshold = int(min(h, w) * 0.15)
    
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=threshold)
    
    if lines is None or len(lines) == 0:
        return None
    
    horizontal_lines = []
    vertical_lines = []
    
    for line in lines:
        rho, theta = line[0]
        
        # Нормализуем theta
        if theta > np.pi/2:
            theta -= np.pi
        
        # Классифицируем линии
        if abs(theta) < np.pi/12:  # Горизонтальная (около 0, ±15 градусов)
            horizontal_lines.append((rho, theta))
        elif abs(theta - np.pi/2) < np.pi/12 or abs(theta + np.pi/2) < np.pi/12:  # Вертикальная (около ±90 градусов)
            vertical_lines.append((rho, np.pi/2))
    
    if len(horizontal_lines) < 2 or len(vertical_lines) < 2:
        return None
    
    # Кластеризуем линии, чтобы найти основные направления
    h_clustered = cluster_lines(horizontal_lines, 2)  # Нужны 2 линии (верх и низ)
    v_clustered = cluster_lines(vertical_lines, 2)  # Нужны 2 линии (лево и право)
    
    if len(h_clustered) < 2 or len(v_clustered) < 2:
        return None
    
    return (np.array(h_clustered), np.array(v_clustered))


def _refine_board_corners_with_lines(image: np.ndarray, 
                                     initial_corners: np.ndarray,
                                     lines_result: Optional[Tuple[np.ndarray, np.ndarray]]) -> np.ndarray:
    """
    Уточнение углов доски с использованием направляющих линий.
    
    Комбинирует детекцию по фигурам с детекцией по линиям для более точного определения границ.
    Использует консервативный подход - только слегка корректирует углы, если линии найдены.
    
    Args:
        image: Исходное изображение
        initial_corners: Углы, определенные по фигурам (4, 2)
        lines_result: Результат поиска линий (horizontal_lines, vertical_lines) или None
    
    Returns:
        Уточненные углы доски (4, 2)
    """
    if lines_result is None:
        return initial_corners
    
    h_lines, v_lines = lines_result
    h, w = image.shape[:2]
    
    # Вычисляем пересечения линий для определения границ
    def line_intersection(line1, line2):
        """Находит пересечение двух линий в нормальной форме (rho, theta)"""
        rho1, theta1 = line1
        rho2, theta2 = line2
        
        # Преобразуем в декартовы координаты
        # x*cos(theta) + y*sin(theta) = rho
        A = np.array([
            [np.cos(theta1), np.sin(theta1)],
            [np.cos(theta2), np.sin(theta2)]
        ])
        b = np.array([rho1, rho2])
        
        try:
            point = np.linalg.solve(A, b)
            # Проверяем, что точка внутри изображения
            if 0 <= point[0] < w and 0 <= point[1] < h:
                return point
            return None
        except np.linalg.LinAlgError:
            return None
    
    # Находим крайние линии по их положению в пространстве изображения
    # Для горизонтальных линий: находим верхнюю и нижнюю по y-координате пересечения с краями
    # Для вертикальных линий: находим левую и правую по x-координате пересечения с краями
    
    h_y_positions = []
    for line in h_lines:
        rho, theta = line
        # Находим y-координату в центре изображения (x = w/2)
        # x*cos(theta) + y*sin(theta) = rho
        # y = (rho - x*cos(theta)) / sin(theta)
        if abs(np.sin(theta)) > 0.1:  # Избегаем деления на ноль
            y_center = (rho - (w/2) * np.cos(theta)) / np.sin(theta)
            h_y_positions.append((y_center, line))
    
    v_x_positions = []
    for line in v_lines:
        rho, theta = line
        # Находим x-координату в центре изображения (y = h/2)
        # x*cos(theta) + y*sin(theta) = rho
        # x = (rho - y*sin(theta)) / cos(theta)
        if abs(np.cos(theta)) > 0.1:  # Избегаем деления на ноль
            x_center = (rho - (h/2) * np.sin(theta)) / np.cos(theta)
            v_x_positions.append((x_center, line))
    
    if len(h_y_positions) < 2 or len(v_x_positions) < 2:
        # Недостаточно линий - используем начальные углы
        return initial_corners
    
    # Сортируем по позиции и берем крайние
    h_y_positions.sort(key=lambda x: x[0])
    v_x_positions.sort(key=lambda x: x[0])
    
    h_top_line = h_y_positions[0][1]  # Верхняя (минимальный y)
    h_bottom_line = h_y_positions[-1][1]  # Нижняя (максимальный y)
    v_left_line = v_x_positions[0][1]  # Левая (минимальный x)
    v_right_line = v_x_positions[-1][1]  # Правая (максимальный x)
    
    # Находим 4 угла через пересечения крайних линий
    tl = line_intersection(h_top_line, v_left_line)
    tr = line_intersection(h_top_line, v_right_line)
    br = line_intersection(h_bottom_line, v_right_line)
    bl = line_intersection(h_bottom_line, v_left_line)
    
    if all(p is not None for p in [tl, tr, br, bl]):
        # Все пересечения найдены - используем их, но консервативно
        refined_corners = np.array([tl, tr, br, bl], dtype=np.float32)
        
        # Проверяем, что уточненные углы не слишком далеко от начальных
        # Если расстояние больше 20% от размера изображения - не используем уточнение
        max_distance = 0.2 * max(h, w)
        max_diff = 0.0
        for i in range(4):
            diff = np.linalg.norm(refined_corners[i] - initial_corners[i])
            max_diff = max(max_diff, diff)
        
        if max_diff > max_distance:
            # Уточнение слишком большое - используем начальные углы
            print(f"[MAPPING] Line refinement too large (max_diff={max_diff:.1f} > {max_distance:.1f}), using piece-based corners", file=sys.stderr, flush=True)
            return initial_corners
        
        # Комбинируем с начальными углами (консервативно: 30% веса для линий, 70% для фигур)
        combined = 0.3 * refined_corners + 0.7 * initial_corners
        print(f"[MAPPING] Refined corners with lines (max_diff={max_diff:.1f})", file=sys.stderr, flush=True)
        return combined.astype(np.float32)
    else:
        # Не все пересечения найдены - используем начальные углы
        print("[MAPPING] Not all line intersections found, using piece-based corners", file=sys.stderr, flush=True)
        return initial_corners


def _detect_board_from_pieces(image: np.ndarray,
                              model_path: Optional[str] = None,
                              conf_threshold: float = 0.5,
                              min_pieces: int = 8,
                              min_span_ratio: float = 0.3) -> Optional[np.ndarray]:
    """
    Определение границ доски по детекциям фигур с помощью YOLO.
    
    Используем PCA по центрам фигур, чтобы найти ориентацию доски.
    Затем строим прямоугольник в пространстве (s, t), охватывающий фигуры
    с запасом, и преобразуем его обратно в координаты изображения.
    
    Возвращает массив углов доски (4, 2) или None, если данных недостаточно.
    """
    if model_path is None:
        model_path = _default_model_path()
    
    # Детектим фигуры
    detector = YOLO11Detector(model_path, conf_threshold=conf_threshold)
    detections = detector.predict(image)
    
    # Собираем центры фигур
    centers = []
    for _, bbox, conf, _ in detections:
        if conf < conf_threshold:
            continue
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        centers.append([cx, cy])
    
    if len(centers) < min_pieces:
        return None
    
    centers = np.array(centers, dtype=np.float32)
    mean = centers.mean(axis=0)
    X = centers - mean  # (N, 2)
    
    # PCA через SVD
    try:
        _, _, Vt = np.linalg.svd(X, full_matrices=False)
    except np.linalg.LinAlgError:
        return None
    
    axis_x = Vt[0]  # основное направление
    axis_y = Vt[1]  # перпендикулярное направление
    
    # Координаты в системе (s, t)
    s = X @ axis_x
    t = X @ axis_y
    
    s_min, s_max = float(s.min()), float(s.max())
    t_min, t_max = float(t.min()), float(t.max())
    s_span = s_max - s_min
    t_span = t_max - t_min
    
    h, w = image.shape[:2]
    max_dim = max(h, w)
    
    # Если фигуры слишком скучены в центре, не рискуем строить доску
    if s_span < min_span_ratio * max_dim or t_span < min_span_ratio * max_dim:
        return None
    
    # Адаптивный margin: чем меньше фигур, тем больше margin
    # Это помогает покрыть всю доску когда фигур мало
    num_pieces = len(centers)
    if num_pieces <= 4:
        margin_factor = 0.25
    elif num_pieces <= 8:
        margin_factor = 0.15
    else:
        margin_factor = 0.10
    
    margin_s = s_span * margin_factor
    margin_t = t_span * margin_factor
    
    board_s_min = s_min - margin_s
    board_s_max = s_max + margin_s
    board_t_min = t_min - margin_t
    board_t_max = t_max + margin_t
    
    def st_to_xy(s_val: float, t_val: float) -> np.ndarray:
        return mean + s_val * axis_x + t_val * axis_y
    
    # Четыре угла в порядке: приблизительно TL, TR, BR, BL
    pts = np.array([
        st_to_xy(board_s_min, board_t_min),
        st_to_xy(board_s_max, board_t_min),
        st_to_xy(board_s_max, board_t_max),
        st_to_xy(board_s_min, board_t_max),
    ], dtype=np.float32)
    
    # Ограничиваем внутри изображения
    pts[:, 0] = np.clip(pts[:, 0], 0, w - 1)
    pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)
    
    return pts


def map_chessboard(image: np.ndarray, 
                  game_token: str,
                  check_empty: bool = False,
                  empty_threshold: float = 0.15,
                  output_size: Tuple[int, int] = OUTPUT_IMAGE_SIZE,
                  mappings_dir: Path = None,
                  model_path: Optional[str] = None,
                  conf_threshold: float = 0.5) -> Dict:
    """
    Полный процесс маппинга шахматной доски.
    
    Новый подход:
    - НЕ используем поиск контуров/линий.
    - Определяем границы доски по детекциям фигур (YOLO).
    - Строим равномерную сетку 8x8 на выровненном изображении.
    
    Если фигур недостаточно или они слишком скучены, возвращаем ошибку
    и даём фронтенду возможность сделать ручную калибровку.
    """
    if mappings_dir is None:
        mappings_dir = Path('./chessboard_mappings')
    mappings_dir.mkdir(exist_ok=True)
    
    result = {
        'success': False,
        'game_token': game_token,
        'timestamp': datetime.now().isoformat(),
        'error': None,
        'is_empty': None,
        'empty_confidence': None,
        'board_corners': None,
        'square_corners': None,
        'perspective_matrix': None,
        'warped_image_shape': None
    }
    
    try:
        # Шаг 0: Проверка количества фигур для выбора стратегии
        # ВРЕМЕННО ОТКЛЮЧЕНО: не используем piece-based калибровку
        pieces_count = 0
        # if model_path:
        #     try:
        #         from model.yolo11_detector import YOLO11Detector
        #         detector = YOLO11Detector(model_path, conf_threshold=0.5)
        #         detections = detector.predict(image)
        #         # Повышаем порог до 0.6 для исключения ложных срабатываний
        #         pieces_count = sum(1 for _, _, conf, _ in detections if conf >= 0.6)
        #         print(f"[MAPPING] Board pieces count: {pieces_count}", file=sys.stderr, flush=True)
        #     except Exception as e:
        #         print(f"[MAPPING] Failed to count pieces: {e}", file=sys.stderr, flush=True)
        
        print("[MAPPING] Piece-based detection disabled, using contour-based detection only", file=sys.stderr, flush=True)
        
        # Шаг 1: Определение границ доски - всегда используем контуры
        board_corners = None
        
        # ВРЕМЕННО ОТКЛЮЧЕНО: piece-based калибровка
        # if pieces_count > 10:
        #     # Сценарий 1: >10 фигур - используем детекцию по фигурам + линии для уточнения
        #     print(f"[MAPPING] Board has {pieces_count} pieces (>10) - using piece-based detection + lines refinement", file=sys.stderr, flush=True)
        #     board_corners = _detect_board_from_pieces(
        #         image=image,
        #         model_path=model_path,
        #         conf_threshold=conf_threshold
        #     )
        #     
        #     if board_corners is None:
        #         result['error'] = (
        #             f"Не удалось определить границы доски по {pieces_count} фигурам. "
        #             "Пожалуйста, очистите доску и повторите попытку. "
        #             "Для пустой доски будет использована детекция контуров и линий."
        #         )
        #         return result
        #     
        #     # Временно отключаем уточнение линиями для тестирования
        #     # lines_result = _detect_board_edges_by_lines(image)
        #     # if lines_result is not None:
        #     #     print("[MAPPING] Found guiding lines, refining board corners", file=sys.stderr, flush=True)
        #     #     board_corners = _refine_board_corners_with_lines(image, board_corners, lines_result)
        #     # else:
        #     #     print("[MAPPING] No guiding lines found, using piece-based corners only", file=sys.stderr, flush=True)
        #     print("[MAPPING] Using piece-based corners only (line refinement disabled for testing)", file=sys.stderr, flush=True)
            
        # ВРЕМЕННО ОТКЛЮЧЕНО: piece-based калибровка для 1-10 фигур
        # elif pieces_count > 0:
        #     # Сценарий 2: 1-10 фигур - детекция по фигурам, потом пробуем линии
        #     print(f"[MAPPING] Board has {pieces_count} pieces (1-10) - using piece-based detection, will try line detection", file=sys.stderr, flush=True)
        #     board_corners = _detect_board_from_pieces(
        #         image=image,
        #         model_path=model_path,
        #         conf_threshold=conf_threshold,
        #         min_pieces=1,
        #         min_span_ratio=0.2
        #     )
        #     
        #     if board_corners is None:
        #         result['error'] = (
        #             f"Не удалось определить границы доски по {pieces_count} фигурам. "
        #             "Пожалуйста, используйте ручную калибровку для точного определения границ доски."
        #         )
        #         return result
        
        # Всегда используем детекцию контуров (piece-based отключена)
        print("[MAPPING] Using contour-based detection (piece-based disabled)", file=sys.stderr, flush=True)
        board_corners = _detect_board_from_contours(image)
        
        if board_corners is not None:
            print("[MAPPING] Contour detection succeeded, will use line detection for grid", file=sys.stderr, flush=True)
        else:
            # Контуры не найдены - требуем ручную калибровку
            result['error'] = (
                "Не удалось автоматически определить границы доски по контурам. "
                "Пожалуйста, используйте ручную калибровку границ доски. "
                "После калибровки будет использована детекция линий для точного разделения на клетки."
            )
            return result
        
        result['board_corners'] = board_corners.tolist()
        
        # Логируем координаты углов для отладки
        h, w = image.shape[:2]
        print(f"[MAPPING] Board corners: {board_corners.tolist()}, image size: {w}x{h}", file=sys.stderr, flush=True)
        
        # Сохраняем исходное изображение с нарисованными границами для отладки
        try:
            debug_image = image.copy()
            for i, corner in enumerate(board_corners):
                pt = tuple(corner.astype(int))
                cv2.circle(debug_image, pt, 10, (0, 255, 0), -1)
                cv2.putText(debug_image, str(i), (pt[0] + 15, pt[1]), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            # Рисуем линии между углами
            for i in range(4):
                pt1 = tuple(board_corners[i].astype(int))
                pt2 = tuple(board_corners[(i + 1) % 4].astype(int))
                cv2.line(debug_image, pt1, pt2, (0, 255, 0), 3)
            debug_path = mappings_dir / f'{game_token}_board_corners_debug.jpg'
            cv2.imwrite(str(debug_path), debug_image)
            print(f"[MAPPING] Saved debug image with board corners to {debug_path}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"[MAPPING] Failed to save debug image: {e}", file=sys.stderr, flush=True)
        
        # Шаг 2: перспективное преобразование
        warped_image, perspective_matrix = perspective_transform(
            image, board_corners, output_size
        )
        
        result['perspective_matrix'] = perspective_matrix.tolist()
        result['warped_image_shape'] = warped_image.shape
        
        print(f"[MAPPING] Warped image shape: {warped_image.shape}", file=sys.stderr, flush=True)
        
        # Шаг 3: умная сетка клеток - всегда пробуем детекцию линий
        print("[MAPPING] Attempting line detection for grid", file=sys.stderr, flush=True)
        square_corners = detect_square_corners(warped_image, SQUARE_COUNT)
        
        if square_corners is not None:
            print("[MAPPING] Line detection succeeded for grid", file=sys.stderr, flush=True)
        else:
            # Линии не найдены - просим ручную калибровку
            print("[MAPPING] Line detection failed, manual calibration required", file=sys.stderr, flush=True)
            result['error'] = (
                "Не удалось автоматически определить границы клеток доски. "
                "Пожалуйста, используйте ручную калибровку для точного разделения на клетки."
            )
            return result
        
        result['square_corners'] = square_corners.tolist()
        result['is_empty'] = pieces_count == 0
        result['empty_confidence'] = float(pieces_count)
        
        result['success'] = True
        
        # Сохранение результата калибровки (warped image с сеткой)
        try:
            # Рисуем сетку на warped image
            warped_with_grid = warped_image.copy()
            for i in range(SQUARE_COUNT + 1):
                for j in range(SQUARE_COUNT + 1):
                    pt = square_corners[i, j].astype(int)
                    # Рисуем точки углов
                    cv2.circle(warped_with_grid, tuple(pt), 3, (0, 255, 0), -1)
                    # Рисуем линии сетки
                    if i < SQUARE_COUNT:
                        pt_next = square_corners[i + 1, j].astype(int)
                        cv2.line(warped_with_grid, tuple(pt), tuple(pt_next), (0, 255, 0), 1)
                    if j < SQUARE_COUNT:
                        pt_next = square_corners[i, j + 1].astype(int)
                        cv2.line(warped_with_grid, tuple(pt), tuple(pt_next), (0, 255, 0), 1)
            
            # Сохраняем результат калибровки
            calibration_result_path = mappings_dir / f'{game_token}_calibration_result.jpg'
            cv2.imwrite(str(calibration_result_path), warped_with_grid)
            result['calibration_result_path'] = str(calibration_result_path)
        except Exception as e:
            print(f"[MAPPING] Failed to save calibration result: {e}", file=sys.stderr, flush=True)
        
        mapping_file = mappings_dir / f'{game_token}_mapping.json'
        with open(mapping_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
                return result
        
    except Exception as e:
        result['error'] = str(e)
        return result


def map_chessboard_manual(image: np.ndarray,
                          game_token: str,
                          board_corners: np.ndarray,
                          output_size: Tuple[int, int] = OUTPUT_IMAGE_SIZE,
                          mappings_dir: Path = None) -> Dict:
    """
    Маппинг шахматной доски при ручной калибровке по заданным углам.
    
    Используется, когда пользователь на фронте расставил полигон по краям доски.
    Здесь мы:
    - применяем перспективное преобразование по этим углам,
    - строим равномерную сетку 8x8 на выровненном изображении,
    - сохраняем результат в mapping.json.
    """
    if mappings_dir is None:
        mappings_dir = Path('./chessboard_mappings')
    mappings_dir.mkdir(exist_ok=True)
    
    result = {
        'success': False,
        'game_token': game_token,
        'timestamp': datetime.now().isoformat(),
        'error': None,
        'is_empty': None,
        'empty_confidence': None,
        'board_corners': None,
        'square_corners': None,
        'perspective_matrix': None,
        'warped_image_shape': None
    }
    
    try:
        board_corners = np.asarray(board_corners, dtype=np.float32).reshape(4, 2)
        result['board_corners'] = board_corners.tolist()
        
        warped_image, perspective_matrix = perspective_transform(
            image, board_corners, output_size
        )
        
        result['perspective_matrix'] = perspective_matrix.tolist()
        result['warped_image_shape'] = warped_image.shape
        
        # Используем умную сетку клеток с учетом полей доски
        square_corners = _generate_smart_square_grid(
            warped_image,
            square_count=SQUARE_COUNT
        )
        result['square_corners'] = square_corners.tolist()
        
        result['success'] = True
        
        # Сохранение результата калибровки (warped image с сеткой)
        try:
            # Рисуем сетку на warped image
            warped_with_grid = warped_image.copy()
            for i in range(SQUARE_COUNT + 1):
                for j in range(SQUARE_COUNT + 1):
                    pt = square_corners[i, j].astype(int)
                    # Рисуем точки углов
                    cv2.circle(warped_with_grid, tuple(pt), 3, (0, 255, 0), -1)
                    # Рисуем линии сетки
                    if i < SQUARE_COUNT:
                        pt_next = square_corners[i + 1, j].astype(int)
                        cv2.line(warped_with_grid, tuple(pt), tuple(pt_next), (0, 255, 0), 1)
                    if j < SQUARE_COUNT:
                        pt_next = square_corners[i, j + 1].astype(int)
                        cv2.line(warped_with_grid, tuple(pt), tuple(pt_next), (0, 255, 0), 1)
            
            # Сохраняем результат калибровки
            calibration_result_path = mappings_dir / f'{game_token}_calibration_result.jpg'
            cv2.imwrite(str(calibration_result_path), warped_with_grid)
            result['calibration_result_path'] = str(calibration_result_path)
        except Exception as e:
            print(f"[MAPPING] Failed to save calibration result: {e}", file=sys.stderr, flush=True)
        
        mapping_file = mappings_dir / f'{game_token}_mapping.json'
        with open(mapping_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
        
    except Exception as e:
        result['error'] = str(e)
        return result


def load_mapping_data(game_token: str, mappings_dir: Path = None) -> Optional[Dict]:
    """Загрузка данных маппинга"""
    if mappings_dir is None:
        mappings_dir = Path('./chessboard_mappings')
    
    mapping_file = mappings_dir / f'{game_token}_mapping.json'
    
    if not mapping_file.exists():
        return None
    
    with open(mapping_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def apply_mapping(image: np.ndarray, game_token: str, mappings_dir: Path = None) -> Optional[np.ndarray]:
    """
    Применение сохраненного маппинга к новому изображению
    
    Параметры:
    - image: Входное изображение
    - game_token: Токен игры для загрузки маппинга
    - mappings_dir: Директория с маппингами
    
    Возвращает:
    - Выровненное изображение доски или None
    """
    if mappings_dir is None:
        mappings_dir = Path('./chessboard_mappings')
    
    mapping_data = load_mapping_data(game_token, mappings_dir)
    
    if mapping_data is None or not mapping_data.get('success'):
        return None
    
    board_corners = np.array(mapping_data['board_corners'], dtype=np.float32)
    
    # Получение размера из маппинга или использование по умолчанию
    if 'warped_image_shape' in mapping_data:
        shape = mapping_data['warped_image_shape']
        output_size = (shape[1], shape[0])  # (width, height)
    else:
        output_size = OUTPUT_IMAGE_SIZE
    
    warped_image, _ = perspective_transform(image, board_corners, output_size)
    
    return warped_image


def find_square_by_point(x: float, y: float, square_corners: np.ndarray) -> Optional[Tuple[int, int]]:
    """
    Находит индексы клетки (i, j) по координате точки в warped-изображении.
    
    Параметры:
    - x, y: Координаты точки в warped-изображении
    - square_corners: Матрица (9, 9, 2) с координатами углов клеток
    
    Возвращает:
    - (i, j) - индексы клетки (0-7) или None, если точка вне доски
    """
    for i in range(SQUARE_COUNT):
        for j in range(SQUARE_COUNT):
            # Углы клетки
            pt1 = square_corners[i, j]
            pt2 = square_corners[i, j + 1]
            pt3 = square_corners[i + 1, j + 1]
            pt4 = square_corners[i + 1, j]
            
            # Проверка, находится ли точка внутри четырехугольника
            def point_in_quad(px: float, py: float, 
                            p1: np.ndarray, p2: np.ndarray, 
                            p3: np.ndarray, p4: np.ndarray) -> bool:
                def sign(p1, p2, p3):
                    return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
                
                d1 = sign((px, py), p1, p2)
                d2 = sign((px, py), p2, p3)
                d3 = sign((px, py), p3, p4)
                d4 = sign((px, py), p4, p1)
                
                has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0) or (d4 < 0)
                has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0) or (d4 > 0)
                
                return not (has_neg and has_pos)
            
            if point_in_quad(x, y, pt1, pt2, pt3, pt4):
                return (i, j)
    
    return None


def set_a1_orientation(game_token: str,
                       a1_x: float,
                       a1_y: float,
                       mappings_dir: Path = None) -> Dict:
    """
    Ручная установка ориентации доски по клику на a1.
    
    Параметры:
    - game_token: Токен игры
    - a1_x, a1_y: Координаты клика на a1 в warped-изображении
    - mappings_dir: Директория с маппингами
    
    Возвращает:
    - Словарь с результатом операции
    """
    if mappings_dir is None:
        mappings_dir = Path('./chessboard_mappings')
    
    mapping_file = mappings_dir / f'{game_token}_mapping.json'
    
    if not mapping_file.exists():
        return {
            'success': False,
            'error': 'Mapping file not found. Please calibrate the board first.'
        }
    
    try:
        # Загружаем маппинг
        with open(mapping_file, 'r', encoding='utf-8') as f:
            mapping_data = json.load(f)
        
        if not mapping_data.get('success') or 'square_corners' not in mapping_data:
            return {
                'success': False,
                'error': 'Invalid mapping data'
            }
        
        square_corners = np.array(mapping_data['square_corners'], dtype=np.float32)
        
        # Находим, какая сырая клетка соответствует клику
        a1_raw = find_square_by_point(a1_x, a1_y, square_corners)
        
        if a1_raw is None:
            return {
                'success': False,
                'error': 'Click point is outside the board'
            }
        
        i_raw_a1, j_raw_a1 = a1_raw
        
        # Строим index_map:
        # В ориентированной системе a1 = (7, 0) (нижний левый угол)
        # Значит, ориентированная клетка (i_oriented, j_oriented) соответствует
        # сырой клетке с учетом смещения от a1
        
        # Вычисляем смещение от сырого a1 к ориентированному a1
        di = 7 - i_raw_a1  # смещение по строкам
        dj = 0 - j_raw_a1  # смещение по столбцам
        
        index_map = np.zeros((8, 8, 2), dtype=np.int32)
        
        for i_o in range(8):
            for j_o in range(8):
                # Обратное преобразование: ориентированная -> сырая
                i_r = i_o - di
                j_r = j_o - dj
                
                # Проверка границ
                if 0 <= i_r < 8 and 0 <= j_r < 8:
                    index_map[i_o, j_o] = (i_r, j_r)
                else:
                    # Если выходит за границы, используем ближайшую валидную клетку
                    i_r = max(0, min(7, i_r))
                    j_r = max(0, min(7, j_r))
                    index_map[i_o, j_o] = (i_r, j_r)
        
        # Сохраняем index_map в маппинг
        mapping_data['index_map'] = index_map.tolist()
        mapping_data['a1_raw_index'] = [int(i_raw_a1), int(j_raw_a1)]
        mapping_data['orientation_set_manually'] = True
        
        with open(mapping_file, 'w', encoding='utf-8') as f:
            json.dump(mapping_data, f, indent=2, ensure_ascii=False)
        
        return {
            'success': True,
            'message': 'Orientation set successfully',
            'a1_raw_index': [int(i_raw_a1), int(j_raw_a1)]
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

