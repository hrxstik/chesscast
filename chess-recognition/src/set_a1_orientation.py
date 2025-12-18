"""
Скрипт для ручной установки ориентации доски по клику на a1
"""
import argparse
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

from improved_board_mapping import set_a1_orientation


def main():
    parser = argparse.ArgumentParser(description='Установка ориентации доски по клику на a1')
    parser.add_argument('--token', required=True, help='Токен игры')
    parser.add_argument('--x', type=float, required=True, help='X координата клика в warped-изображении')
    parser.add_argument('--y', type=float, required=True, help='Y координата клика в warped-изображении')
    parser.add_argument('--mappings-dir', default='./chessboard_mappings', help='Директория для маппингов')
    
    args = parser.parse_args()
    
    mappings_dir = Path(args.mappings_dir)
    
    result = set_a1_orientation(
        game_token=args.token,
        a1_x=args.x,
        a1_y=args.y,
        mappings_dir=mappings_dir
    )
    
    if result['success']:
        print(f"SUCCESS: Ориентация установлена для токена {args.token}")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0)
    else:
        print(f"ERROR: {result.get('error', 'Неизвестная ошибка')}")
        sys.exit(1)


if __name__ == '__main__':
    main()
