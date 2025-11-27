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
    
    # Обработка кадров из stdin (base64)
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                result = processor.process_base64_frame(line)
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


