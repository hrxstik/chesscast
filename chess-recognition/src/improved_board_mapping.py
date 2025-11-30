"""
Улучшенный маппинг шахматной доски - экспорт функций из notebook
"""
import cv2
import numpy as np
import json
import os
from pathlib import Path
from typing import Tuple, List, Optional, Dict
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist
from datetime import datetime

# Импорт SAM2.1 для улучшенной калибровки (опционально)
try:
    from .sam21_board_detection import detect_board_with_sam21, detect_board_with_sam21_auto
    SAM3_AVAILABLE = True
except (ImportError, ValueError):
    # Если относительный импорт не работает, пробуем абсолютный
    try:
        from sam21_board_detection import detect_board_with_sam21, detect_board_with_sam21_auto
        SAM3_AVAILABLE = True
    except ImportError:
        SAM3_AVAILABLE = False
        detect_board_with_sam21 = None
        detect_board_with_sam21_auto = None

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
                           max_area_ratio: float = MAX_BOARD_AREA_RATIO,
                           use_sam3: bool = False) -> Optional[np.ndarray]:
    """
    Улучшенное определение границ доски
    
    Args:
        image: Входное изображение
        min_area_ratio: Минимальная площадь доски относительно изображения
        max_area_ratio: Максимальная площадь доски относительно изображения
        use_sam3: Использовать ли SAM3 для определения границ (требует ultralytics>=8.3.0)
    
    Returns:
        Массив из 4 углов доски (4, 2) или None
    """
    # Попытка использовать SAM2.1 если доступен и запрошен
    if use_sam3 and SAM3_AVAILABLE and detect_board_with_sam21_auto:
        try:
            sam3_result = detect_board_with_sam21_auto(image)
            if sam3_result is not None:
                # Проверяем, что результат соответствует требованиям по размеру
                h, w = image.shape[:2]
                total_area = h * w
                min_area = total_area * min_area_ratio
                max_area = total_area * max_area_ratio
                
                # Вычисляем площадь найденной доски
                corners = sam3_result
                width = max(calculate_distance(corners[0], corners[1]), 
                           calculate_distance(corners[2], corners[3]))
                height = max(calculate_distance(corners[0], corners[3]), 
                            calculate_distance(corners[1], corners[2]))
                area = width * height
                
                if min_area <= area <= max_area:
                    return sam3_result
        except Exception as e:
            print(f"SAM3 detection failed, falling back to traditional method: {e}")
    
    # Традиционный метод
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
    """Кластеризация линий"""
    if len(lines) <= target_count:
        return lines
    
    lines = sorted(lines, key=lambda x: x[0])
    clusters = []
    current_cluster = [lines[0]]
    
    for line in lines[1:]:
        if abs(line[0] - current_cluster[-1][0]) < 10:
            current_cluster.append(line)
        else:
            avg_rho = np.mean([l[0] for l in current_cluster])
            avg_theta = np.mean([l[1] for l in current_cluster])
            clusters.append((avg_rho, avg_theta))
            current_cluster = [line]
    
    if current_cluster:
        avg_rho = np.mean([l[0] for l in current_cluster])
        avg_theta = np.mean([l[1] for l in current_cluster])
        clusters.append((avg_rho, avg_theta))
    
    if len(clusters) > target_count:
        indices = np.linspace(0, len(clusters) - 1, target_count, dtype=int)
        clusters = [clusters[i] for i in indices]
    
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
    """Определение углов клеток доски"""
    gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY) if len(warped_image.shape) == 3 else warped_image
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
    
    if lines is None:
        return None
    
    h_lines = []
    v_lines = []
    
    for rho, theta in lines[:, 0]:
        if theta < np.pi/4 or theta > 3*np.pi/4:
            v_lines.append((rho, theta))
        else:
            h_lines.append((rho, theta))
    
    if len(h_lines) < square_count or len(v_lines) < square_count:
        return None
    
    h_lines = cluster_lines(h_lines, square_count + 1)
    v_lines = cluster_lines(v_lines, square_count + 1)
    
    if len(h_lines) < square_count + 1 or len(v_lines) < square_count + 1:
        return None
    
    intersections = []
    for h_rho, h_theta in h_lines:
        for v_rho, v_theta in v_lines:
            A = np.array([
                [np.cos(h_theta), np.sin(h_theta)],
                [np.cos(v_theta), np.sin(v_theta)]
            ])
            b = np.array([h_rho, v_rho])
            
            try:
                point = np.linalg.solve(A, b)
                if 0 <= point[0] < warped_image.shape[1] and 0 <= point[1] < warped_image.shape[0]:
                    intersections.append(point)
            except np.linalg.LinAlgError:
                continue
    
    if len(intersections) < (square_count + 1) ** 2:
        return None
    
    intersections = np.array(intersections)
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


def map_chessboard(image: np.ndarray, 
                  game_token: str,
                  check_empty: bool = True,
                  empty_threshold: float = 0.15,
                  output_size: Tuple[int, int] = OUTPUT_IMAGE_SIZE,
                  mappings_dir: Path = None) -> Dict:
    """Полный процесс маппинга шахматной доски"""
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
        board_corners = detect_board_boundaries(image, use_sam3=use_sam3)
        
        if board_corners is None:
            result['error'] = "Не удалось определить границы доски"
            return result
        
        result['board_corners'] = board_corners.tolist()
        
        warped_image, perspective_matrix = perspective_transform(
            image, board_corners, output_size
        )
        
        result['perspective_matrix'] = perspective_matrix.tolist()
        result['warped_image_shape'] = warped_image.shape
        
        square_corners = detect_square_corners(warped_image, SQUARE_COUNT)
        
        if square_corners is None:
            result['error'] = "Не удалось определить углы клеток"
            return result
        
        result['square_corners'] = square_corners.tolist()
        
        if check_empty:
            is_empty, confidence = is_board_empty(warped_image, square_corners, empty_threshold)
            result['is_empty'] = is_empty
            result['empty_confidence'] = float(confidence)
            
            if not is_empty:
                result['error'] = f"Доска не пуста (уверенность: {confidence:.2f})"
                return result
        
        result['success'] = True
        
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

