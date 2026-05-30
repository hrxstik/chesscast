"""
Обработчик потока в реальном времени для шахматной доски
"""
import cv2
import numpy as np
import json
import sys
from typing import Any, Optional, Dict, Callable, List, Tuple
from collections import Counter
from pathlib import Path
from model.yolo11_detector import YOLO11Detector, BoardStateMapper
from model.hand_detector import detect_hand_on_board
import chess

# ID фигур (как в BoardStateMapper / virtual_board)
_PIECE_ID_TO_SYMBOL = {
    0: 'P', 1: 'R', 2: 'B', 3: 'N', 4: 'K', 5: 'Q',
    6: 'p', 7: 'r', 8: 'b', 11: 'n', 9: 'k', 10: 'q',
}


class StreamProcessor:
    """Обработчик потока кадров в реальном времени"""
    
    def __init__(self, 
                 model_path: str,
                 game_token: str,
                 mapping_dir: Path = Path('./chessboard_mappings'),
                 on_move_detected: Optional[Callable] = None,
                 detector: Optional[YOLO11Detector] = None):
        """
        Инициализация обработчика потока
        
        Args:
            model_path: Путь к модели YOLO 11 (игнорируется, если передан detector)
            game_token: Токен игры
            mapping_dir: Директория с маппингами
            on_move_detected: Callback функция при обнаружении хода
            detector: Общий экземпляр YOLO (для inference-воркера)
        """
        self.game_token = game_token
        self.mapping_dir = mapping_dir
        self.on_move_detected = on_move_detected
        
        if detector is not None:
            self.detector = detector
        else:
            self.detector = None
            try:
                self.detector = YOLO11Detector(model_path)
            except (FileNotFoundError, Exception) as e:
                import warnings
                warnings.warn(f"Custom model not found, trying pretrained YOLO11n: {str(e)}")
                try:
                    self.detector = YOLO11Detector('yolo11n.pt')
                except Exception as e2:
                    import warnings
                    warnings.warn(
                        f"Could not load any model. System will work in calibration-only mode. "
                        f"Error: {str(e2)}."
                    )
                    self.detector = None
        
        # Загрузка маппинга доски (необязательно)
        self.mapping_data = self._load_mapping()
        if not self.mapping_data or not self.mapping_data.get('success'):
            # Маппинг не найден - работаем без маппинга (режим калибровки)
            import warnings
            warnings.warn(f"Маппинг для токена {game_token} не найден. Система будет работать без маппинга.")
            self.mapping_data = None
        
        # Маппер для преобразования треков в состояние доски
        self.board_mapper = BoardStateMapper()
        
        # Ориентация доски (сырые индексы -> ориентированные, где a1 внизу слева)
        self.index_map = None  # type: Optional[np.ndarray]

        # Голосование: 10 кадров @ 10 FPS → один снимок позиции на фронт
        self.board_state_history = []  # type: List[Tuple[np.ndarray, np.ndarray]]
        self.history_size = 10
        self.snapshot_vote_min = 6  # ≥60% кадров за клетку (6 из 10)
        self.hand_landmarks_inside_min = 1
        
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
    
    
    
    def _hand_detections_info(
        self,
        hand_result,
        hand_detected: bool,
    ) -> Dict[str, Any]:
        return {
            'total_detections': 0,
            'hand_detected': hand_detected,
            'hand_raw_detected': hand_result.detected,
            'hand_landmarks_inside': hand_result.landmarks_inside,
            'hand_hands_seen': hand_result.hands_seen,
            'hand_mediapipe_available': hand_result.available,
        }

    def _history_hand_info(
        self,
        hand_result,
        *,
        history_frozen: bool,
    ) -> Dict[str, Any]:
        hand_detected = (
            hand_result.available
            and hand_result.landmarks_inside >= self.hand_landmarks_inside_min
        )
        return {
            **self._hand_detections_info(hand_result, hand_detected),
            'history_frozen': history_frozen,
            'history_frames': len(self.board_state_history),
            'history_target': self.history_size,
        }

    def process_frame(self, frame: np.ndarray, *, hand_probe_only: bool = False) -> Dict:
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
        
        # Визуализация маппинга отключена - файлы _mapping_original_vis и _mapping_warped_vis не нужны
        # Визуализация уже есть в calibration_result.jpg
        # if not hasattr(self, '_mapping_visualized') and self.mapping_data:
        #     self._visualize_mapping(frame, warped)
        #     self._mapping_visualized = True
        
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

        square_corners_grid = np.array(self.mapping_data['square_corners'])
        hand_result = detect_hand_on_board(
            warped,
            square_corners_grid,
            min_landmarks_inside=self.hand_landmarks_inside_min,
        )
        hand_on_board = (
            hand_result.available
            and hand_result.landmarks_inside >= self.hand_landmarks_inside_min
        )

        if hand_probe_only or hand_on_board:
            if hand_on_board:
                self.board_state_history.clear()
            return {
                'status': 'processed',
                'board_snapshot': False,
                'history_frozen': hand_on_board,
                'hand_detected': hand_on_board,
                'detections_info': self._history_hand_info(
                    hand_result,
                    history_frozen=hand_on_board,
                ),
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

            tracks_for_board = filtered_tracks

            detections_info = {
                **self._history_hand_info(hand_result, history_frozen=False),
                'total_detections': len(tracks),
                'filtered_detections': len(filtered_tracks),
                'board_mapped_detections': len(tracks_for_board),
                'classes_detected': {},
                'detections_by_class': {},
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
        
        board_state_raw = self.board_mapper.tracks_to_board_state(
            tracks_for_board, square_corners_grid,
        )

        if self.index_map is None:
            tracks_for_orientation = (
                board_filtered_tracks
                if 'board_filtered_tracks' in locals()
                else tracks_for_board
            )
            self._try_init_orientation(
                board_state_raw, tracks=tracks_for_orientation,
            )

        if self.index_map is not None:
            current_board_state = self._apply_index_map(board_state_raw)
        else:
            current_board_state = board_state_raw

        confidence_map = np.zeros((8, 8), dtype=np.float32)
        for i in range(8):
            for j in range(8):
                if current_board_state[i, j] != -1:
                    confidence_map[i, j] = 1.0

        self.board_state_history.append(
            (current_board_state.copy(), confidence_map.copy()),
        )

        history_frames = len(self.board_state_history)
        if history_frames < self.history_size:
            return {
                'status': 'processed',
                'board_snapshot': False,
                'history_frozen': False,
                'hand_detected': False,
                'detections_info': detections_info,
            }

        voted_state = self._stabilize_board_state(self.board_state_history)
        self.board_state_history.clear()

        tracks_dict = {
            str(track['track_id']): {
                'bbox': track['bbox'],
                'class': track['class_name'],
                'confidence': track['confidence'],
            }
            for track in tracks
        }

        return {
            'status': 'processed',
            'board_snapshot': True,
            'history_frozen': False,
            'hand_detected': False,
            'tracks': tracks_dict,
            'board_state': voted_state.tolist(),
            'tracks_count': len(tracks),
            'detections_info': detections_info,
        }
    
    def _stabilize_board_state(self, history: List[Tuple[np.ndarray, np.ndarray]]) -> np.ndarray:
        """
        Голосование по клетке: пусто (-1) и фигуры считаются одинаково (все 10 кадров).
        """
        if not history:
            return np.ones((8, 8), dtype=np.int32) * -1

        frame_count = len(history)
        min_votes = min(self.snapshot_vote_min, frame_count)
        stabilized = np.ones((8, 8), dtype=np.int32) * -1

        for i in range(8):
            for j in range(8):
                votes = Counter()
                for board_state, _confidence_map in history:
                    votes[int(board_state[i, j])] += 1

                best_piece_id, best_count = votes.most_common(1)[0]
                if best_count >= min_votes:
                    stabilized[i, j] = int(best_piece_id)

        return stabilized

    def _board_state_to_chess_board(self, state: np.ndarray) -> Optional[chess.Board]:
        """Конвертация 8×8 ID в chess.Board (ряд 0 = 8-я горизонталь)."""
        board = chess.Board()
        board.clear_board()
        has_white_king = False
        has_black_king = False
        for i in range(8):
            for j in range(8):
                piece_id = int(state[i, j])
                if piece_id < 0:
                    continue
                symbol = _PIECE_ID_TO_SYMBOL.get(piece_id)
                if not symbol:
                    continue
                rank = 8 - i
                square = chess.square(j, rank - 1)
                try:
                    board.set_piece_at(square, chess.Piece.from_symbol(symbol))
                except ValueError:
                    return None
                if symbol == 'K':
                    has_white_king = True
                elif symbol == 'k':
                    has_black_king = True
        if not has_white_king or not has_black_king:
            return None
        board.turn = chess.WHITE
        return board

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

    def _apply_orientation(self, board_state: np.ndarray, orientation: str) -> np.ndarray:
        """
        Применяет поворот к board_state в зависимости от ориентации.
        
        Args:
            board_state: Массив 8x8 с состояниями клеток
            orientation: 'identity', 'rot90', 'rot180', 'rot270'
        
        Returns:
            Повернутый массив board_state
        """
        if orientation == 'identity':
            return board_state
        elif orientation == 'rot90':
            # Поворот на 90° по часовой стрелке: транспонируем и инвертируем строки
            return np.flipud(board_state.T)
        elif orientation == 'rot180':
            # Поворот на 180°: инвертируем и строки и столбцы
            return board_state[::-1, ::-1]
        elif orientation == 'rot270':
            # Поворот на 270° по часовой (или 90° против): транспонируем и инвертируем столбцы
            return np.fliplr(board_state.T)
        else:
            return board_state
    
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

    def _try_init_orientation(self, board_state_raw: np.ndarray, threshold: float = 0.5, tracks: list = None) -> None:
        """
        Попытка автоматически определить ориентацию для стартовой позиции.
        Использует bbox белых фигур для определения, где белые ближе к краю.
        Поддерживает 4 ориентации: identity, rot90, rot180, rot270
        (камера может быть со стороны белых, черных, справа или слева).
        """
        canonical = self._get_canonical_start_board()

        # Определяем ориентацию по bbox белых фигур
        # Если tracks доступны, используем их для определения где белые ближе к краю
        orientation_from_bbox = False
        if tracks:
            white_pieces_coords = []  # [(center_x, center_y), ...]
            h, w = None, None
            
            # Получаем размеры warped изображения из mapping_data
            if self.mapping_data and 'square_corners' in self.mapping_data:
                square_corners = np.array(self.mapping_data['square_corners'])
                h = int(square_corners[:, :, 1].max())
                w = int(square_corners[:, :, 0].max())
            
            for track in tracks:
                class_name = track.get('class_name', '')
                # Белые фигуры: white-pawn, white-rook, white-bishop, white-knight, white-king, white-queen
                if class_name.startswith('white-'):
                    x1, y1, x2, y2 = track['bbox']
                    # Используем центр bbox
                    center_x = (x1 + x2) / 2.0
                    center_y = (y1 + y2) / 2.0
                    white_pieces_coords.append((center_x, center_y))
            
            if white_pieces_coords and h and w:
                # Средние координаты белых фигур
                avg_white_x = np.mean([c[0] for c in white_pieces_coords])
                avg_white_y = np.mean([c[1] for c in white_pieces_coords])
                
                # Середина изображения
                mid_x = w / 2.0
                mid_y = h / 2.0
                
                # Определяем квадрант где больше белых фигур
                # Квадранты:
                #   Верхний левый (Y < mid_y, X < mid_x)  → rot90
                #   Верхний правый (Y < mid_y, X > mid_x) → rot180
                #   Нижний левый (Y > mid_y, X < mid_x)   → identity
                #   Нижний правый (Y > mid_y, X > mid_x)  → rot270
                
                if avg_white_y < mid_y:  # Верхняя половина
                    if avg_white_x < mid_x:  # Левая половина
                        best_orientation = 'rot90'   # Камера слева
                    else:  # Правая половина
                        best_orientation = 'rot180'  # Камера со стороны черных
                else:  # Нижняя половина
                    if avg_white_x < mid_x:  # Левая половина
                        best_orientation = 'identity'  # Камера со стороны белых
                    else:  # Правая половина
                        best_orientation = 'rot270'    # Камера справа
                
                print(f"[ORIENTATION] Using bbox: {len(white_pieces_coords)} white pieces, avg (X, Y): ({avg_white_x:.1f}, {avg_white_y:.1f}), mid (X, Y): ({mid_x:.1f}, {mid_y:.1f}), selected: {best_orientation}", file=sys.stderr, flush=True)
                
                # Проверяем score для выбранной ориентации
                state_oriented = self._apply_orientation(board_state_raw, best_orientation)
                best_score = self._score_orientation(state_oriented, canonical)
                orientation_from_bbox = True
                print(f"[ORIENTATION] Selected {best_orientation} based on bbox, score: {best_score:.3f}", file=sys.stderr, flush=True)
            else:
                # Fallback: используем старую логику по board_state (только identity и rot180)
                best_orientation = None
                best_score = 0.0
                candidates = [
                    ('identity', board_state_raw),
                    ('rot180', board_state_raw[::-1, ::-1])
                ]
                
                for name, state_oriented in candidates:
                    score = self._score_orientation(state_oriented, canonical)
                    white_pieces_bottom = np.sum((state_oriented[4:8, :] >= 0) & (state_oriented[4:8, :] <= 5))
                    white_pieces_top = np.sum((state_oriented[0:4, :] >= 0) & (state_oriented[0:4, :] <= 5))
                    
                    print(f"[ORIENTATION] {name} score: {score:.3f} (whites bottom [4-7]: {white_pieces_bottom}, top [0-3]: {white_pieces_top})", file=sys.stderr, flush=True)
                    
                    if white_pieces_bottom > white_pieces_top:
                        if score > best_score:
                            best_score = score
                            best_orientation = name
                    elif white_pieces_bottom == white_pieces_top:
                        if score > best_score:
                            best_score = score
                            best_orientation = name
        else:
            # Fallback: используем старую логику по board_state (только identity и rot180)
            best_orientation = None
            best_score = 0.0
            candidates = [
                ('identity', board_state_raw),
                ('rot180', board_state_raw[::-1, ::-1])
            ]
            
            for name, state_oriented in candidates:
                score = self._score_orientation(state_oriented, canonical)
                white_pieces_bottom = np.sum((state_oriented[4:8, :] >= 0) & (state_oriented[4:8, :] <= 5))
                white_pieces_top = np.sum((state_oriented[0:4, :] >= 0) & (state_oriented[0:4, :] <= 5))
                
                print(f"[ORIENTATION] {name} score: {score:.3f} (whites bottom [4-7]: {white_pieces_bottom}, top [0-3]: {white_pieces_top})", file=sys.stderr, flush=True)
                
                if white_pieces_bottom > white_pieces_top:
                    if score > best_score:
                        best_score = score
                        best_orientation = name
                elif white_pieces_bottom == white_pieces_top:
                    if score > best_score:
                        best_score = score
                        best_orientation = name

        print(f"[ORIENTATION] Best: {best_orientation}, score: {best_score:.3f}, threshold: {threshold}, from_bbox: {orientation_from_bbox}", file=sys.stderr, flush=True)

        # Если ориентация выбрана по bbox, применяем её независимо от score
        # (bbox более надежный индикатор чем score для стартовой позиции)
        if best_orientation is None:
            print(f"[ORIENTATION] Auto-orientation failed: no orientation selected", file=sys.stderr, flush=True)
            return
        
        if not orientation_from_bbox and best_score < threshold:
            # Автоматическую ориентацию определить не удалось —
            # оставляем index_map = None, позже можно будет добавить
            # ручное задание a1.
            print(f"[ORIENTATION] Auto-orientation failed (score {best_score:.3f} < {threshold})", file=sys.stderr, flush=True)
            return
        
        if orientation_from_bbox:
            print(f"[ORIENTATION] Applying {best_orientation} based on bbox (ignoring threshold)", file=sys.stderr, flush=True)

        # Уточняем: среди 4 поворотов берём максимальный score с канонической стартовой позицией
        refined_orientation = best_orientation
        refined_score = best_score
        for name in ('identity', 'rot90', 'rot180', 'rot270'):
            state_oriented = self._apply_orientation(board_state_raw, name)
            score = self._score_orientation(state_oriented, canonical)
            if score > refined_score:
                refined_score = score
                refined_orientation = name
        if refined_orientation != best_orientation:
            print(
                f"[ORIENTATION] Refined {best_orientation} -> {refined_orientation} "
                f'(score {best_score:.3f} -> {refined_score:.3f})',
                file=sys.stderr,
                flush=True,
            )
        best_orientation = refined_orientation
        best_score = refined_score

        # Строим index_map для найденной ориентации:
        # index_map[i_oriented, j_oriented] = (i_raw, j_raw)
        index_map = np.zeros((8, 8, 2), dtype=np.int32)

        if best_orientation == 'identity':
            for i in range(8):
                for j in range(8):
                    index_map[i, j] = (i, j)
        elif best_orientation == 'rot90':
            # Поворот на 90° по часовой: (i, j) → (j, 7-i)
            for i in range(8):
                for j in range(8):
                    index_map[i, j] = (j, 7 - i)
        elif best_orientation == 'rot180':
            # Поворот на 180°: (i, j) → (7-i, 7-j)
            for i in range(8):
                for j in range(8):
                    index_map[i, j] = (7 - i, 7 - j)
        elif best_orientation == 'rot270':
            # Поворот на 270° по часовой (90° против): (i, j) → (7-j, i)
            for i in range(8):
                for j in range(8):
                    index_map[i, j] = (7 - j, i)
        else:
            print(f"[ORIENTATION] Unknown orientation: {best_orientation}", file=sys.stderr, flush=True)
            return

        self.index_map = index_map
        self._save_index_map_to_mapping_file()
        print(f"[ORIENTATION] Auto-orientation succeeded: {best_orientation}", file=sys.stderr, flush=True)

    def _save_index_map_to_mapping_file(self) -> None:
        if self.index_map is None or not self.mapping_data:
            return
        try:
            mapping_file = self.mapping_dir / f'{self.game_token}_mapping.json'
            payload = dict(self.mapping_data)
            payload['index_map'] = self.index_map.tolist()
            with open(mapping_file, 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ORIENTATION] Failed to save index_map: {e}", file=sys.stderr, flush=True)

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

