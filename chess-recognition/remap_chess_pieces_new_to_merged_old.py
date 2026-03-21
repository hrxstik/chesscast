from __future__ import annotations

from pathlib import Path
import argparse


# chess_pieces_new names:
# 0 bb, 1 bk, 2 bn, 3 bp, 4 bq, 5 br, 6 wb, 7 wk, 8 wn, 9 wp, 10 wq, 11 wr
# merged_old names:
# 0 wp, 1 wr, 2 wb, 3 wn, 4 wk, 5 wq, 6 bp, 7 br, 8 bb, 9 bk, 10 bq, 11 bn
CLASS_MAP = {
    0: 8,   # black-bishop
    1: 9,   # black-king
    2: 11,  # black-knight
    3: 6,   # black-pawn
    4: 10,  # black-queen
    5: 7,   # black-rook
    6: 2,   # white-bishop
    7: 4,   # white-king
    8: 3,   # white-knight
    9: 0,   # white-pawn
    10: 5,  # white-queen
    11: 1,  # white-rook
}


def remap_label_file(path: Path) -> tuple[int, int]:
    lines = path.read_text(encoding="utf-8").splitlines()
    changed = 0
    total = 0
    out_lines: list[str] = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 5:
            raise ValueError(f"Invalid YOLO row in {path}: '{line}'")

        cls = int(float(parts[0]))
        if cls not in CLASS_MAP:
            raise ValueError(f"Unknown class id {cls} in {path}")

        new_cls = CLASS_MAP[cls]
        if new_cls != cls:
            changed += 1
        total += 1
        out_lines.append(" ".join([str(new_cls)] + parts[1:]))

    path.write_text("\n".join(out_lines) + ("\n" if out_lines else ""), encoding="utf-8")
    return total, changed


def validate_classes(dataset_dir: Path) -> tuple[int, int]:
    ok = 0
    bad = 0
    for split in ("train", "valid", "test"):
        labels_dir = dataset_dir / split / "labels"
        if not labels_dir.exists():
            continue
        for p in labels_dir.glob("*.txt"):
            for raw in p.read_text(encoding="utf-8").splitlines():
                row = raw.strip()
                if not row:
                    continue
                cls = int(float(row.split()[0]))
                if 0 <= cls <= 11:
                    ok += 1
                else:
                    bad += 1
    return ok, bad


def main() -> int:
    parser = argparse.ArgumentParser(description="Remap chess_pieces_new class ids to merged_old order.")
    parser.add_argument("--dataset-dir", type=Path, default=Path("chess_pieces_new"))
    args = parser.parse_args()

    dataset_dir = args.dataset_dir.resolve()
    if not dataset_dir.exists():
        print(f"[ERROR] Dataset dir not found: {dataset_dir}")
        return 1

    file_count = 0
    rows_total = 0
    rows_changed = 0

    for split in ("train", "valid", "test"):
        labels_dir = dataset_dir / split / "labels"
        if not labels_dir.exists():
            continue
        files = sorted(labels_dir.glob("*.txt"))
        print(f"[INFO] {split}: {len(files)} label files")
        for p in files:
            total, changed = remap_label_file(p)
            file_count += 1
            rows_total += total
            rows_changed += changed

    ok, bad = validate_classes(dataset_dir)
    print(f"[RESULT] Processed files: {file_count}")
    print(f"[RESULT] Rows total: {rows_total}")
    print(f"[RESULT] Rows remapped: {rows_changed}")
    print(f"[RESULT] Class rows in range 0..11: {ok}")
    print(f"[RESULT] Class rows out of range: {bad}")

    return 0 if bad == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

