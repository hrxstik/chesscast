"""
Использование SAM2.1 (Segment Anything Model 2.1) от Ultralytics для калибровки доски
Примечание: SAM3 пока недоступен в ultralytics, используем SAM2.1 (самая новая доступная версия)
"""
import cv2
import numpy as np
from typing import Optional, Tuple, List
from pathlib import Path

try:
    # Пробуем прямой импорт
    from ultralytics import SAM
except ImportError:
    try:
        # Пробуем через models.sam
        from ultralytics.models.sam import SAM
    except ImportError:
        try:
            # Пробуем через getattr
            import ultralytics
            SAM = getattr(ultralytics, 'SAM', None)
            if SAM is None:
                raise ImportError("SAM not found in ultralytics")
        except Exception:
            SAM = None
            print("Warning: ultralytics not installed or SAM not available. Install with: pip install ultralytics>=8.3.0")


def detect_board_with_sam21(
    image: np.ndarray,
    prompt_point: Optional[Tuple[int, int]] = None,
    prompt_box: Optional[Tuple[int, int, int, int]] = None,
    model_name: str = "sam2.1_t.pt"  # tiny версия SAM2.1 для скорости (доступны: sam2.1_t, sam2.1_s, sam2.1_b, sam2.1_l)
) -> Optional[np.ndarray]:
    """
    Определение границ доски с использованием SAM2.1
    
    Args:
        image: Входное изображение (BGR)
        prompt_point: Точка-подсказка в центре доски (x, y) - опционально
        prompt_box: Бокс-подсказка вокруг доски (x1, y1, x2, y2) - опционально
        model_name: Название модели SAM2.1 (sam2.1_t.pt, sam2.1_s.pt, sam2.1_b.pt, sam2.1_l.pt)
    
    Returns:
        Массив из 4 углов доски (4, 2) или None
    """
    if SAM is None:
        return None
    
    try:
        # Инициализация модели SAM2.1
        model = SAM(model_name)
        
        # Если подсказки не заданы, используем центр изображения
        if prompt_point is None and prompt_box is None:
            h, w = image.shape[:2]
            prompt_point = (w // 2, h // 2)
        
        # Сегментация с подсказкой
        if prompt_point:
            results = model(image, points=[prompt_point], labels=[1])
        elif prompt_box:
            results = model(image, bboxes=[prompt_box])
        else:
            # Автоматическая сегментация всего изображения
            results = model(image)
        
        if not results or len(results) == 0:
            return None
        
        # Получаем маску сегментации
        masks = results[0].masks
        if masks is None or len(masks.data) == 0:
            return None
        
        # Берем самую большую маску (предполагаем, что это доска)
        mask_data = masks.data.cpu().numpy()
        largest_mask_idx = np.argmax([np.sum(m) for m in mask_data])
        mask = mask_data[largest_mask_idx]
        
        # Конвертируем маску в uint8
        mask_uint8 = (mask * 255).astype(np.uint8)
        
        # Находим контур доски
        contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Берем самый большой контур
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Аппроксимируем контур до 4 точек (углы доски)
        peri = cv2.arcLength(largest_contour, True)
        approx = cv2.approxPolyDP(largest_contour, 0.02 * peri, True)
        
        if len(approx) < 4:
            # Если не получилось 4 точки, используем bounding box
            x, y, w, h = cv2.boundingRect(largest_contour)
            corners = np.array([
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h]
            ], dtype=np.float32)
        else:
            # Берем первые 4 точки
            corners = approx[:4].reshape(4, 2).astype(np.float32)
        
        return corners
        
    except Exception as e:
        print(f"Error in SAM3 board detection: {e}")
        return None


def detect_board_with_sam21_auto(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Автоматическое определение доски с SAM2.1 без подсказок
    
    Args:
        image: Входное изображение (BGR)
    
    Returns:
        Массив из 4 углов доски (4, 2) или None
    """
    if SAM is None:
        return None
    
    try:
        # Используем SAM2.1 для сегментации всех объектов
        model = SAM("sam2.1_t.pt")  # tiny версия для скорости
        results = model(image)
        
        if not results or len(results) == 0:
            return None
        
        masks = results[0].masks
        if masks is None or len(masks.data) == 0:
            return None
        
        # Ищем маску, которая больше всего похожа на квадрат/прямоугольник
        mask_data = masks.data.cpu().numpy()
        h, w = image.shape[:2]
        total_area = h * w
        
        best_mask = None
        best_score = 0
        
        for mask in mask_data:
            mask_uint8 = (mask * 255).astype(np.uint8)
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                continue
            
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            
            # Фильтруем по размеру (доска должна занимать 10-90% изображения)
            if not (0.1 * total_area <= area <= 0.9 * total_area):
                continue
            
            # Проверяем, насколько контур похож на прямоугольник
            peri = cv2.arcLength(largest_contour, True)
            approx = cv2.approxPolyDP(largest_contour, 0.02 * peri, True)
            
            if len(approx) >= 4:
                # Вычисляем score: площадь * отношение площади к периметру (больше = лучше)
                score = area * (area / (peri + 1e-5))
                if score > best_score:
                    best_score = score
                    best_mask = largest_contour
        
        if best_mask is None:
            return None
        
        # Извлекаем углы из лучшего контура
        peri = cv2.arcLength(best_mask, True)
        approx = cv2.approxPolyDP(best_mask, 0.02 * peri, True)
        
        if len(approx) < 4:
            x, y, w, h = cv2.boundingRect(best_mask)
            corners = np.array([
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h]
            ], dtype=np.float32)
        else:
            corners = approx[:4].reshape(4, 2).astype(np.float32)
        
        return corners
        
    except Exception as e:
        print(f"Error in SAM3 auto detection: {e}")
        return None


def detect_squares_with_sam21(
    warped_image: np.ndarray,
    model_name: str = "sam2.1_t.pt"
) -> Optional[np.ndarray]:
    """
    Определение углов клеток на выровненной доске с использованием SAM3
    
    Args:
        warped_image: Выровненное изображение доски (BGR)
        model_name: Название модели SAM3
    
    Returns:
        Матрица углов клеток (9, 9, 2) или None
    """
    if SAM is None:
        return None
    
    try:
        model = SAM(model_name)
        
        # Сегментируем выровненное изображение
        results = model(warped_image)
        
        if not results or len(results) == 0:
            return None
        
        masks = results[0].masks
        if masks is None:
            return None
        
        # TODO: Использовать маски для определения границ клеток
        # Это более сложная задача, требующая дополнительной логики
        
        return None
        
    except Exception as e:
        print(f"Error in SAM3 squares detection: {e}")
        return None

