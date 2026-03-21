from __future__ import annotations

from pathlib import Path
import argparse


def canonical_order(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Return points in TL, TR, BR, BL order."""
    pts = points[:]
    pts.sort(key=lambda p: p[1])  # by y
    top = sorted(pts[:2], key=lambda p: p[0])  # by x
    bottom = sorted(pts[2:], key=lambda p: p[0])  # by x
    return [top[0], top[1], bottom[1], bottom[0]]


def convert_label_file(path: Path, reorder_points: bool = True) -> tuple[bool, str]:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return False, "empty file"

    parts = raw.split()
    try:
        vals = [float(x) for x in parts]
    except ValueError:
        return False, "not numeric"

    # Expected YOLO polygon-like row:
    # class x1 y1 x2 y2 x3 y3 x4 y4 x5 y5
    if len(vals) != 11:
        return False, f"unexpected token count: {len(vals)} (expected 11)"

    coords = vals[1:]  # drop class id
    points5 = [(coords[i], coords[i + 1]) for i in range(0, 10, 2)]
    points4 = points5[:4]  # drop last duplicated point

    if reorder_points:
        points4 = canonical_order(points4)

    out_vals: list[float] = []
    for x, y in points4:
        out_vals.extend([x, y])

    # Keep compact but stable float formatting
    out_line = " ".join(f"{v:.10f}".rstrip("0").rstrip(".") for v in out_vals)
    path.write_text(out_line + "\n", encoding="utf-8")
    return True, "ok"


def validate_label_file(path: Path) -> tuple[bool, str | None]:
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return False, "empty"

    parts = raw.split()
    try:
        vals = [float(x) for x in parts]
    except ValueError:
        return False, "not numeric"

    if len(vals) != 8:
        return False, f"unexpected token count: {len(vals)} (expected 8)"

    for v in vals:
        if not (0.0 <= v <= 1.0):
            return False, f"value out of [0,1]: {v}"
    return True, None


def iter_label_files(dataset_dir: Path):
    for split in ("train", "valid", "test"):
        labels_dir = dataset_dir / split / "labels"
        if labels_dir.exists():
            yield split, sorted(labels_dir.glob("*.txt"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert YOLO board labels to ResNet corner format (8 numbers)."
    )
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=Path("chess_boards_new_resnet"),
        help="Path to dataset root with train/valid/test folders.",
    )
    parser.add_argument(
        "--no-reorder",
        action="store_true",
        help="Do not reorder points to TL,TR,BR,BL.",
    )
    args = parser.parse_args()

    dataset_dir = args.dataset_dir.resolve()
    if not dataset_dir.exists():
        print(f"[ERROR] Dataset dir not found: {dataset_dir}")
        return 1

    print(f"[INFO] Dataset: {dataset_dir}")
    converted = 0
    convert_errors: list[tuple[Path, str]] = []

    for split, files in iter_label_files(dataset_dir):
        print(f"[INFO] Converting split '{split}': {len(files)} files")
        for p in files:
            ok, msg = convert_label_file(p, reorder_points=not args.no_reorder)
            if ok:
                converted += 1
            else:
                convert_errors.append((p, msg))

    print(f"[INFO] Converted files: {converted}")
    print(f"[INFO] Conversion errors: {len(convert_errors)}")
    for p, e in convert_errors[:10]:
        print(f"  - {p}: {e}")

    valid = 0
    invalid = 0
    validation_errors: list[tuple[Path, str]] = []

    for split, files in iter_label_files(dataset_dir):
        print(f"[INFO] Validating split '{split}': {len(files)} files")
        for p in files:
            ok, err = validate_label_file(p)
            if ok:
                valid += 1
            else:
                invalid += 1
                validation_errors.append((p, err or "unknown"))

    print(f"[RESULT] Valid labels: {valid}")
    print(f"[RESULT] Invalid labels: {invalid}")
    for p, e in validation_errors[:10]:
        print(f"  - {p}: {e}")

    return 0 if invalid == 0 and len(convert_errors) == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

