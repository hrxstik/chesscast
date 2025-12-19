"""
Обработчик потока в реальном времени для шахматной доски
"""
import cv2
import numpy as np
import json
import sys
from typing import Optional, Dict, Callable, List, Tuple
from collections import Counter
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

        # Ориентация доски (сырые индексы -> ориентированные, где a1 внизу слева)
        # index_map[i, j] = (i_raw, j_raw)
        self.index_map = None  # type: Optional[np.ndarray]
        
        # Стабилизация состояний доски: храним последние N состояний для усреднения
        # Каждый элемент - это tuple (board_state, confidence_map)
        self.board_state_history = []  # type: List[Tuple[np.ndarray, np.ndarray]]
        self.history_size = 10  # Увеличено количество кадров для стабилизации (было 5)
        
        # Стабилизация ходов: ход должен быть стабильным в нескольких кадрах
        self.pending_move = None  # type: Optional[chess.Move]
        self.pending_move_frames = 0
        self.move_confirmation_frames = 7  # Увеличено количество кадров для подтверждения хода (было 3)
        
        # Предотвращение откатов: храним последний подтвержденный ход
        self.last_confirmed_move = None  # type: Optional[chess.Move]
        self.move_lock_frames = 0  # Количество кадров после подтверждения хода, в течение которых игнорируем изменения
        self.move_lock_duration = 10  # Количество кадров, в течение которых игнорируем изменения после подтверждения хода
        
    def _load_mapping(self) -> Optional[Dict]:
        """Загрузка данных маппинга"""
        mapping_file = self.mapping_dir / f'{self.game_token}_mapping.json'
        
        # Логирование для отладки
        import warnings
        warnings.warn(f"Loading mapping from: {mapping_file.absolute()}, exists: {mapping_file.exists()}")
        
        if not mapping_file.exists():
            warnings.warn(f"Mapping file not found: {mapping_file.absolute()}")
            return None
        
        try:
            with open(mapping_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Проверяем, что маппинг валидный
                if data.get('success') and 'square_corners' in data:
                    # Если в маппинге уже есть готовый index_map (ручная ориентация),
                    # загружаем его сразу
                    if 'index_map' in data:
                        index_map_data = np.array(data['index_map'], dtype=np.int32)
                        self.index_map = index_map_data
                    warnings.warn(f"Mapping loaded successfully for token {self.game_token}")
                    return data
                else:
                    warnings.warn(f"Mapping file exists but invalid: success={data.get('success')}, has square_corners={'square_corners' in data}")
                return None
        except Exception as e:
            warnings.warn(f"Error loading mapping: {str(e)}")
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
                'message': 'Mapping not found. Please calibrate the board first by sending a frame with an empty board.',
                'detections_info': {
                    'total_detections': 0,
                    'message': 'Mapping not found, detection skipped'
                }
            }
        
        # Применяем маппинг
        from improved_board_mapping import apply_mapping
        warped = apply_mapping(frame, self.game_token, self.mapping_dir)
        
        if warped is None:
            return {
                'status': 'error',
                'message': 'Failed to apply mapping'
            }
        
        # Визуализация маппинга для отладки (только при первом кадре после инициализации)
        if not hasattr(self, '_mapping_visualized') and self.mapping_data:
            self._visualize_mapping(frame, warped)
            self._mapping_visualized = True
        
        # Трекинг фигур с использованием ByteTrack
        # persist=True сохраняет треки между кадрами
        if self.detector is None:
            # Режим без детекции - возвращаем пустой результат
            return {
                'status': 'processed',
                'tracks': {},
                'board_state': [[-1] * 8 for _ in range(8)],
                'tracks_count': 0,
                'message': 'Model not loaded. System is in calibration-only mode. Please train a model to enable piece detection.',
                'detections_info': {
                    'total_detections': 0,
                    'message': 'Model not loaded, detection disabled'
                }
            }
        
        try:
            # Детекция идет на warped изображении (после перспективной трансформации)
            # Warped - это трансформированное изображение, где доска выровнена в квадрат
            # Фигуры НЕ обрезаются, потому что трансформация сохраняет все содержимое доски
            # (просто меняет перспективу). Это правильно, так как фигуры на краях остаются видимыми
            tracks = self.detector.track(warped, persist=True)
            
            # Фильтрация по confidence - не используем детекции с низкой уверенностью
            # Это помогает стабилизировать детекции и избежать ложных срабатываний
            min_confidence = 0.35  # Минимальный порог уверенности (было 0.25 в детекторе)
            filtered_tracks = [
                track for track in tracks 
                if track['confidence'] >= min_confidence
            ]
            
            # Фильтрация детекций вне границ доски
            # Учитываем, что фигуры на краях могут быть частично обрезаны из-за угла камеры
            # Поэтому фильтруем только те детекции, которые полностью вне границ доски
            if self.mapping_data and 'square_corners' in self.mapping_data:
                square_corners = np.array(self.mapping_data['square_corners'])
                # Границы доски - это крайние углы сетки клеток
                board_min_x = float(square_corners[:, :, 0].min())
                board_max_x = float(square_corners[:, :, 0].max())
                board_min_y = float(square_corners[:, :, 1].min())
                board_max_y = float(square_corners[:, :, 1].max())
                
                # Добавляем небольшой запас (5% от размера) для фигур на краях
                margin_x = (board_max_x - board_min_x) * 0.05
                margin_y = (board_max_y - board_min_y) * 0.05
                
                board_filtered_tracks = []
                for track in filtered_tracks:
                    x1, y1, x2, y2 = track['bbox']
                    # Центр bbox
                    center_x = (x1 + x2) / 2.0
                    center_y = (y1 + y2) / 2.0
                    
                    # Проверяем, находится ли центр детекции в пределах доски (с запасом)
                    # Это позволяет учитывать фигуры на краях, которые могут быть частично обрезаны
                    if (board_min_x - margin_x <= center_x <= board_max_x + margin_x and
                        board_min_y - margin_y <= center_y <= board_max_y + margin_y):
                        board_filtered_tracks.append(track)
                
                filtered_tracks = board_filtered_tracks
            
            # Детекция руки (простая проверка - если есть большие объекты в верхней части кадра)
            # Можно улучшить, добавив специальную модель для детекции руки
            hand_detected = self._detect_hand_simple(warped, filtered_tracks)
            
            # Логирование детекций для отладки
            detections_info = {
                'total_detections': len(tracks),
                'filtered_detections': len(filtered_tracks),
                'hand_detected': False,  # Будет установлено ниже
                'classes_detected': {},
                'detections_by_class': {}
            }
            
            for track in filtered_tracks:
                class_name = track['class_name']
                confidence = track['confidence']
                
                # Подсчет по классам
                if class_name not in detections_info['classes_detected']:
                    detections_info['classes_detected'][class_name] = 0
                    detections_info['detections_by_class'][class_name] = []
                
                detections_info['classes_detected'][class_name] += 1
                detections_info['detections_by_class'][class_name].append({
                    'track_id': track['track_id'],
                    'confidence': round(confidence, 3),
                    'bbox': track['bbox']
                })
            
            # Детекция руки (простая проверка - если есть большие объекты в верхней части кадра)
            hand_detected = self._detect_hand_simple(warped, filtered_tracks)
            detections_info['hand_detected'] = hand_detected
            
            # Логирование детекций убрано - дублируется в NestJS
                
        except Exception as e:
            print(f"❌ [DETECTION] Tracking error: {str(e)}", file=sys.stderr, flush=True)
            return {
                'status': 'error',
                'message': f'Tracking error: {str(e)}',
                'detections_info': {
                    'total_detections': 0,
                    'error': str(e)
                }
            }
        
        # Преобразование треков в состояние доски (сырая сетка)
        square_corners = np.array(self.mapping_data['square_corners'])
        
        # Если рука обнаружена, не обновляем состояние доски - используем предыдущее стабилизированное
        if hand_detected:
            # Используем последнее стабилизированное состояние из истории
            if len(self.board_state_history) > 0:
                current_board_state = self.board_state_history[-1][0].copy()  # Берем только board_state
            elif self.previous_board_state is not None:
                current_board_state = self.previous_board_state.copy()
            else:
                # Если нет истории, используем текущее (но не обновляем)
                board_state_raw, _ = self.board_mapper.tracks_to_board_state(filtered_tracks, square_corners)
                if self.index_map is not None:
                    current_board_state = self._apply_index_map(board_state_raw)
                else:
                    current_board_state = board_state_raw
        else:
            # Нормальная обработка - маппинг треков на доску
            board_state_raw = self.board_mapper.tracks_to_board_state(filtered_tracks, square_corners)
            # BoardStateMapper возвращает только board_state, без confidence_map
            confidence_map_raw = None

            # Если ориентация ещё не определена, пробуем авто-детекцию для стартовой позиции
            if self.index_map is None:
                self._try_init_orientation(board_state_raw)

            # Применяем ориентацию, если index_map уже есть
            if self.index_map is not None:
                current_board_state_raw = self._apply_index_map(board_state_raw)
            else:
                # Фолбек: работаем в сырой системе, если ориентация не определена
                current_board_state_raw = board_state_raw
            
            # BoardStateMapper не возвращает confidence_map, создаем пустой
            current_confidence_map_raw = np.zeros((8, 8), dtype=np.float32)
            
            # Стабилизация состояния доски: добавляем в историю и усредняем
            self.board_state_history.append((current_board_state_raw.copy(), current_confidence_map_raw.copy()))
            if len(self.board_state_history) > self.history_size:
                self.board_state_history.pop(0)
            
            # Усредняем состояние доски по истории (взвешенное голосование по каждому квадрату)
            current_board_state = self._stabilize_board_state(self.board_state_history)
        
        # Определение хода (только если уже инициализирован, в ориентированной системе)
        move = None
        if self.initialized and self.previous_board_state is not None:
            move = self._detect_move_stable(current_board_state)
        
        # Счетчик кадров для периодического логирования
        if not hasattr(self, '_frame_count'):
            self._frame_count = 0
        self._frame_count += 1
        
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
            'tracks_count': len(tracks),
            'detections_info': detections_info  # Добавляем информацию о детекциях
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
        # Обновляем previous_board_state всегда на стабилизированное состояние
        # Это позволяет сравнивать стабилизированные состояния между кадрами
        # Инициализация previous_board_state при первом кадре
        if self.previous_board_state is None:
            self.previous_board_state = current_board_state.copy()
        else:
            self.previous_board_state = current_board_state.copy()

        if not self.initialized:
            self.initialized = True
            filled_count = np.sum(current_board_state != -1)
        
        return result
    
    def _stabilize_board_state(self, history: List[Tuple[np.ndarray, np.ndarray]]) -> np.ndarray:
        """
        Стабилизация состояния доски путем взвешенного голосования по каждому квадрату
        Использует confidence для взвешивания голосов: weight = confidence * count
        
        Args:
            history: Список кортежей (board_state, confidence_map)
        
        Returns:
            Стабилизированное состояние доски (8x8 массив с piece_id)
        """
        if not history:
            return np.ones((8, 8), dtype=np.int32) * -1
        
        stabilized = np.ones((8, 8), dtype=np.int32) * -1
        
        for i in range(8):
            for j in range(8):
                # Собираем все значения и их confidence для этой клетки из истории
                value_confidence_pairs = []
                for board_state, confidence_map in history:
                    piece_id = board_state[i, j]
                    confidence = confidence_map[i, j]
                    if piece_id != -1:  # Только непустые клетки
                        value_confidence_pairs.append((piece_id, confidence))
                
                if not value_confidence_pairs:
                    stabilized[i, j] = -1
                    continue
                
                # Группируем по piece_id и суммируем confidence (взвешенное голосование)
                weighted_votes = {}  # piece_id -> сумма confidence
                for piece_id, confidence in value_confidence_pairs:
                    if piece_id not in weighted_votes:
                        weighted_votes[piece_id] = 0.0
                    weighted_votes[piece_id] += confidence
                
                # Выбираем piece_id с максимальным взвешенным голосом
                if weighted_votes:
                    best_piece_id = max(weighted_votes.items(), key=lambda x: x[1])[0]
                    best_weight = weighted_votes[best_piece_id]
                    
                    # Вычисляем общий вес всех голосов
                    total_weight = sum(weighted_votes.values())
                    
                    # Используем значение только если его вес >= 60% от общего веса
                    if best_weight >= total_weight * 0.6:
                        stabilized[i, j] = best_piece_id
                    elif len(history) >= 5 and len(weighted_votes) > 1:
                        # Если история большая и есть несколько вариантов, проверяем второй
                        sorted_votes = sorted(weighted_votes.items(), key=lambda x: x[1], reverse=True)
                        second_weight = sorted_votes[1][1]
                        
                        # Если первый вариант значительно лучше второго, используем его
                        if best_weight > second_weight * 1.5:  # На 50% больше
                            stabilized[i, j] = best_piece_id
                        else:
                            # Неопределенность - используем последнее значение
                            stabilized[i, j] = value_confidence_pairs[-1][0]
                    else:
                        # Если история маленькая или один вариант, используем последнее значение
                        stabilized[i, j] = value_confidence_pairs[-1][0]
                else:
                    stabilized[i, j] = -1
        
        return stabilized
    
    def _detect_move_stable(self, current_state: np.ndarray) -> Optional[chess.Move]:
        """
        Определение хода с проверкой стабильности изменений
        Ход должен быть стабильным в нескольких кадрах подряд
        """
        if self.previous_board_state is None:
            return None
        
        # Если недавно был подтвержден ход, игнорируем изменения в течение нескольких кадров
        # Это предотвращает откаты ходов из-за нестабильных детекций
        if self.move_lock_frames > 0:
            self.move_lock_frames -= 1
            # Обновляем previous_board_state на текущее, чтобы игнорировать изменения
            self.previous_board_state = current_state.copy()
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
            # Если изменений не 2 клетки, сбрасываем ожидаемый ход
            self.pending_move = None
            self.pending_move_frames = 0
            return None
        
        # Конвертация в UCI формат
        columns = list("abcdefgh")
        rows = list("87654321")
        
        squares_uci = []
        for i, j in changed_squares:
            squares_uci.append(f"{columns[j]}{rows[i]}")
        
        # Пробуем оба направления (откуда -> куда)
        detected_move = None
        invalid_moves = []
        for from_square, to_square in [(squares_uci[0], squares_uci[1]), (squares_uci[1], squares_uci[0])]:
            try:
                move = chess.Move.from_uci(from_square + to_square)
                if move in self.virtual_board.legal_moves:
                    detected_move = move
                    break
                else:
                    invalid_moves.append(f"{from_square}{to_square}")
            except Exception as e:
                invalid_moves.append(f"{from_square}{to_square}(error: {str(e)})")
        
        if detected_move is None:
            # Ход невалидный, сбрасываем ожидание
            self.pending_move = None
            self.pending_move_frames = 0
            return None
        
        # Проверяем стабильность хода
        if self.pending_move == detected_move:
            # Тот же ход, увеличиваем счетчик
            self.pending_move_frames += 1
            if self.pending_move_frames >= self.move_confirmation_frames:
                # Ход подтвержден, возвращаем его и сбрасываем ожидание
                confirmed_move = self.pending_move
                self.last_confirmed_move = confirmed_move
                self.move_lock_frames = self.move_lock_duration  # Блокируем изменения на несколько кадров
                self.pending_move = None
                self.pending_move_frames = 0
                # Обновляем previous_board_state на текущее состояние, чтобы предотвратить откат
                self.previous_board_state = current_state.copy()
                return confirmed_move
        else:
            # Новый ход, начинаем отсчет заново
            self.pending_move = detected_move
            self.pending_move_frames = 1
        
        return None
    
    def _detect_move(self, current_state: np.ndarray) -> Optional[chess.Move]:
        """Старый метод детекции хода (deprecated, используйте _detect_move_stable)"""
        return self._detect_move_stable(current_state)

    # ==================== Ориентация доски ====================

    def _get_canonical_start_board(self) -> np.ndarray:
        """
        Каноническая стартовая позиция в ориентированной системе:
        - белые снизу (ряды 6 и 7)
        - a1 внизу слева (индекс [7, 0])
        """
        # Идентификаторы фигур как в BoardStateMapper.piece_class_to_id
        EMPTY = -1
        WHITE_PAWN = 0
        WHITE_ROOK = 1
        WHITE_BISHOP = 2
        WHITE_KNIGHT = 3
        WHITE_KING = 4
        WHITE_QUEEN = 5
        BLACK_PAWN = 6
        BLACK_ROOK = 7
        BLACK_BISHOP = 8
        BLACK_KNIGHT = 11
        BLACK_KING = 9
        BLACK_QUEEN = 10

        board = np.ones((8, 8), dtype=np.int32) * EMPTY

        # Чёрные фигуры (верх)
        board[0, :] = [
            BLACK_ROOK,
            BLACK_KNIGHT,
            BLACK_BISHOP,
            BLACK_QUEEN,
            BLACK_KING,
            BLACK_BISHOP,
            BLACK_KNIGHT,
            BLACK_ROOK,
        ]
        board[1, :] = [BLACK_PAWN] * 8

        # Белые фигуры (низ)
        board[6, :] = [WHITE_PAWN] * 8
        board[7, :] = [
            WHITE_ROOK,
            WHITE_KNIGHT,
            WHITE_BISHOP,
            WHITE_QUEEN,
            WHITE_KING,
            WHITE_BISHOP,
            WHITE_KNIGHT,
            WHITE_ROOK,
        ]
        return board

    def _detect_hand_simple(self, warped_image: np.ndarray, tracks: List[Dict]) -> bool:
        """
        Простая детекция руки или больших посторонних объектов в кадре.
        
        Методы:
        1. Проверка больших объектов в любой части кадра (рука, рукав, посторонние предметы)
        2. Проверка очень больших bbox, которые могут быть рукой или чем-то посторонним
        
        Args:
            warped_image: Выровненное изображение доски
            tracks: Список треков фигур
        
        Returns:
            True если большой объект обнаружен, False иначе
        """
        h, w = warped_image.shape[:2]
        image_area = h * w
        
        # Проверяем все треки на наличие больших объектов в любой части кадра
        for track in tracks:
            x1, y1, x2, y2 = track['bbox']
            bbox_area = (x2 - x1) * (y2 - y1)
            
            # Большой объект (больше 8% площади кадра) - вероятно рука, рукав или посторонний предмет
            # Шахматные фигуры обычно занимают 1-3% площади кадра
            if bbox_area > image_area * 0.08:
                return True
        
        return False
    
    def _score_orientation(self, observed: np.ndarray, canonical: np.ndarray) -> float:
        """
        Оценка совпадения наблюдаемой позиции с канонической:
        считаем долю клеток, где стоит нужная фигура.
        """
        matches = 0
        total = 0
        for i in range(8):
            for j in range(8):
                can = canonical[i, j]
                if can == -1:
                    continue  # пустые клетки не учитываем
                total += 1
                if observed[i, j] == can:
                    matches += 1
        if total == 0:
            return 0.0
        return matches / total

    def _try_init_orientation(self, board_state_raw: np.ndarray, threshold: float = 0.5) -> None:
        """
        Попытка автоматически определить ориентацию для стартовой позиции.
        Рассматриваем текущий board_state_raw как одну из двух ориентаций:
        - identity (как есть)
        - rot180 (поворот на 180 градусов)

        Если совпадение с канонической стартовой позицией достигает порога,
        строим index_map для выбранной ориентации.
        """
        canonical = self._get_canonical_start_board()

        # Кандидатные ориентации: identity и rot180
        candidates = []

        # identity
        candidates.append(('identity', board_state_raw))

        # rot180: переворачиваем по обоим осям
        candidates.append(('rot180', board_state_raw[::-1, ::-1]))

        best_orientation = None
        best_score = 0.0

        for name, state_oriented in candidates:
            score = self._score_orientation(state_oriented, canonical)
            print(f"[ORIENTATION] {name} score: {score:.3f}", file=sys.stderr, flush=True)
            if score > best_score:
                best_score = score
                best_orientation = name

        print(f"[ORIENTATION] Best: {best_orientation}, score: {best_score:.3f}, threshold: {threshold}", file=sys.stderr, flush=True)

        if best_orientation is None or best_score < threshold:
            # Автоматическую ориентацию определить не удалось —
            # оставляем index_map = None, позже можно будет добавить
            # ручное задание a1.
            print(f"[ORIENTATION] Auto-orientation failed (score {best_score:.3f} < {threshold})", file=sys.stderr, flush=True)
            return

        # Строим index_map для найденной ориентации:
        # index_map[i_oriented, j_oriented] = (i_raw, j_raw)
        index_map = np.zeros((8, 8, 2), dtype=np.int32)

        if best_orientation == 'identity':
            for i in range(8):
                for j in range(8):
                    index_map[i, j] = (i, j)
        elif best_orientation == 'rot180':
            for i in range(8):
                for j in range(8):
                    # Ориентированная клетка (i,j) соответствует сырой (7-i, 7-j)
                    index_map[i, j] = (7 - i, 7 - j)
        else:
            # На всякий случай, если появятся другие ориентации
            return

        self.index_map = index_map
        print(f"[ORIENTATION] Auto-orientation succeeded: {best_orientation}", file=sys.stderr, flush=True)

    def _visualize_mapping(self, original_frame: np.ndarray, warped_frame: np.ndarray) -> None:
        """
        Визуализация маппинга для отладки - сохраняет изображения с нарисованными границами
        """
        try:
            import cv2
            
            # Визуализация исходного изображения с границами доски
            vis_original = original_frame.copy()
            if 'board_corners' in self.mapping_data:
                board_corners = np.array(self.mapping_data['board_corners'], dtype=np.int32)
                # Рисуем границы доски
                cv2.polylines(vis_original, [board_corners], True, (0, 255, 0), 3)
                # Рисуем углы
                for i, corner in enumerate(board_corners):
                    cv2.circle(vis_original, tuple(corner), 10, (255, 0, 0), -1)
                    cv2.putText(vis_original, f'{i}', tuple(corner + 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Визуализация warped изображения с границами клеток
            vis_warped = warped_frame.copy()
            if 'square_corners' in self.mapping_data:
                square_corners = np.array(self.mapping_data['square_corners'], dtype=np.int32)
                # Рисуем границы всех клеток
                for i in range(9):
                    for j in range(9):
                        if i < 8 and j < 8:
                            # Углы клетки
                            pt1 = tuple(square_corners[i, j])
                            pt2 = tuple(square_corners[i, j + 1])
                            pt3 = tuple(square_corners[i + 1, j + 1])
                            pt4 = tuple(square_corners[i + 1, j])
                            
                            # Рисуем границы клетки
                            cv2.line(vis_warped, pt1, pt2, (0, 255, 0), 1)
                            cv2.line(vis_warped, pt2, pt3, (0, 255, 0), 1)
                            cv2.line(vis_warped, pt3, pt4, (0, 255, 0), 1)
                            cv2.line(vis_warped, pt4, pt1, (0, 255, 0), 1)
                            
                            # Подписи клеток (a1, b1, etc.)
                            if i == 7 and j < 8:  # Нижний ряд (белые)
                                center = ((pt1[0] + pt3[0]) // 2, (pt1[1] + pt3[1]) // 2)
                                columns = list("abcdefgh")
                                cv2.putText(vis_warped, columns[j], (center[0] - 10, center[1]), 
                                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
            
            # Сохраняем визуализации
            vis_original_path = self.mapping_dir / f'{self.game_token}_mapping_original_vis.jpg'
            vis_warped_path = self.mapping_dir / f'{self.game_token}_mapping_warped_vis.jpg'
            
            cv2.imwrite(str(vis_original_path), vis_original)
            cv2.imwrite(str(vis_warped_path), vis_warped)
            
            print(f"📊 [VISUALIZATION] Mapping visualization saved: {vis_original_path} and {vis_warped_path}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"⚠️ [VISUALIZATION] Failed to visualize mapping: {str(e)}", file=sys.stderr, flush=True)
    
    def _apply_index_map(self, board_state_raw: np.ndarray) -> np.ndarray:
        """
        Применение index_map к сырому состоянию доски.
        Возвращает ориентированную доску (белые снизу, a1 внизу слева).
        """
        if self.index_map is None:
            return board_state_raw

        oriented = np.ones_like(board_state_raw)
        for i in range(8):
            for j in range(8):
                ir, jr = self.index_map[i, j]
                oriented[i, j] = board_state_raw[ir, jr]
        return oriented
    
    def _apply_index_map_to_confidence(self, confidence_map_raw: np.ndarray) -> np.ndarray:
        """
        Применение index_map к confidence_map (та же трансформация что и для board_state).
        """
        if self.index_map is None:
            return confidence_map_raw

        oriented = np.zeros_like(confidence_map_raw)
        for i in range(8):
            for j in range(8):
                ir, jr = self.index_map[i, j]
                oriented[i, j] = confidence_map_raw[ir, jr]
        return oriented

