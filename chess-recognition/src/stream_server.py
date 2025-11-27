"""
Сервер для обработки потока кадров в реальном времени
"""
import argparse
import sys
import json
import os
from pathlib import Path

# Добавление пути к модулям
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.stream_processor import StreamProcessor


def main():
    parser = argparse.ArgumentParser(description='Обработка потока кадров')
    parser.add_argument('--token', required=True, help='Токен игры')
    parser.add_argument('--model', required=True, help='Путь к модели YOLO 11')
    parser.add_argument('--mappings-dir', default='./chessboard_mappings', help='Директория для маппингов')
    
    args = parser.parse_args()
    
    mappings_dir = Path(args.mappings_dir)
    
    # Инициализация обработчика потока
    try:
        processor = StreamProcessor(
            model_path=args.model,
            game_token=args.token,
            mapping_dir=mappings_dir,
            on_move_detected=lambda move, board_state: None
        )
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}), flush=True)
        sys.exit(1)
    
    # Обработка кадров из stdin (бинарные данные)
    try:
        while True:
            # Читаем длину кадра (4 байта)
            length_bytes = sys.stdin.buffer.read(4)
            if not length_bytes or len(length_bytes) != 4:
                break
            
            frame_length = int.from_bytes(length_bytes, byteorder='big')
            
            # Читаем сам кадр
            frame_data = b''
            while len(frame_data) < frame_length:
                chunk = sys.stdin.buffer.read(frame_length - len(frame_data))
                if not chunk:
                    break
                frame_data += chunk
            
            if len(frame_data) != frame_length:
                print(json.dumps({'status': 'error', 'message': 'Incomplete frame data'}), flush=True)
                continue
            
            try:
                # Декодируем изображение из бинарных данных
                import cv2
                import numpy as np
                
                nparr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    print(json.dumps({'status': 'error', 'message': 'Failed to decode image'}), flush=True)
                    continue
                
                result = processor.process_frame(frame)
                print(json.dumps(result), flush=True)
            except Exception as e:
                print(json.dumps({'status': 'error', 'message': str(e)}), flush=True)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()


