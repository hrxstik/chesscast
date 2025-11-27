"""
YOLO 11 детектор для шахматных фигур с поддержкой ByteTrack трекинга
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
    """Детектор и трекер шахматных фигур на основе YOLO 11 с ByteTrack"""
    
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
        
        # Загрузка конфигурации классов
        self.class_names = self.model.names
        
    def predict(self, image: np.ndarray) -> List[Tuple[str, Tuple[int, int, int, int], float, int]]:
        """
        Детекция фигур на изображении (без трекинга)
        
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
    
    def track(self, image: np.ndarray, persist: bool = True) -> List[Dict]:
        """
        Детекция и трекинг фигур с использованием ByteTrack
        
        Args:
            image: Входное изображение (BGR)
            persist: Сохранять треки между кадрами
            
        Returns:
            Список треков: [
                {
                    'track_id': int,
                    'class_name': str,
                    'bbox': (x1, y1, x2, y2),
                    'confidence': float,
                    'class_id': int
                },
                ...
            ]
        """
        results = self.model.track(
            source=image,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            persist=persist,
            tracker='bytetrack.yaml',  # Используем ByteTrack
            verbose=False
        )
        
        tracks = []
        for result in results:
            if result.boxes is not None and result.boxes.id is not None:
                boxes = result.boxes
                track_ids = boxes.id.cpu().numpy().astype(int)
                
                for i, (box, track_id) in enumerate(zip(boxes, track_ids)):
                    cls_id = int(box.cls)
                    conf = float(box.conf)
                    class_name = self.class_names[cls_id]
                    
                    # Получение координат bbox
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    bbox = (int(x1), int(y1), int(x2), int(y2))
                    
                    tracks.append({
                        'track_id': int(track_id),
                        'class_name': class_name,
                        'bbox': bbox,
                        'confidence': conf,
                        'class_id': cls_id
                    })
        
        return tracks


class BoardStateMapper:
    """Маппер для преобразования треков в состояние доски"""
    
    def __init__(self):
        """Инициализация маппера"""
        # Маппинг классов фигур на ID (как в virtual_board.py)
        self.piece_class_to_id = {
            'white-pawn': 0, 'white-rook': 1, 'white-bishop': 2,
            'white-knight': 3, 'white-king': 4, 'white-queen': 5,
            'black-pawn': 6, 'black-rook': 7, 'black-bishop': 8,
            'black-knight': 11, 'black-king': 9, 'black-queen': 10
        }
    
    def tracks_to_board_state(self, tracks: List[Dict], square_mapping: np.ndarray) -> np.ndarray:
        """
        Преобразование треков в состояние доски
        
        Args:
            tracks: Список треков от ByteTrack
            square_mapping: Матрица 9x9x2 с координатами углов клеток
            
        Returns:
            Матрица 8x8 с ID фигур (-1 для пустых клеток)
        """
        board_state = np.ones((8, 8), dtype=np.int32) * -1
        
        for track in tracks:
            class_name = track['class_name']
            bbox = track['bbox']
            
            if class_name not in self.piece_class_to_id:
                continue
            
            piece_id = self.piece_class_to_id[class_name]
            
            # Находим центр bbox
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2
            
            # Определяем, в какой клетке находится центр
            square_pos = self._find_square(center_x, center_y, square_mapping)
            
            if square_pos:
                row, col = square_pos
                # Если клетка уже занята, выбираем более уверенную детекцию
                if board_state[row, col] == -1:
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

