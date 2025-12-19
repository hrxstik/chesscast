"""
Сервер для обработки потока кадров в реальном времени
"""
import argparse
import sys
import json
import os
import warnings
from pathlib import Path

# Фильтрация предупреждений от ultralytics и других библиотек
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources.*')

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
    # Тестовый лог для проверки stderr
    import sys
    print(f"🚀 [STARTUP] Starting stream server for token {args.token}, model: {args.model}", file=sys.stderr, flush=True)
    
    try:
        processor = StreamProcessor(
            model_path=args.model,
            game_token=args.token,
            mapping_dir=mappings_dir,
            on_move_detected=lambda move, board_state: None
        )
        print(f"✅ [STARTUP] StreamProcessor initialized successfully", file=sys.stderr, flush=True)
    except FileNotFoundError as e:
        error_msg = f"File not found: {str(e)}. Make sure the model file exists or the system will use a pretrained model."
        print(json.dumps({'status': 'error', 'message': error_msg}), flush=True)
        sys.exit(1)
    except ValueError as e:
        # Ошибка маппинга
        error_msg = str(e)
        print(json.dumps({'status': 'error', 'message': error_msg}), flush=True)
        sys.exit(1)
    except Exception as e:
        error_msg = f"Initialization error: {str(e)}"
        print(json.dumps({'status': 'error', 'message': error_msg}), flush=True)
        sys.exit(1)
    
    # Обработка кадров из stdin (бинарные данные)
    frame_count = 0
    try:
        while True:
            # Читаем длину кадра (4 байта)
            length_bytes = sys.stdin.buffer.read(4)
            if not length_bytes or len(length_bytes) != 4:
                print(f"[STDIN] No more data or incomplete length bytes: {len(length_bytes) if length_bytes else 0}", file=sys.stderr, flush=True)
                break
            
            frame_length = int.from_bytes(length_bytes, byteorder='big')
            
            # Проверка валидности длины кадра (максимум 10MB)
            MAX_FRAME_SIZE = 10 * 1024 * 1024  # 10MB
            if frame_length > MAX_FRAME_SIZE or frame_length <= 0:
                print(f"[STDIN] Invalid frame length: {frame_length} bytes (max {MAX_FRAME_SIZE}), skipping...", file=sys.stderr, flush=True)
                # Пытаемся восстановить синхронизацию - пропускаем этот кадр
                # Читаем и выбрасываем следующие 4 байта, надеясь что это начало следующего кадра
                sys.stdin.buffer.read(4)
                continue
            
            print(f"[STDIN] Received frame length: {frame_length} bytes", file=sys.stderr, flush=True)
            
            # Читаем сам кадр
            frame_data = b''
            while len(frame_data) < frame_length:
                chunk = sys.stdin.buffer.read(frame_length - len(frame_data))
                if not chunk:
                    print(f"[STDIN] Incomplete frame data: got {len(frame_data)}/{frame_length} bytes", file=sys.stderr, flush=True)
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
                
                # Логируем размер изображения в терминал (периодически, чтобы не спамить)
                if not hasattr(processor, '_last_size_log_time'):
                    processor._last_size_log_time = 0
                    processor._last_size = None
                
                import time
                current_time = time.time()
                h, w = frame.shape[:2]
                current_size = f"{w}x{h}"
                
                # Логируем при первом кадре или если размер изменился, или раз в 5 секунд
                if (processor._last_size != current_size or 
                    current_time - processor._last_size_log_time > 5):
                    print(f"[FRAME] Image size: {w}x{h}, data size: {len(frame_data)} bytes", 
                          file=sys.stderr, flush=True)
                    processor._last_size = current_size
                    processor._last_size_log_time = current_time
                
                # Логируем обработку каждого кадра
                frame_count += 1
                print(f"[FRAME] Processing frame #{frame_count} {w}x{h}...", file=sys.stderr, flush=True)
                result = processor.process_frame(frame)
                
                # Логируем результат детекции
                if result.get('detections_info'):
                    det_info = result['detections_info']
                    total = det_info.get('total_detections', 0)
                    if total > 0:
                        classes_str = ', '.join([f"{cls}: {count}" for cls, count in det_info.get('classes_detected', {}).items()])
                        print(f"[DETECTION] Found {total} pieces: {classes_str}", file=sys.stderr, flush=True)
                    else:
                        print(f"[DETECTION] No pieces detected", file=sys.stderr, flush=True)
                
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



