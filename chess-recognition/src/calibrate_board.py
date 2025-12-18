"""
Скрипт для калибровки доски через командную строку
"""
import argparse
import cv2
import json
import warnings
from pathlib import Path
import sys
import os
import numpy as np

# Фильтрация предупреждений от библиотек
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources.*')

# Добавление пути к модулям
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from improved_board_mapping import map_chessboard, map_chessboard_manual
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Калибровка шахматной доски')
    parser.add_argument('--token', required=True, help='Токен игры')
    parser.add_argument('--image', required=True, help='Путь к изображению доски')
    parser.add_argument('--mappings-dir', default='./chessboard_mappings', help='Директория для маппингов')
    parser.add_argument('--model', default=None, help='Путь к модели YOLO11 для детекции фигур')
    parser.add_argument(
        '--corners',
        nargs=8,
        type=float,
        help='Ручные углы доски: x1 y1 x2 y2 x3 y3 x4 y4 (в пикселях исходного изображения)'
    )
    
    args = parser.parse_args()
    
    # Создание директории для маппингов
    mappings_dir = Path(args.mappings_dir)
    mappings_dir.mkdir(parents=True, exist_ok=True)
    
    # Загрузка изображения
    image = cv2.imread(args.image)
    if image is None:
        print(f"ERROR: Не удалось загрузить изображение: {args.image}")
        sys.exit(1)
    
    # Выполнение маппинга
    if args.corners:
        # Ручной режим: углы заданы пользователем
        corners = np.array(args.corners, dtype=np.float32).reshape(4, 2)
        result = map_chessboard_manual(
            image=image,
            game_token=args.token,
            board_corners=corners,
            output_size=(640, 640),
            mappings_dir=mappings_dir,
        )
    else:
        # Автоматический режим: детекция по фигурам
        result = map_chessboard(
            image=image,
            game_token=args.token,
            check_empty=True,  # пустота доски больше не обязательна
            empty_threshold=0.15,
            mappings_dir=mappings_dir,
            model_path=args.model,
            conf_threshold=0.5,
        )
    
    if result['success']:
        print(f"SUCCESS: Маппинг выполнен успешно для токена {args.token}")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0)
    else:
        print(f"ERROR: {result.get('error', 'Неизвестная ошибка')}")
        sys.exit(1)


if __name__ == '__main__':
    main()

