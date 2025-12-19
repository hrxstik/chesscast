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
from datetime import datetime
from model.yolo11_detector import YOLO11Detector

# Импорты для ResNet модели
try:
    import torch
    import torch.nn as nn
    from torchvision import models, transforms
    from PIL import Image
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

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


def _default_corner_model_path() -> str:
    """
    Определение пути к модели детекции углов ResNet по умолчанию.
    Приоритет: модель с zoom out аугментацией (_zoomed), затем обычная.
    """
    project_root = Path(__file__).resolve().parent.parent
    # Ищем модель в возможных местах (приоритет модели с zoom out аугментацией)
    possible_paths = [
        project_root / 'models_resnet' / 'best_resnet34_board_corners.pt',  # Старая модель
        project_root / 'best_resnet34_board_corners.pt',
        project_root / 'models_resnet' / 'best_resnet18_board_corners.pt',
        project_root / 'best_resnet18_board_corners.pt',
    ]
    for path in possible_paths:
        if path.exists():
            return str(path)
    # Возвращаем путь по умолчанию (даже если файла нет, для понятной ошибки)
    return str(possible_paths[0])


class CornerRegressor(nn.Module):
    """Модель ResNet для регрессии углов доски (8 координат)"""
    def __init__(self, model_name: str = 'resnet34', pretrained: bool = False):
        super().__init__()
        self.model_name = model_name
        
        if model_name == 'resnet18':
            self.backbone = models.resnet18(weights=None)
        elif model_name == 'resnet34':
            self.backbone = models.resnet34(weights=None)
        elif model_name == 'resnet50':
            self.backbone = models.resnet50(weights=None)
        else:
            raise ValueError(f"Неизвестная ResNet модель: {model_name}")
        
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 8)
        )
    
    def forward(self, x):
        output = self.backbone(x)
        return torch.sigmoid(output)


