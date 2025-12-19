"""Проверка лейблов для ResNet-датасета (chess-boards-resnet).

Ожидаемый формат каждого .txt:
    x1 y1 x2 y2 x3 y3 x4 y4
Всего: 8 чисел.
"""

from pathlib import Path

DATASET_DIR = Path(__file__).parent / "chess-boards-resnet"
SPLITS = ["train", "valid", "test"]


def check_label(path: Path):
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return False, "пустой файл"
    parts = text.split()
    try:
        vals = [float(x) for x in parts]
    except ValueError:
        return False, "не числа"
    if len(vals) != 8:
        return False, f"кол-во={len(vals)}"
    # Проверим, что все в [0,1]
    for v in vals:
        if not (0.0 <= v <= 1.0):
            return False, f"значение вне [0,1]: {v}"
    return True, None


def main() -> None:
    if not DATASET_DIR.exists():
        print(f"[ERROR] {DATASET_DIR} не существует")
        return

    total = 0
    ok = 0
    errors = []

    for split in SPLITS:
        labels_dir = DATASET_DIR / split / "labels"
        if not labels_dir.exists():
            continue
        print("=" * 60)
        print(f"Проверка {split}")
        print("=" * 60)
        for label_path in labels_dir.glob("*.txt"):
            total += 1
            good, err = check_label(label_path)
            if good:
                ok += 1
            else:
                errors.append((label_path, err))

    print("\nИТОГО:")
    print(f"  Всего файлов: {total}")
    print(f"  Валидных: {ok}")
    print(f"  С ошибками: {len(errors)}")
    if errors:
        print("\nПервые несколько ошибок:")
        for p, e in errors[:10]:
            print(f"  {p}: {e}")


if __name__ == "__main__":
    main()





