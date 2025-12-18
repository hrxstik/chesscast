"""
Скрипт для конвертации лейблов в формат YOLO11 keypoint detection

Текущий формат: class_id x1 y1 x2 y2 x3 y3 x4 y4 x5 y5
(где x5, y5 = x1, y1 для замыкания полигона)

Требуемый формат: class_id x1 y1 v1 x2 y2 v2 x3 y3 v3 x4 y4 v4
(где v1=v2=v3=v4=2.0, игнорируем 5-ю точку)
"""

from pathlib import Path
import shutil


def convert_label_file(label_path: Path, backup: bool = True) -> tuple[bool, str]:
    """
    Конвертация одного лейбла из формата 5 точек в формат 4 точек с visibility
    
    Входной формат: class_id x1 y1 x2 y2 x3 y3 x4 y4 x5 y5
    Выходной формат: class_id x1 y1 2.0 x2 y2 2.0 x3 y3 2.0 x4 y4 2.0
    """
    try:
        with open(label_path, 'r') as f:
            line = f.readline().strip()
        
        parts = [float(x) for x in line.split()]
        
        # Проверяем формат: должно быть 11 чисел (1 класс + 10 координат = 5 точек)
        if len(parts) != 11:
            return False, f"Неверное количество чисел: {len(parts)} (ожидается 11)"
        
        class_id = int(parts[0])
        keypoints_raw = parts[1:]  # Все координаты после класса
        
        # Проверяем, что у нас 5 точек (10 чисел)
        if len(keypoints_raw) != 10:
            return False, f"Неверное количество координат: {len(keypoints_raw)} (ожидается 10)"
        
        # Извлекаем первые 4 точки (игнорируем 5-ю, которая замыкает полигон)
        keypoints_4_with_vis = []
        for i in range(0, 8, 2):  # Берем только первые 8 чисел (4 точки)
            x = keypoints_raw[i]
            y = keypoints_raw[i + 1]
            keypoints_4_with_vis.extend([x, y, 2.0])  # Добавляем visibility=2.0
        
        # Проверяем, что 5-я точка действительно совпадает с 1-й
        first_point = (keypoints_raw[0], keypoints_raw[1])
        last_point = (keypoints_raw[8], keypoints_raw[9])
        if abs(first_point[0] - last_point[0]) > 1e-6 or abs(first_point[1] - last_point[1]) > 1e-6:
            return False, f"5-я точка не совпадает с 1-й: первая={first_point}, последняя={last_point}"
        
        # Создаем backup
        if backup:
            backup_path = label_path.with_suffix('.txt.bak')
            shutil.copy(label_path, backup_path)
        
        # Записываем новый формат
        new_line = ' '.join([str(class_id)] + [str(x) for x in keypoints_4_with_vis])
        
        with open(label_path, 'w') as f:
            f.write(new_line)
        
        return True, "OK"
        
    except Exception as e:
        return False, str(e)


def convert_all_labels(dataset_dir: Path, backup: bool = True) -> dict:
    """Конвертация всех лейблов в датасете"""
    results = {
        'converted': 0,
        'skipped': 0,
        'errors': []
    }
    
    for split in ['train', 'valid', 'test']:
        labels_dir = dataset_dir / split / 'labels'
        if not labels_dir.exists():
            print(f"Пропущена папка {split} (не найдена)")
            continue
        
        print(f"\n{'='*60}")
        print(f"Конвертация {split.upper()}...")
        print(f"{'='*60}")
        
        label_files = list(labels_dir.glob('*.txt'))
        # Исключаем backup файлы
        label_files = [f for f in label_files if not f.name.endswith('.bak')]
        
        print(f"Найдено файлов: {len(label_files)}")
        
        for i, label_path in enumerate(label_files, 1):
            success, message = convert_label_file(label_path, backup=backup)
            
            if success:
                results['converted'] += 1
                if results['converted'] % 50 == 0:
                    print(f"  Конвертировано: {results['converted']} файлов...")
            else:
                results['skipped'] += 1
                results['errors'].append({
                    'file': str(label_path),
                    'error': message
                })
                if len(results['errors']) <= 5:
                    print(f"  Ошибка в {label_path.name}: {message}")
    
    return results