def _detect_board_corners_resnet(image: np.ndarray, 
                                  model_path: Optional[str] = None,
                                  img_size: int = 640,
                                  device: str = 'cpu',
                                  yolo_model_path: Optional[str] = None,
                                  use_crop: bool = False,
                                  debug_image_out: Optional[np.ndarray] = None) -> Optional[np.ndarray]:
    """
    Детекция углов доски через модель ResNet.
    
    Args:
        image: Входное изображение (BGR, как от OpenCV)
        model_path: Путь к файлу модели ResNet (.pt). Если None, используется путь по умолчанию.
        img_size: Размер входного изображения для модели
        device: Устройство для вычислений ('cpu' или 'cuda')
        yolo_model_path: Путь к модели YOLO для предварительной детекции области доски
        use_crop: Использовать ли предварительный кроп области доски через YOLO
    
    Returns:
        Массив из 4 углов доски (4, 2) в координатах исходного изображения или None
    """
    if not TORCH_AVAILABLE:
        print("[RESNET] PyTorch not available, cannot use ResNet detection", file=sys.stderr, flush=True)
        return None
    
    if model_path is None:
        model_path = _default_corner_model_path()

    
    if not Path(model_path).exists():
        print(f"[RESNET] Model not found: {model_path}", file=sys.stderr, flush=True)
        return None
    
    # Сохраняем исходный размер ДО кропа для правильного преобразования координат
    h_orig_full, w_orig_full = image.shape[:2]
    crop_x_offset = 0
    crop_y_offset = 0
    crop_bbox = None  # Для визуализации области поиска (с margin)
    board_bbox_raw = None  # Для визуализации чистой области доски (без margin)
    was_cropped = False
    
    # ВСЕГДА создаем debug изображение для визуализации (если не передано, создаем копию)
    if debug_image_out is None:
        debug_image_out = image.copy()
    
    # Порог кропа
    crop_threshold_ratio = 0.8  # 80% порог
    
    # ВСЕГДА ищем фигуры через YOLO (YOLO возвращает ТОЛЬКО фигуры, не область доски!)
    board_bbox = None
    pieces_info = []
    
    if yolo_model_path:
        try:
            # Используем высокий порог уверенности (0.7) чтобы исключить ложные срабатывания
            result = _detect_board_from_pieces(image, model_path=yolo_model_path, 
                                               conf_threshold=0.7, min_pieces=4, min_span_ratio=0.2,
                                               return_pieces_info=True)
            
            # YOLO возвращает только фигуры (pieces_info), область доски мы строим сами!
            # Функция _detect_board_from_pieces возвращает (board_bbox, pieces_info) или (None, pieces_info)
            # где board_bbox - это область доски через PCA (мы её игнорируем, строим сами из фигур)
            if result is not None:
                if isinstance(result, tuple):
                    board_bbox_from_pca, pieces_info = result  # Первый элемент (board_bbox через PCA) игнорируем
                else:
                    # Если вернулся не tuple, значит что-то не так
                    pieces_info = []
            
            # ВСЕГДА визуализируем фигуры на debug изображении (оранжевый цвет)
            if pieces_info:
                for i, piece in enumerate(pieces_info):
                    x1, y1, x2, y2 = piece['bbox']
                    conf = piece['confidence']
                    # Рисуем bbox фигуры (оранжевый цвет, толстая рамка)
                    cv2.rectangle(debug_image_out, (int(x1), int(y1)), (int(x2), int(y2)), (0, 165, 255), 3)
                    # Показываем уверенность
                    cv2.putText(debug_image_out, f'{conf:.2f}', (int(x1), int(y1) - 5), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 1)
                    # Рисуем центр фигуры
                    cx, cy = int(piece['center'][0]), int(piece['center'][1])
                    cv2.circle(debug_image_out, (cx, cy), 3, (0, 165, 255), -1)
            
            # ВСЕГДА строим область доски из фигур (с margin для большей области!)
            if pieces_info:
                # Вычисляем bounding box всех фигур
                x_min_raw = int(min(piece['bbox'][0] for piece in pieces_info))
                y_min_raw = int(min(piece['bbox'][1] for piece in pieces_info))
                x_max_raw = int(max(piece['bbox'][2] for piece in pieces_info))
                y_max_raw = int(max(piece['bbox'][3] for piece in pieces_info))
                
                # Добавляем margin 10% от ширины области доски чтобы область доски была больше фигур
                board_width_temp = x_max_raw - x_min_raw
                board_height_temp = y_max_raw - y_min_raw
                margin_x = int(board_width_temp * 0.1)  # 10% от ширины области доски
                margin_y = int(board_width_temp * 0.1)  # 10% от ширины области доски (используем ширину для обеих сторон)
                x_min_raw = max(0, x_min_raw - margin_x)
                y_min_raw = max(0, y_min_raw - margin_y)
                x_max_raw = min(w_orig_full, x_max_raw + margin_x)
                y_max_raw = min(h_orig_full, y_max_raw + margin_y)
                
                # Сохраняем область доски для визуализации
                board_bbox_raw = (x_min_raw, y_min_raw, x_max_raw, y_max_raw)
                
                # ВСЕГДА рисуем синюю рамку области доски
                cv2.rectangle(debug_image_out, (x_min_raw, y_min_raw), (x_max_raw, y_max_raw), (255, 0, 0), 5)
                cv2.putText(debug_image_out, 'Board Area', (x_min_raw, y_min_raw - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 3)
                
                # Вычисляем ширину области доски
                board_width = x_max_raw - x_min_raw
                board_height = y_max_raw - y_min_raw
                board_width_ratio = board_width / w_orig_full
                
                # Если доска маленькая (< 80% ширины кадра), кропаем добавляя сверху/снизу для 3:4
                if board_width_ratio < crop_threshold_ratio:
                    
                    target_aspect = 3 / 4  # Портретное соотношение (width/height = 0.75)
                    
                    # Берем ширину области доски как основу для кропа
                    crop_width = board_width
                    # Вычисляем нужную высоту для соотношения 3:4
                    crop_height = int(crop_width / target_aspect)
                    
                    # Вычисляем сколько нужно добавить сверху/снизу
                    height_to_add = crop_height - board_height
                    top_padding = height_to_add // 2
                    bottom_padding = height_to_add - top_padding
                    
                    # Вычисляем координаты кропа: берем область доски и добавляем сверху/снизу
                    x_min = x_min_raw
                    x_max = x_max_raw
                    y_min = max(0, y_min_raw - top_padding)
                    y_max = min(h_orig_full, y_max_raw + bottom_padding)
                    
                    # Если не хватает места сверху, добавляем снизу
                    if y_min_raw - top_padding < 0:
                        extra_bottom = abs(y_min_raw - top_padding)
                        y_min = 0
                        y_max = min(h_orig_full, y_max_raw + bottom_padding + extra_bottom)
                    
                    # Если не хватает места снизу, добавляем сверху
                    if y_max_raw + bottom_padding > h_orig_full:
                        extra_top = (y_max_raw + bottom_padding) - h_orig_full
                        y_max = h_orig_full
                        y_min = max(0, y_min_raw - top_padding - extra_top)
                    
                    # Кропаем изображение с правильным соотношением сторон 3:4
                    cropped_image = image[y_min:y_max, x_min:x_max]
                    crop_x_offset = x_min
                    crop_y_offset = y_min
                    
                    # Сохраняем bbox для визуализации (фиолетовый цвет)
                    crop_bbox = (x_min, y_min, x_max, y_max)
                    
                    # ВСЕГДА рисуем фиолетовую рамку кропа (толстая яркая рамка, БЕЗ заливки!)
                    cv2.rectangle(debug_image_out, (x_min, y_min), (x_max, y_max), (255, 0, 255), 5)
                    cv2.putText(debug_image_out, 'Crop Area (3:4)', (x_min, y_max + 30), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 3)
                    
                    # Используем кропнутое изображение для ResNet
                    image = cropped_image
                    was_cropped = True
                else:
                    # Рисуем фиолетовую рамку на полном изображении, чтобы показать что используется полное изображение
                    cv2.rectangle(debug_image_out, (0, 0), (w_orig_full, h_orig_full), (255, 0, 255), 5)
                    cv2.putText(debug_image_out, 'Full Image (No Crop)', (10, h_orig_full - 20), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 3)
            else:
                # Если фигур нет, рисуем рамку кропа на полном изображении
                cv2.rectangle(debug_image_out, (0, 0), (w_orig_full, h_orig_full), (255, 0, 255), 5)
                cv2.putText(debug_image_out, 'Full Image (No Pieces)', (10, h_orig_full - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 3)
        except Exception as e:
            print(f"[RESNET] ERROR searching board area via YOLO: {e}", file=sys.stderr, flush=True)
            import traceback
            traceback.print_exc()
            print(f"[RESNET] Using full image due to YOLO error", file=sys.stderr, flush=True)
    
    try:
        # Определяем имя модели из пути
        model_name = 'resnet34'  # по умолчанию
        if 'resnet18' in model_path.lower():
            model_name = 'resnet18'
        elif 'resnet50' in model_path.lower():
            model_name = 'resnet50'
        
        # Загружаем модель
        model = CornerRegressor(model_name=model_name, pretrained=False)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        model.eval()
        
        # Сохраняем размер изображения для ResNet (может быть кропнутым)
        h_resnet, w_resnet = image.shape[:2]
        
        # Модель ResNet требует фиксированный размер входа (640x640) из-за полносвязных слоев
        # Поэтому всегда ресайзим до 640x640, но для кропнутого изображения используем качественный upscale
        model_input_size = img_size  # Всегда 640x640 для совместимости с моделью
        
        if was_cropped:
            max_dim = max(h_resnet, w_resnet)
        
        # Преобразуем изображение для модели
        # Для кропнутого изображения используем качественный ресайз через OpenCV перед PIL
        if was_cropped:
            # Используем cv2.INTER_LANCZOS4 для качественного ресайза (лучше чем стандартный PIL)
            # Это особенно важно при upscale маленького кропнутого изображения
            interpolation = cv2.INTER_LANCZOS4 if max(h_resnet, w_resnet) < 640 else cv2.INTER_AREA
            image_resized = cv2.resize(image, (model_input_size, model_input_size), interpolation=interpolation)
            img_rgb = cv2.cvtColor(image_resized, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)
        else:
            # Для полного изображения используем стандартный PIL ресайз
            img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)
        
        # Трансформации: если уже ресайзили через OpenCV, то только нормализация
        if was_cropped:
            transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
        else:
            transform = transforms.Compose([
                transforms.Resize((model_input_size, model_input_size)),  # Стандартный ресайз через PIL
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
        
        img_tensor = transform(img_pil).unsqueeze(0).to(device)
        
        # Предсказание
        with torch.no_grad():
            coords_normalized = model(img_tensor).cpu().numpy().reshape(-1)  # 8 чисел [0, 1]
        
        
        # Преобразуем нормализованные координаты в пиксели
        # Координаты нормализованы относительно размера изображения, которое мы подали в ResNet
        coords = coords_normalized.copy()
        coords[0::2] *= w_resnet  # x координаты умножаем на ширину изображения для ResNet
        coords[1::2] *= h_resnet  # y координаты умножаем на высоту изображения для ResNet
        
        # Преобразуем в массив углов (4, 2) - координаты в кропнутом изображении
        corners = coords.reshape(4, 2).astype(np.float32)
        
        # Если использовали кроп, преобразуем координаты обратно к исходному изображению
        if was_cropped:
            # Координаты в кропнутом изображении -> координаты в исходном изображении
            corners[:, 0] += crop_x_offset  # добавляем смещение по X
            corners[:, 1] += crop_y_offset  # добавляем смещение по Y
        
        # Применяем канонический порядок (TL, TR, BR, BL)
        points = corners.copy()
        # Сортируем по Y (меньший Y = выше)
        idx_by_y = np.argsort(points[:, 1])
        top = points[idx_by_y[:2]]
        bottom = points[idx_by_y[2:]]
        
        # Внутри top/bottom сортируем по X
        top = top[np.argsort(top[:, 0])]
        bottom = bottom[np.argsort(bottom[:, 0])]
        
        # Собираем в порядке TL, TR, BR, BL
        ordered_corners = np.stack([top[0], top[1], bottom[1], bottom[0]], axis=0)
        
        # Коррекция точки 0 (TL): сдвигаем на 2% влево из-за смещения в датасете
        board_width = abs(ordered_corners[1][0] - ordered_corners[0][0])  # Ширина доски по X между TL и TR
        correction_x = board_width * 0.02  # 2% от ширины доски
        new_x = ordered_corners[0][0] - correction_x
        # Ограничиваем координату в пределах изображения
        ordered_corners[0][0] = max(0, new_x)  # Не меньше 0
        
        # Визуализация уже выполнена выше при определении области доски
        # Здесь только возвращаем результат
        
        return ordered_corners.astype(np.float32)
        
    except Exception as e:
        print(f"[RESNET] Ошибка при детекции: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        return None


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
    
    # Используем умное деление с учетом полей (детекция линий удалена)
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


def _detect_board_from_pieces(image: np.ndarray,
                              model_path: Optional[str] = None,
                              conf_threshold: float = 0.5,
                              min_pieces: int = 8,
                              min_span_ratio: float = 0.3,
                              return_pieces_info: bool = False) -> Optional[np.ndarray]:
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
    
    # Собираем центры фигур с фильтрацией по уверенности
    centers = []
    pieces_info = []  # Сохраняем информацию о фигурах для визуализации
    filtered_count = 0
    for class_name, bbox, conf, class_id in detections:
        # Дополнительная проверка уверенности (на случай если detector.predict не фильтрует)
        if conf < conf_threshold:
            filtered_count += 1
            continue
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        centers.append([cx, cy])
        if return_pieces_info:
            pieces_info.append({
                'bbox': (int(x1), int(y1), int(x2), int(y2)),
                'confidence': float(conf),
                'center': (cx, cy)
            })
    
    if len(centers) < min_pieces:
        if return_pieces_info:
            return None, pieces_info
        return None
    
    centers = np.array(centers, dtype=np.float32)
    mean = centers.mean(axis=0)
    X = centers - mean  # (N, 2)
    
    # PCA через SVD
    try:
        _, _, Vt = np.linalg.svd(X, full_matrices=False)
    except np.linalg.LinAlgError:
        if return_pieces_info:
            return None, pieces_info
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
        if return_pieces_info:
            return None, pieces_info
        return None
    
    # Дополнительная проверка: если область слишком большая (больше 50% кадра), вероятно ложные срабатывания
    estimated_area_ratio = (s_span * t_span) / (w * h)
    if estimated_area_ratio > 0.5:
        if return_pieces_info:
            return None, pieces_info
        return None
    
    # Дополнительная проверка: если разброс фигур слишком большой относительно размера кадра
    if s_span > 0.7 * max(w, h) or t_span > 0.7 * max(w, h):
        if return_pieces_info:
            return None, pieces_info
        return None
    
    # Дополнительная проверка: если область доски выходит за разумные границы
    margin_threshold = 0.05  # 5% от размера кадра
    if (s_min < -margin_threshold * max(w, h) or s_max > max(w, h) * (1 + margin_threshold) or
        t_min < -margin_threshold * max(w, h) or t_max > max(w, h) * (1 + margin_threshold)):
        if return_pieces_info:
            return None, pieces_info
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
    
    if return_pieces_info:
        return pts, pieces_info
    
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
        
        # Шаг 1: Определение границ доски через ResNet модель
        # Определяем устройство (GPU если доступно, иначе CPU)
        device = 'cuda' if TORCH_AVAILABLE and torch.cuda.is_available() else 'cpu'
        
        # Используем YOLO для предварительного кропа области доски (если модель доступна)
        yolo_model_path = model_path if model_path else None
        
        # Создаем debug изображение для визуализации области поиска
        # ВАЖНО: создаем копию ДО передачи, чтобы изменения сохранялись
        debug_image = image.copy()
        
        # Передаем debug_image по ссылке - все изменения будут видны в оригинале
        board_corners = _detect_board_corners_resnet(image, model_path=None, device=device, 
                                                     yolo_model_path=yolo_model_path, use_crop=True,
                                                     debug_image_out=debug_image)
        
        # После вызова debug_image содержит все нарисованные рамки из _detect_board_corners_resnet
        
        if board_corners is None:
            # ResNet не смог определить углы - требуем ручную калибровку
            result['error'] = (
                "Не удалось автоматически определить границы доски через модель ResNet. "
                "Пожалуйста, используйте ручную калибровку границ доски. "
                "Вы можете вызвать map_chessboard_manual с указанными углами."
            )
            return result
        
        result['board_corners'] = board_corners.tolist()
        
        # Сохраняем исходное изображение с нарисованными границами для отладки
        # debug_image уже содержит визуализацию области поиска из функции детекции:
        # - Синяя рамка области доски (Board Area) - ВСЕГДА если найдена
        # - Фиолетовая рамка кропа (если был применен кроп) - ВСЕГДА если кроп применен
        # - Оранжевые фигуры, участвующие в определении области доски - ВСЕГДА если найдены
        # ВСЕГДА добавляем найденные углы доски и рамку по ним (зеленый цвет)
        try:
            # Рисуем углы доски (зеленые точки)
            for i, corner in enumerate(board_corners):
                pt = tuple(corner.astype(int))
                cv2.circle(debug_image, pt, 15, (0, 255, 0), -1)
                cv2.putText(debug_image, str(i), (pt[0] + 20, pt[1]), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
            # Рисуем рамку по углам доски (зеленые линии, толстые и яркие)
            for i in range(4):
                pt1 = tuple(board_corners[i].astype(int))
                pt2 = tuple(board_corners[(i + 1) % 4].astype(int))
                cv2.line(debug_image, pt1, pt2, (0, 255, 0), 5)
            # Сохраняем изображение ПОСЛЕ всего рисования
            debug_path = mappings_dir / f'{game_token}_board_corners_debug.jpg'
            cv2.imwrite(str(debug_path), debug_image)
        except Exception as e:
            print(f"[MAPPING] Failed to save debug image: {e}", file=sys.stderr, flush=True)
        
        # Шаг 2: перспективное преобразование
        warped_image, perspective_matrix = perspective_transform(
            image, board_corners, output_size
        )
        
        result['perspective_matrix'] = perspective_matrix.tolist()
        result['warped_image_shape'] = warped_image.shape
        
        # Шаг 3: Генерируем равномерную сетку клеток 8x8
        square_corners = _generate_uniform_square_grid(warped_image, SQUARE_COUNT)
        
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

