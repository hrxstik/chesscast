"""
Обработчик потока в реальном времени для шахматной доски
"""
import cv2
import numpy as np
import json
from typing import Optional, Dict, Callable
from pathlib import Path
from model.yolo11_detector import YOLO11Detector, BoardStateMapper
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
        
        # Загрузка детектора с трекингом
        # Если модель не найдена, будет использована предобученная YOLO11n
        self.detector = None
        try:
            self.detector = YOLO11Detector(model_path)
        except (FileNotFoundError, Exception) as e:
            # Если пользовательская модель не найдена, пробуем предобученную
            import warnings
            warnings.warn(f"Custom model not found, trying pretrained YOLO11n: {str(e)}")
            try:
                self.detector = YOLO11Detector('yolo11n.pt')
            except Exception as e2:
                # Если и предобученная модель не загрузилась, работаем без детекции
                import warnings
                warnings.warn(
                    f"Could not load any model. System will work in calibration-only mode. "
                    f"Error: {str(e2)}. "
                    f"To enable piece detection, please train a model using yolo11_training.ipynb"
                )
                self.detector = None  # Режим без детекции
        
        # Загрузка маппинга доски (необязательно)
        self.mapping_data = self._load_mapping()
        if not self.mapping_data or not self.mapping_data.get('success'):
            # Маппинг не найден - работаем без маппинга (режим калибровки)
            import warnings
            warnings.warn(f"Маппинг для токена {game_token} не найден. Система будет работать без маппинга.")
            self.mapping_data = None
        
        # Маппер для преобразования треков в состояние доски
        self.board_mapper = BoardStateMapper()
        
        # Виртуальная доска для валидации ходов
        self.virtual_board = VirtualBoard()
        
        # Предыдущее состояние доски
        self.previous_board_state = None
        
        # Флаг инициализации (для первого кадра)
        self.initialized = False
        
    def _load_mapping(self) -> Optional[Dict]:
        """Загрузка данных маппинга"""
        mapping_file = self.mapping_dir / f'{self.game_token}_mapping.json'
        if not mapping_file.exists():
            return None
        
        try:
            with open(mapping_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Проверяем, что маппинг валидный
                if data.get('success') and 'square_corners' in data:
                    return data
                return None
        except Exception:
            return None
    
    
    
    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Обработка одного кадра с использованием ByteTrack трекинга
        
        Args:
            frame: Входной кадр (BGR)
            
        Returns:
            Словарь с результатами обработки
        """
        # Если маппинг не загружен, работаем без него
        if self.mapping_data is None:
            return {
                'status': 'processed',
                'tracks': {},
                'board_state': [[-1] * 8 for _ in range(8)],
                'tracks_count': 0,
                'message': 'Mapping not found. Please calibrate the board first by sending a frame with an empty board.'
            }
        
        # Применяем маппинг
        from improved_board_mapping import apply_mapping
        warped = apply_mapping(frame, self.game_token, self.mapping_dir)
        
        if warped is None:
            return {
                'status': 'error',
                'message': 'Failed to apply mapping'
            }
        
        # Трекинг фигур с использованием ByteTrack
        # persist=True сохраняет треки между кадрами
        if self.detector is None:
            # Режим без детекции - возвращаем пустой результат
            return {
                'status': 'processed',
                'tracks': {},
                'board_state': [[-1] * 8 for _ in range(8)],
                'tracks_count': 0,
                'message': 'Model not loaded. System is in calibration-only mode. Please train a model to enable piece detection.'
            }
        
        try:
            tracks = self.detector.track(warped, persist=True)
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Tracking error: {str(e)}'
            }
        
        # Преобразование треков в состояние доски
        square_corners = np.array(self.mapping_data['square_corners'])
        current_board_state = self.board_mapper.tracks_to_board_state(tracks, square_corners)
        
        # Определение хода (только если уже инициализирован)
        move = None
        if self.initialized and self.previous_board_state is not None:
            move = self._detect_move(current_board_state)
        
        # Форматирование треков для ответа
        tracks_dict = {}
        for track in tracks:
            tracks_dict[str(track['track_id'])] = {
                'bbox': track['bbox'],
                'class': track['class_name'],
                'confidence': track['confidence']
            }
        
        result = {
            'status': 'processed',
            'tracks': tracks_dict,
            'board_state': current_board_state.tolist(),
            'tracks_count': len(tracks)
        }
        
        if move:
            result['move'] = move.uci()
            result['move_san'] = self.virtual_board.san(move)
            
            # Обновление виртуальной доски
            self.virtual_board.push(move)
            
            # Вызов callback
            if self.on_move_detected:
                self.on_move_detected(move, current_board_state)
        
        # Обновление состояния
        self.previous_board_state = current_board_state.copy()
        self.initialized = True
        
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

