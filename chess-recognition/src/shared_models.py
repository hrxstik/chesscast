"""
Общие экземпляры моделей CV для единого inference-воркера.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from torchvision import models

from model.yolo11_detector import YOLO11Detector


class CornerRegressor(nn.Module):
    def __init__(self, model_name: str = 'resnet34', pretrained: bool = False):
        super().__init__()
        self.model_name = model_name
        if model_name == 'resnet18':
            self.backbone = models.resnet18(weights=None)
        elif model_name == 'resnet34':
            self.backbone = models.resnet34(weights=None)
        elif model_name == 'resnet50':
            self.backbone = models.resnet50(weights=None)
        else:
            raise ValueError(f'Unknown ResNet model: {model_name}')
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 8),
        )

    def forward(self, x):
        return torch.sigmoid(self.backbone(x))


@dataclass
class CornerModelBundle:
    model: nn.Module
    device: str
    img_size: int
    model_name: str


class SharedInferenceModels:
    def __init__(self):
        self.yolo: Optional[YOLO11Detector] = None
        self.corner: Optional[CornerModelBundle] = None
        self.yolo_path: Optional[str] = None
        self.corner_path: Optional[str] = None

    def load(self, yolo_path: str, corner_path: str, img_size: int = 640) -> None:
        if self.yolo is None or self.yolo_path != yolo_path:
            self.yolo = YOLO11Detector(yolo_path)
            self.yolo_path = yolo_path

        corner_file = Path(corner_path)
        if not corner_file.exists():
            raise FileNotFoundError(f'Corner model not found: {corner_path}')

        if self.corner is None or self.corner_path != corner_path:
            model_name = 'resnet34'
            lower = corner_path.lower()
            if 'resnet18' in lower:
                model_name = 'resnet18'
            elif 'resnet50' in lower:
                model_name = 'resnet50'

            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            model = CornerRegressor(model_name=model_name, pretrained=False)
            model.load_state_dict(torch.load(corner_path, map_location=device))
            model.to(device)
            model.eval()
            self.corner = CornerModelBundle(
                model=model,
                device=device,
                img_size=img_size,
                model_name=model_name,
            )
            self.corner_path = corner_path
