from __future__ import annotations

from pathlib import Path
import shutil
import argparse


def copy_split(src_root: Path, dst_root: Path, split: str, prefix: str) -> tuple[int, int]:
    src_images = src_root / split / "images"
    src_labels = src_root / split / "labels"
    dst_images = dst_root / split / "images"
    dst_labels = dst_root / split / "labels"

    if not src_images.exists() or not src_labels.exists():
        return 0, 0

    dst_images.mkdir(parents=True, exist_ok=True)
    dst_labels.mkdir(parents=True, exist_ok=True)

    copied = 0
    skipped = 0

    for img_path in sorted(src_images.glob("*")):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue

        label_path = src_labels / f"{img_path.stem}.txt"
        if not label_path.exists():
            skipped += 1
            continue

        dst_img_name = f"{prefix}{img_path.name}"
        dst_lbl_name = f"{prefix}{label_path.name}"
        dst_img_path = dst_images / dst_img_name
        dst_lbl_path = dst_labels / dst_lbl_name

        if dst_img_path.exists() or dst_lbl_path.exists():
            skipped += 1
            continue

        shutil.copy2(img_path, dst_img_path)
        shutil.copy2(label_path, dst_lbl_path)
        copied += 1

    return copied, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge chess_pieces_new dataset into merged_new.")
    parser.add_argument("--src", type=Path, default=Path("chess_pieces_new"))
    parser.add_argument("--dst", type=Path, default=Path("merged_new"))
    parser.add_argument("--prefix", type=str, default="cpn_")
    args = parser.parse_args()

    src = args.src.resolve()
    dst = args.dst.resolve()
    if not src.exists():
        print(f"[ERROR] Source not found: {src}")
        return 1
    if not dst.exists():
        print(f"[ERROR] Destination not found: {dst}")
        return 1

    total_copied = 0
    total_skipped = 0
    for split in ("train", "valid", "test"):
        copied, skipped = copy_split(src, dst, split, args.prefix)
        total_copied += copied
        total_skipped += skipped
        print(f"[INFO] {split}: copied={copied}, skipped={skipped}")

    print(f"[RESULT] Total copied: {total_copied}")
    print(f"[RESULT] Total skipped: {total_skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

