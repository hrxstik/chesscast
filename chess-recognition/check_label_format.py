"""
Проверка формата лейблов и сравнение с предсказаниями модели
"""

from pathlib import Path
from ultralytics import YOLO
import cv2
import numpy as np


def load_label(label_path: Path):
    """Загрузка лейбла"""
    with open(label_path, 'r') as f:
        line = f.readline().strip()
    
    parts = [float(x) for x in line.split()]
    
    if len(parts) == 17:
        class_id = int(parts[0])
        bbox = parts[1:5]
        keypoints = parts[5:]
        
        points = []
        for i in range(0, 12, 3):
            x, y, vis = keypoints[i], keypoints[i+1], keypoints[i+2]
            points.append((x, y, vis))
        
        return {
            'class_id': class_id,
            'bbox': bbox,
            'points': points
        }
    return None


def visualize_comparison(image_path: Path, label_path: Path, model, output_path: Path = None):
    """Визуализация сравнения ground truth и предсказаний"""
    
    # Загружаем изображение
    image = cv2.imread(str(image_path))
    if image is None:
        return None
    
    h, w = image.shape[:2]
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Загружаем лейбл
    label_data = load_label(label_path)
    if label_data is None:
        return None
    
    # Предсказание модели
    results = model.predict(
        source=str(image_path),
        imgsz=1280,
        conf=0.25,
        save=False,
    )
    
    result = results[0]
    
    # Создаем визуализацию
    vis_image = image_rgb.copy()
    
    # Рисуем ground truth (зеленые точки)
    gt_colors = [(0, 255, 0), (0, 255, 0), (0, 255, 0), (0, 255, 0)]
    for idx, (x_norm, y_norm, vis) in enumerate(label_data['points']):
        x = int(x_norm * w)
        y = int(y_norm * h)
        cv2.circle(vis_image, (x, y), 12, gt_colors[idx], -1)
        cv2.circle(vis_image, (x, y), 12, (255, 255, 255), 2)
        cv2.putText(vis_image, f"GT{idx}", (x+15, y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # Рисуем предсказания (красные точки)
    if result.keypoints is not None and len(result.keypoints.data) > 0:
        pred_kpts = result.keypoints.data[0].cpu().numpy()
        pred_colors = [(255, 0, 0), (255, 0, 0), (255, 0, 0), (255, 0, 0)]
        
        for idx, kpt in enumerate(pred_kpts):
            if len(kpt) >= 3 and kpt[2] > 0.5:
                x = int(kpt[0])
                y = int(kpt[1])
                cv2.circle(vis_image, (x, y), 12, pred_colors[idx], -1)
                cv2.circle(vis_image, (x, y), 12, (255, 255, 255), 2)
                cv2.putText(vis_image, f"P{idx}", (x+15, y+20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
        
        # Вычисляем ошибки
        print(f"\nОшибки предсказания:")
        for idx, (x_norm, y_norm, vis) in enumerate(label_data['points']):
            if idx < len(pred_kpts) and len(pred_kpts[idx]) >= 3:
                x_gt = x_norm * w
                y_gt = y_norm * h
                x_pred = float(pred_kpts[idx][0])
                y_pred = float(pred_kpts[idx][1])
                
                error = np.sqrt((x_gt - x_pred)**2 + (y_gt - y_pred)**2)
                error_norm = error / np.sqrt(w**2 + h**2)  # Нормализованная ошибка
                
                print(f"  Точка {idx}: ошибка = {error:.1f} пикселей ({error_norm*100:.2f}%)")
    
    if output_path:
        vis_image_bgr = cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(output_path), vis_image_bgr)
    
    return vis_image


def main():
    model_path = "best_board.pt"
    dataset_dir = Path("chess-boards")
    
    model = YOLO(model_path)
    
    # Берем несколько изображений
    train_images_dir = dataset_dir / 'train' / 'images'
    train_labels_dir = dataset_dir / 'train' / 'labels'
    
    image_files = list(train_images_dir.glob('*.jpg'))[:3]
    
    print("Сравнение Ground Truth и Предсказаний:")
    print("="*60)
    print("Зеленые точки (GT) - правильные координаты из лейбла")
    print("Красные точки (P) - предсказания модели")
    print("="*60)
    
    for img_path in image_files:
        label_path = train_labels_dir / (img_path.stem + '.txt')
        if not label_path.exists():
            label_files = list(train_labels_dir.glob(f'*{img_path.stem.split(".")[0]}*.txt'))
            if label_files:
                label_path = label_files[0]
            else:
                continue
        
        print(f"\n{img_path.name}:")
        output_path = Path(f"comparison_{img_path.stem}.jpg")
        vis_image = visualize_comparison(img_path, label_path, model, output_path)
        
        if vis_image is not None:
            print(f"  Результат сохранен: {output_path}")


if __name__ == '__main__':
    main()






