"""
Детекция руки на выпрямленном кадре доски через MediaPipe Hands.
Учитываются только landmarks внутри полигона игрового поля (не область за доской на warped-кадре).
"""
from __future__ import annotations

import sys
import threading
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

_hands_solution = None
_hands_lock = threading.Lock()
_import_error: Optional[str] = None
_warned_unavailable = False


@dataclass
class HandDetectionResult:
    detected: bool
    landmarks_inside: int
    hands_seen: int
    available: bool


def _warn_once(message: str) -> None:
    global _warned_unavailable
    if not _warned_unavailable:
        _warned_unavailable = True
        print(f'[HAND] {message}', file=sys.stderr, flush=True)


def _point_in_quad(px: float, py: float, quad: np.ndarray) -> bool:
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    p = (px, py)
    d1 = sign(p, quad[0], quad[1])
    d2 = sign(p, quad[1], quad[2])
    d3 = sign(p, quad[2], quad[3])
    d4 = sign(p, quad[3], quad[0])
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0) or (d4 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0) or (d4 > 0)
    return not (has_neg and has_pos)


def board_quad_from_square_corners(square_corners: np.ndarray) -> np.ndarray:
    """Внешний контур поля 8×8: углы сетки (0,0), (0,8), (8,8), (8,0)."""
    sc = np.asarray(square_corners, dtype=np.float32)
    return np.array([sc[0, 0], sc[0, 8], sc[8, 8], sc[8, 0]], dtype=np.float32)


def _get_hands():
    global _hands_solution, _import_error
    if _import_error is not None:
        raise ImportError(_import_error)
    with _hands_lock:
        if _hands_solution is None:
            try:
                import mediapipe as mp
            except ImportError as exc:
                _import_error = str(exc)
                raise
            _hands_solution = mp.solutions.hands.Hands(
                static_image_mode=True,
                max_num_hands=2,
                model_complexity=0,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return _hands_solution


def detect_hand_on_board(
    warped_bgr: np.ndarray,
    square_corners: np.ndarray,
    min_landmarks_inside: int = 3,
) -> HandDetectionResult:
    """
    Рука считается на доске, если у какой-либо ладони >= min_landmarks_inside
    landmark-ов (MediaPipe) попадают внутрь полигона игрового поля.
    """
    empty = HandDetectionResult(False, 0, 0, False)
    if warped_bgr is None or square_corners is None:
        return empty

    try:
        hands = _get_hands()
    except ImportError as exc:
        _warn_once(f'MediaPipe unavailable ({exc}); hand freeze disabled')
        return HandDetectionResult(False, 0, 0, False)

    h, w = warped_bgr.shape[:2]
    if h == 0 or w == 0:
        return HandDetectionResult(False, 0, 0, True)

    rgb = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)
    if not results.multi_hand_landmarks:
        return HandDetectionResult(False, 0, 0, True)

    board_quad = board_quad_from_square_corners(square_corners)
    best_inside = 0
    hands_seen = len(results.multi_hand_landmarks)

    for hand_lm in results.multi_hand_landmarks:
        inside = 0
        for lm in hand_lm.landmark:
            px = lm.x * w
            py = lm.y * h
            if _point_in_quad(px, py, board_quad):
                inside += 1
        best_inside = max(best_inside, inside)

    detected = best_inside >= min_landmarks_inside
    return HandDetectionResult(detected, best_inside, hands_seen, True)


def close_hand_detector() -> None:
    global _hands_solution
    with _hands_lock:
        if _hands_solution is not None:
            _hands_solution.close()
            _hands_solution = None
