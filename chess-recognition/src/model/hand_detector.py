"""
Детекция руки на выпрямленном кадре доски через MediaPipe Hand Landmarker (Tasks API).
Учитываются только landmarks внутри полигона игрового поля.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

from model_paths import hand_landmarker_model_path

_hands_lock = threading.Lock()
_hand_landmarker: vision.HandLandmarker | None = None


@dataclass
class HandDetectionResult:
    detected: bool
    landmarks_inside: int
    hands_seen: int
    available: bool


def _get_landmarker() -> vision.HandLandmarker:
    global _hand_landmarker
    with _hands_lock:
        if _hand_landmarker is None:
            options = vision.HandLandmarkerOptions(
                base_options=mp_tasks.BaseOptions(
                    model_asset_path=hand_landmarker_model_path(),
                ),
                num_hands=2,
                min_hand_detection_confidence=0.5,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5,
                running_mode=vision.RunningMode.IMAGE,
            )
            _hand_landmarker = vision.HandLandmarker.create_from_options(options)
        return _hand_landmarker


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


def detect_hand_on_board(
    warped_bgr: np.ndarray,
    square_corners: np.ndarray,
    min_landmarks_inside: int = 3,
) -> HandDetectionResult:
    """
    Рука считается на доске, если у какой-либо ладони >= min_landmarks_inside
    landmark-ов попадают внутрь полигона игрового поля.
    """
    empty = HandDetectionResult(False, 0, 0, False)
    if warped_bgr is None or square_corners is None:
        return empty

    h, w = warped_bgr.shape[:2]
    if h == 0 or w == 0:
        return HandDetectionResult(False, 0, 0, True)

    landmarker = _get_landmarker()
    rgb = cv2.cvtColor(warped_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    results = landmarker.detect(mp_image)

    if not results.hand_landmarks:
        return HandDetectionResult(False, 0, 0, True)

    board_quad = board_quad_from_square_corners(square_corners)
    best_inside = 0
    hands_seen = len(results.hand_landmarks)

    for hand_lm in results.hand_landmarks:
        inside = 0
        for lm in hand_lm:
            px = lm.x * w
            py = lm.y * h
            if _point_in_quad(px, py, board_quad):
                inside += 1
        best_inside = max(best_inside, inside)

    detected = best_inside >= min_landmarks_inside
    return HandDetectionResult(detected, best_inside, hands_seen, True)


def close_hand_detector() -> None:
    global _hand_landmarker
    with _hands_lock:
        if _hand_landmarker is not None:
            _hand_landmarker.close()
            _hand_landmarker = None
