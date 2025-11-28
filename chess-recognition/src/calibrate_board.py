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

# Фильтрация предупреждений от библиотек
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources.*')

# Добавление пути к модулям
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from improved_board_mapping import map_chessboard
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Калибровка шахматной доски')
    parser.add_argument('--token', required=True, help='Токен игры')
    parser.add_argument('--image', required=True, help='Путь к изображению доски')
    parser.add_argument('--mappings-dir', default='./chessboard_mappings', help='Директория для маппингов')
    
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
    result = map_chessboard(
        image=image,
        game_token=args.token,
        check_empty=True,
        empty_threshold=0.15,
        mappings_dir=mappings_dir
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

