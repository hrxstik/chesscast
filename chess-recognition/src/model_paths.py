"""Пути к весам в chess-recognition/models/."""
from __future__ import annotations

import os
from pathlib import Path

CHESS_RECOGNITION_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = CHESS_RECOGNITION_ROOT / 'models'


def yolo_model_path() -> str:
    return os.environ.get('YOLO_MODEL_PATH') or str(MODELS_DIR / 'bestmerged_new.pt')


def corner_model_path() -> str:
    return os.environ.get('CORNER_MODEL_PATH') or str(
        MODELS_DIR / 'best_resnet34_board_corners.pt',
    )


def hand_landmarker_model_path() -> str:
    env = os.environ.get('HAND_LANDMARKER_MODEL')
    if env and Path(env).is_file():
        return env
    path = MODELS_DIR / 'hand_landmarker.task'
    if not path.is_file():
        raise FileNotFoundError(
            f'Hand landmarker model not found: {path}. '
            'Run chess-recognition/scripts/download-hand-model.ps1',
        )
    return str(path)
