"""
Единый inference-воркер: один процесс, одна YOLO, одна ResNet для углов доски.
Сессии игр различаются по game_token.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import warnings
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np

warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources.*')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from improved_board_mapping import map_chessboard
from model.hand_detector import close_hand_detector
from model.stream_processor import StreamProcessor
from model_paths import corner_model_path, yolo_model_path
from shared_models import SharedInferenceModels

MAX_FRAME_SIZE = 10 * 1024 * 1024


class InferenceWorker:
    def __init__(self, mappings_dir: Path):
        self.mappings_dir = mappings_dir
        self.models = SharedInferenceModels()
        self.sessions: Dict[str, StreamProcessor] = {}
        self.model_path = ''

    def init_models(self, yolo_path: str, corner_path: str) -> None:
        self.model_path = yolo_path
        self.models.load(yolo_path, corner_path)
        print(
            f'[WORKER] Models loaded: YOLO + ResNet corners',
            file=sys.stderr,
            flush=True,
        )

    def register(self, token: str) -> None:
        if token in self.sessions:
            del self.sessions[token]
        self.sessions[token] = StreamProcessor(
            model_path=self.model_path,
            game_token=token,
            mapping_dir=self.mappings_dir,
            detector=self.models.yolo,
        )
        print(f'[WORKER] Session registered: {token}', file=sys.stderr, flush=True)

    def unregister(self, token: str) -> None:
        if token in self.sessions:
            del self.sessions[token]
            print(f'[WORKER] Session unregistered: {token}', file=sys.stderr, flush=True)

    def process_frame(self, token: str, frame_data: bytes, *, hand_probe_only: bool = False) -> dict:
        processor = self.sessions.get(token)
        if processor is None:
            return {'status': 'error', 'message': f'Unknown session: {token}'}

        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {'status': 'error', 'message': 'Failed to decode image'}

        return processor.process_frame(frame, hand_probe_only=hand_probe_only)

    def calibrate_auto(self, token: str, image_path: str) -> dict:
        image = cv2.imread(image_path)
        if image is None:
            return {'success': False, 'error': f'Cannot read image: {image_path}'}
        result = map_chessboard(
            image,
            game_token=token,
            mappings_dir=self.mappings_dir,
            preloaded_yolo_detector=self.models.yolo,
            preloaded_corner_bundle=self.models.corner,
        )
        return result

    def emit(self, payload: dict) -> None:
        print(json.dumps(payload, ensure_ascii=False), flush=True)

    def handle_command(self, msg: dict) -> None:
        cmd = msg.get('cmd')

        if cmd == 'init':
            self.init_models(msg['yolo_model'], msg['corner_model'])
            self.emit({'event': 'ready'})
            return

        if cmd == 'register':
            self.register(msg['token'])
            self.emit({'event': 'registered', 'token': msg['token']})
            return

        if cmd == 'unregister':
            self.unregister(msg['token'])
            self.emit({'event': 'unregistered', 'token': msg['token']})
            return

        if cmd == 'calibrate_auto':
            result = self.calibrate_auto(msg['token'], msg['image_path'])
            self.emit({'event': 'calibrate_result', 'token': msg['token'], **result})
            return

        if cmd == 'shutdown':
            close_hand_detector()
            self.emit({'event': 'shutdown'})
            sys.exit(0)

        self.emit({'event': 'error', 'message': f'Unknown command: {cmd}'})

    def process_frame_command(self, msg: dict, buffer: bytes) -> bytes:
        """Читает length байт JPEG из buffer/stdin (не через текстовую строку)."""
        token = msg['token']
        length = int(msg['length'])
        if length <= 0 or length > MAX_FRAME_SIZE:
            self.emit({
                'event': 'frame_result',
                'token': token,
                'status': 'error',
                'message': f'Invalid frame length: {length}',
            })
            return buffer

        while len(buffer) < length:
            chunk = sys.stdin.buffer.read1(65536)
            if not chunk:
                self.emit({
                    'event': 'frame_result',
                    'token': token,
                    'status': 'error',
                    'message': 'Incomplete frame data',
                })
                return buffer
            buffer += chunk

        frame_data = buffer[:length]
        buffer = buffer[length:]
        hand_probe_only = bool(msg.get('hand_probe'))
        result = self.process_frame(token, frame_data, hand_probe_only=hand_probe_only)
        self.emit({'event': 'frame_result', 'token': token, **result})
        return buffer

    def run(self) -> None:
        buffer = b''
        while True:
            chunk = sys.stdin.buffer.read1(65536)
            if not chunk:
                break
            buffer += chunk
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line.decode('utf-8'))
                except json.JSONDecodeError as exc:
                    self.emit({'event': 'error', 'message': f'Invalid JSON: {exc}'})
                    continue
                if msg.get('cmd') == 'frame':
                    buffer = self.process_frame_command(msg, buffer)
                else:
                    self.handle_command(msg)


def main() -> None:
    parser = argparse.ArgumentParser(description='ChessCast CV inference worker')
    parser.add_argument('--mappings-dir', default='./chessboard_mappings')
    parser.add_argument('--yolo-model', default=None)
    parser.add_argument('--corner-model', default=None)
    args = parser.parse_args()

    yolo_path = args.yolo_model or yolo_model_path()
    corner_path = args.corner_model or corner_model_path()
    mappings_dir = Path(args.mappings_dir)
    mappings_dir.mkdir(parents=True, exist_ok=True)

    from model.hand_detector import _get_landmarker

    worker = InferenceWorker(mappings_dir)
    worker.init_models(yolo_path, corner_path)
    _get_landmarker()
    worker.emit({'event': 'ready'})
    worker.run()


if __name__ == '__main__':
    main()
