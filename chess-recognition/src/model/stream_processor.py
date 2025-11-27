"""
Обработчик потока в реальном времени для шахматной доски
"""
import cv2
import numpy as np
import json
import base64
from typing import Optional, Dict, Callable
from pathlib import Path
from model.yolo11_detector import YOLO11Detector, PieceTracker
from model.virtual_board import VirtualBoard
import chess


class StreamProcessor:
    """Обработчик потока кадров в реальном времени"""
    
    def __init__(self, 
                 model_path: str,
                 game_token: str,
                 mapping_dir: Path = Path('./chessboard_mappings'),
                 on_move_detected: Optional[Callable] = None):
        """
        Инициализация обработчика потока
        
        Args:
            model_path: Путь к модели YOLO 11
            game_token: Токен игры
            mapping_dir: Директория с маппингами
            on_move_detected: Callback функция при обнаружении хода
        """
        self.game_token = game_token
        self.mapping_dir = mapping_dir
        self.on_move_detected = on_move_detected
        
        # Загрузка детектора
        self.detector = YOLO11Detector(model_path)
        
        # Загрузка маппинга доски
        self.mapping_data = self._load_mapping()
        if not self.mapping_data or not self.mapping_data.get('success'):
            raise ValueError(f"Маппинг для токена {game_token} не найден")
        
        # Инициализация трекера с начальной позицией
        self.tracker = None
        self.initial_position_set = False
        
        # Виртуальная доска для валидации ходов
        self.virtual_board = VirtualBoard()
        
        # Предыдущее состояние доски
        self.previous_board_state = None
        
    def _load_mapping(self) -> Optional[Dict]:
        """Загрузка данных маппинга"""
        mapping_file = self.mapping_dir / f'{self.game_token}_mapping.json'
        if not mapping_file.exists():
            return None
        
        with open(mapping_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    
    def initialize_tracker(self, frame: np.ndarray):
        """
        Инициализация трекера на основе начальной позиции
        
        Args:
            frame: Кадр с начальной позицией (доска должна быть пуста или с фигурами в стартовой позиции)
        """
        # Применяем маппинг
        from improved_board_mapping import apply_mapping
        warped = apply_mapping(frame, self.game_token, self.mapping_dir)
        
        if warped is None:
            raise ValueError("Failed to apply mapping")
        
        # Детекция фигур
        detections = self.detector.predict(warped)
        
        # Создание начальных позиций для трекера
        initial_positions = {}
        square_corners = np.array(self.mapping_data['square_corners'])
        
        # Стандартная начальная позиция
        initial_setup = {
            (0, 0): 'white-rook', (0, 1): 'white-knight', (0, 2): 'white-bishop',
            (0, 3): 'white-queen', (0, 4): 'white-king', (0, 5): 'white-bishop',
            (0, 6): 'white-knight', (0, 7): 'white-rook',
            (1, 0): 'white-pawn', (1, 1): 'white-pawn', (1, 2): 'white-pawn',
            (1, 3): 'white-pawn', (1, 4): 'white-pawn', (1, 5): 'white-pawn',
            (1, 6): 'white-pawn', (1, 7): 'white-pawn',
            (6, 0): 'black-pawn', (6, 1): 'black-pawn', (6, 2): 'black-pawn',
            (6, 3): 'black-pawn', (6, 4): 'black-pawn', (6, 5): 'black-pawn',
            (6, 6): 'black-pawn', (6, 7): 'black-pawn',
            (7, 0): 'black-rook', (7, 1): 'black-knight', (7, 2): 'black-bishop',
            (7, 3): 'black-queen', (7, 4): 'black-king', (7, 5): 'black-bishop',
            (7, 6): 'black-knight', (7, 7): 'black-rook'
        }
        
        # Сопоставление детекций с ожидаемыми позициями
        track_id = 0
        for (row, col), expected_class in initial_setup.items():
            # Центр ожидаемой клетки
            pt1 = square_corners[row, col]
            pt2 = square_corners[row + 1, col + 1]
            center_x = (pt1[0] + pt2[0]) / 2
            center_y = (pt1[1] + pt2[1]) / 2
            
            # Поиск ближайшей детекции этого класса
            best_detection = None
            min_distance = float('inf')
            
            for class_name, bbox, conf, class_id in detections:
                if class_name == expected_class:
                    bbox_center_x = (bbox[0] + bbox[2]) / 2
                    bbox_center_y = (bbox[1] + bbox[3]) / 2
                    distance = np.sqrt((center_x - bbox_center_x)**2 + (center_y - bbox_center_y)**2)
                    
                    if distance < min_distance and distance < 50:  # Максимальное расстояние
                        min_distance = distance
                        best_detection = (bbox, class_name)
            
            if best_detection:
                bbox, class_name = best_detection
                initial_positions[track_id] = bbox + (class_name,)
                track_id += 1
        
        self.tracker = PieceTracker(initial_positions)
        self.initial_position_set = True
        self.previous_board_state = self.tracker.get_board_state(square_corners)
    
    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Обработка одного кадра
        
        Args:
            frame: Входной кадр (BGR)
            
        Returns:
            Словарь с результатами обработки
        """
        if not self.initial_position_set:
            self.initialize_tracker(frame)
            return {
                'status': 'initialized',
                'message': 'Tracker initialized'
            }
        
        # Применяем маппинг
        from improved_board_mapping import apply_mapping
        warped = apply_mapping(frame, self.game_token, self.mapping_dir)
        
        if warped is None:
            return {
                'status': 'error',
                'message': 'Failed to apply mapping'
            }
        
        # Детекция фигур
        detections = self.detector.predict(warped)
        
        # Обновление трекера
        tracks = self.tracker.update(detections)
        
        # Получение состояния доски
        square_corners = np.array(self.mapping_data['square_corners'])
        current_board_state = self.tracker.get_board_state(square_corners)
        
        # Определение хода
        move = self._detect_move(current_board_state)
        
        result = {
            'status': 'processed',
            'tracks': {str(k): v for k, v in tracks.items()},
            'board_state': current_board_state.tolist(),
            'detections_count': len(detections)
        }
        
        if move:
            result['move'] = move.uci()
            result['move_san'] = self.virtual_board.san(move)
            
            # Обновление виртуальной доски
            self.virtual_board.push(move)
            
            # Вызов callback
            if self.on_move_detected:
                self.on_move_detected(move, current_board_state)
        
        self.previous_board_state = current_board_state.copy()
        
        return result
    
    def _detect_move(self, current_state: np.ndarray) -> Optional[chess.Move]:
        """Определение хода на основе изменения состояния доски"""
        if self.previous_board_state is None:
            return None
        
        # Находим различия
        diff = current_state - self.previous_board_state
        
        # Находим измененные клетки
        changed_squares = []
        for i in range(8):
            for j in range(8):
                if diff[i, j] != 0:
                    changed_squares.append((i, j))
        
        if len(changed_squares) != 2:
            return None  # Ход должен изменять ровно 2 клетки
        
        # Конвертация в UCI формат
        columns = list("abcdefgh")
        rows = list("87654321")
        
        squares_uci = []
        for i, j in changed_squares:
            squares_uci.append(f"{columns[j]}{rows[i]}")
        
        # Пробуем оба направления (откуда -> куда)
        for from_square, to_square in [(squares_uci[0], squares_uci[1]), (squares_uci[1], squares_uci[0])]:
            try:
                move = chess.Move.from_uci(from_square + to_square)
                if move in self.virtual_board.legal_moves:
                    return move
            except:
                continue
        
        return None
    
    def process_base64_frame(self, base64_data: str) -> Dict:
        """
        Обработка кадра в формате base64
        
        Args:
            base64_data: Base64 строка изображения
            
        Returns:
            Результат обработки
        """
        # Декодирование base64
        image_data = base64.b64decode(base64_data)
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {'status': 'error', 'message': 'Failed to decode image'}
        
        return self.process_frame(frame)

