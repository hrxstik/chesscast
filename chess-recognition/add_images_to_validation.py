"""Скрипт для добавления изображений из train в valid для более стабильной валидации."""

from pathlib import Path
import random
import shutil

BASE_DIR = Path(__file__).parent
DATASET_DIR = BASE_DIR / "chess-boards-resnet"

NUM_IMAGES_TO_MOVE = 20

def main():
    train_images_dir = DATASET_DIR / "train" / "images"
    train_labels_dir = DATASET_DIR / "train" / "labels"
    valid_images_dir = DATASET_DIR / "valid" / "images"
    valid_labels_dir = DATASET_DIR / "valid" / "labels"
    
    if not train_images_dir.exists():
        print(f"[ERROR] Не найдена папка: {train_images_dir}")
        return
    
    if not valid_images_dir.exists():
        print(f"[ERROR] Не найдена папка: {valid_images_dir}")
        return
    
    # Создаем папку valid/labels если её нет
    valid_labels_dir.mkdir(parents=True, exist_ok=True)
    
    # Получаем список всех изображений в train
    train_images = list(train_images_dir.glob("*.jpg"))
    
    if len(train_images) < NUM_IMAGES_TO_MOVE:
        print(f"[WARN] В train только {len(train_images)} изображений, меньше чем {NUM_IMAGES_TO_MOVE}")
        print(f"Переместим все доступные: {len(train_images)}")
        num_to_move = len(train_images)
    else:
        num_to_move = NUM_IMAGES_TO_MOVE
    
    # Случайно выбираем изображения для перемещения
    random.seed(42)  # Для воспроизводимости
    images_to_move = random.sample(train_images, num_to_move)
    
    print(f"Перемещаем {num_to_move} изображений из train в valid...")
    print(f"Текущее количество в valid: {len(list(valid_images_dir.glob('*.jpg')))}")
    
    moved_count = 0
    for img_path in images_to_move:
        # Проверяем наличие соответствующего лейбла
        label_path = train_labels_dir / (img_path.stem + ".txt")
        if not label_path.exists():
            print(f"[WARN] Пропускаем {img_path.name} - нет лейбла")
            continue
        
        # Перемещаем изображение
        dst_img = valid_images_dir / img_path.name
        if dst_img.exists():
            print(f"[WARN] {img_path.name} уже существует в valid, пропускаем")
            continue
        
        shutil.move(str(img_path), str(dst_img))
        
        # Перемещаем лейбл
        dst_label = valid_labels_dir / label_path.name
        shutil.move(str(label_path), str(dst_label))
        
        moved_count += 1
        print(f"  Перемещено: {img_path.name} + {label_path.name}")
    
    print(f"\nГотово! Перемещено {moved_count} изображений и {moved_count} лейблов.")
    print(f"Теперь в valid: {len(list(valid_images_dir.glob('*.jpg')))} изображений, {len(list(valid_labels_dir.glob('*.txt')))} лейблов")
    print(f"В train осталось: {len(list(train_images_dir.glob('*.jpg')))} изображений, {len(list(train_labels_dir.glob('*.txt')))} лейблов")

if __name__ == "__main__":
    main()