def verify_converted_labels(dataset_dir: Path) -> dict:
    """Проверка конвертированных лейблов"""
    results = {
        'correct_format': 0,
        'incorrect_format': 0,
        'errors': []
    }
    
    for split in ['train', 'valid', 'test']:
        labels_dir = dataset_dir / split / 'labels'
        if not labels_dir.exists():
            continue
        
        label_files = list(labels_dir.glob('*.txt'))
        label_files = [f for f in label_files if not f.name.endswith('.bak')]
        
        for label_path in label_files:
            try:
                with open(label_path, 'r') as f:
                    line = f.readline().strip()
                
                parts = [float(x) for x in line.split()]
                
                # Проверяем формат: class(1) + keypoints(12) = 13 чисел
                # где keypoints = 4 точки * 3 (x, y, visibility)
                if len(parts) == 13:
                    # Проверяем, что visibility = 2.0
                    visibilities = [parts[i] for i in range(3, 13, 3)]  # visibility на позициях 3, 6, 9, 12
                    if all(abs(v - 2.0) < 1e-6 for v in visibilities):
                        results['correct_format'] += 1
                    else:
                        results['incorrect_format'] += 1
                        results['errors'].append({
                            'file': str(label_path),
                            'error': f'Visibility не равен 2.0: {visibilities}'
                        })
                else:
                    results['incorrect_format'] += 1
                    results['errors'].append({
                        'file': str(label_path),
                        'error': f'Неверное количество чисел: {len(parts)} (ожидается 13)'
                    })
            except Exception as e:
                results['errors'].append({
                    'file': str(label_path),
                    'error': str(e)
                })
    
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Конвертация лейблов в формат YOLO11 keypoint detection')
    parser.add_argument('--check-only', action='store_true', help='Только проверка, без конвертации')
    parser.add_argument('--no-backup', action='store_true', help='Не создавать backup файлы')
    args = parser.parse_args()
    
    dataset_dir = Path(__file__).parent / 'chess-boards'
    
    if not dataset_dir.exists():
        print(f"Ошибка: директория {dataset_dir} не найдена!")
        return
    
    print("="*60)
    print("КОНВЕРТАЦИЯ ЛЕЙБЛОВ В ФОРМАТ YOLO11")
    print("="*60)
    
    if not args.check_only:
        print("\n[ШАГ 1] Конвертация лейблов...")
        print("Формат: 5 точек (последняя дублирует первую) -> 4 точки с visibility=2.0")
        
        convert_results = convert_all_labels(dataset_dir, backup=not args.no_backup)
        
        print(f"\nРезультаты конвертации:")
        print(f"  Конвертировано: {convert_results['converted']} файлов")
        print(f"  Пропущено: {convert_results['skipped']} файлов")
        if convert_results['errors']:
            print(f"  Ошибок: {len(convert_results['errors'])}")
            print(f"\n  Примеры ошибок (первые 5):")
            for error in convert_results['errors'][:5]:
                print(f"    {error['file']}: {error['error']}")
        
        if not args.no_backup:
            print(f"\n[OK] Backup файлы сохранены с расширением .txt.bak")
    
    print(f"\n[ШАГ 2] Проверка конвертированных лейблов...")
    verify_results = verify_converted_labels(dataset_dir)
    
    print(f"\nРезультаты проверки:")
    print(f"  Правильный формат (4 точки + visibility=2.0): {verify_results['correct_format']} файлов")
    print(f"  Неправильный формат: {verify_results['incorrect_format']} файлов")
    if verify_results['errors']:
        print(f"\n  Ошибки (первые 5):")
        for error in verify_results['errors'][:5]:
            print(f"    {error['file']}: {error['error']}")


if __name__ == '__main__':
    main()
