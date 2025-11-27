"""
YOLO 11 детектор для шахматных фигур с поддержкой трекинга
"""
import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict
try:
    from ultralytics import YOLO
except ImportError:
    print("Warning: ultralytics not installed. Install with: pip install ultralytics")
    YOLO = None
from pathlib import Path
import json


class YOLO11Detector:
    """Детектор шахматных фигур на основе YOLO 11"""
    
    def __init__(self, model_path: str, conf_threshold: float = 0.25, iou_threshold: float = 0.45):
        """
        Инициализация детектора
        
        Args:
            model_path: Путь к модели YOLO 11 (.pt файл)
            conf_threshold: Порог уверенности для детекции
            iou_threshold: Порог IoU для NMS
        """
        if YOLO is None:
            raise ImportError("ultralytics is required. Install with: pip install ultralytics")
        
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        
        # Загрузка конфигурации классов (если есть)
        self.class_names = self.model.names
        
    def predict(self, image: np.ndarray) -> List[Tuple[str, Tuple[int, int, int, int], float, int]]:
        """
        Детекция фигур на изображении
        
        Args:
            image: Входное изображение (BGR)
            
        Returns:
            Список детекций: (class_name, bbox, confidence, class_id)
            bbox формат: (x1, y1, x2, y2)
        """
        results = self.model.predict(
            source=image,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False
        )
        
        detections = []
        for result in results:
            if result.boxes is not None:
                boxes = result.boxes
                for box in boxes:
                    cls_id = int(box.cls)
                    conf = float(box.conf)
                    class_name = self.class_names[cls_id]
                    
                    # Получение координат bbox
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    bbox = (int(x1), int(y1), int(x2), int(y2))
                    
                    detections.append((class_name, bbox, conf, cls_id))
        
        return detections


class PieceTracker:
    """Трекер фигур на основе начальной позиции"""
    
    def __init__(self, initial_position: Dict[str, Tuple[int, int, int, int]]):
        """
        Инициализация трекера
        
        Args:
            initial_position: Словарь {track_id: (x1, y1, x2, y2, class_name)} 
                             с начальными позициями фигур
        """
        self.initial_positions = initial_position
        self.current_positions = initial_position.copy()
        self.track_id_counter = max(initial_position.keys(), default=0) + 1
        
    def update(self, detections: List[Tuple[str, Tuple[int, int, int, int], float, int]]) -> Dict[int, Dict]:
        """
        Обновление позиций фигур на основе новых детекций
        
        Args:
            detections: Список детекций (class_name, bbox, confidence, class_id)
            
        Returns:
            Словарь {track_id: {'bbox': (x1,y1,x2,y2), 'class': str, 'confidence': float}}
        """
        # Простой алгоритм сопоставления по IoU и классу
        updated_tracks = {}
        used_detections = set()
        
        # Сначала пытаемся обновить существующие треки
        for track_id, track_data in self.current_positions.items():
            track_bbox = track_data[:4]
            track_class = track_data[4] if len(track_data) > 4 else None
            
            best_iou = 0.3  # Минимальный IoU для обновления
            best_detection_idx = None
            
            for idx, (class_name, bbox, conf, class_id) in enumerate(detections):
                if idx in used_detections:
                    continue
                    
                # Проверка класса (если указан)
                if track_class and class_name != track_class:
                    continue
                
                iou = self._calculate_iou(track_bbox, bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_detection_idx = idx
            
            if best_detection_idx is not None:
                # Обновляем трек
                class_name, bbox, conf, class_id = detections[best_detection_idx]
                self.current_positions[track_id] = bbox + (class_name,)
                updated_tracks[track_id] = {
                    'bbox': bbox,
                    'class': class_name,
                    'confidence': conf
                }
                used_detections.add(best_detection_idx)
            else:
                # Трек не обновлен, используем последнюю известную позицию
                updated_tracks[track_id] = {
                    'bbox': track_bbox,
                    'class': track_class or 'unknown',
                    'confidence': 0.0
                }
        
        # Создаем новые треки для неиспользованных детекций
        for idx, (class_name, bbox, conf, class_id) in enumerate(detections):
            if idx not in used_detections:
                track_id = self.track_id_counter
                self.track_id_counter += 1
                self.current_positions[track_id] = bbox + (class_name,)
                updated_tracks[track_id] = {
                    'bbox': bbox,
                    'class': class_name,
                    'confidence': conf
                }
        
        return updated_tracks
    
    def _calculate_iou(self, bbox1: Tuple[int, int, int, int], bbox2: Tuple[int, int, int, int]) -> float:
        """Вычисление IoU между двумя bbox"""
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        # Вычисление площади пересечения
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i <= x1_i or y2_i <= y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        
        # Вычисление площадей bbox
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def get_board_state(self, square_mapping: np.ndarray) -> np.ndarray:
        """
        Получение состояния доски на основе треков и маппинга клеток
        
        Args:
            square_mapping: Матрица 9x9x2 с координатами углов клеток
            
        Returns:
            Матрица 8x8 с ID фигур (-1 для пустых клеток)
        """
        board_state = np.ones((8, 8), dtype=np.int32) * -1
        
        # Маппинг классов фигур на ID (как в virtual_board.py)
        piece_class_to_id = {
            'white-pawn': 0, 'white-rook': 1, 'white-bishop': 2,
            'white-knight': 3, 'white-king': 4, 'white-queen': 5,
            'black-pawn': 6, 'black-rook': 7, 'black-bishop': 8,
            'black-knight': 11, 'black-king': 9, 'black-queen': 10
        }
        
        for track_id, track_data in self.current_positions.items():
            if len(track_data) < 4:
                continue
                
            bbox = track_data[:4]
            class_name = track_data[4] if len(track_data) > 4 else None
            
            if class_name not in piece_class_to_id:
                continue
            
            piece_id = piece_class_to_id[class_name]
            
            # Находим центр bbox
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2
            
            # Определяем, в какой клетке находится центр
            square_pos = self._find_square(center_x, center_y, square_mapping)
            
            if square_pos:
                row, col = square_pos
                board_state[row, col] = piece_id
        
        return board_state
    
    def _find_square(self, x: float, y: float, square_mapping: np.ndarray) -> Optional[Tuple[int, int]]:
        """Нахождение клетки по координатам точки"""
        for i in range(8):
            for j in range(8):
                # Углы клетки
                pt1 = square_mapping[i, j]
                pt2 = square_mapping[i, j + 1]
                pt3 = square_mapping[i + 1, j + 1]
                pt4 = square_mapping[i + 1, j]
                
                # Проверка, находится ли точка внутри четырехугольника
                if self._point_in_quad(x, y, pt1, pt2, pt3, pt4):
                    return (i, j)
        
        return None
    
    def _point_in_quad(self, x: float, y: float, 
                      p1: np.ndarray, p2: np.ndarray, 
                      p3: np.ndarray, p4: np.ndarray) -> bool:
        """Проверка, находится ли точка внутри четырехугольника"""
        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
        
        d1 = sign((x, y), p1, p2)
        d2 = sign((x, y), p2, p3)
        d3 = sign((x, y), p3, p4)
        d4 = sign((x, y), p4, p1)
        
        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0) or (d4 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0) or (d4 > 0)
        
        return not (has_neg and has_pos)

