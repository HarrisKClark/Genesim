#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path


DEFAULT_EXCLUDES = {
    ".git",
    ".idea",
    ".vscode",
    ".DS_Store",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    "coverage",
}


def is_probably_text(p: Path) -> bool:
    # Heuristic: try to read a small chunk as UTF-8.
    try:
        with p.open("rb") as f:
            chunk = f.read(8192)
        chunk.decode("utf-8")
        return True
    except Exception:
        return False


def count_file_lines(p: Path) -> tuple[int, int, int]:
    """
    Returns: (total_lines, non_empty_lines, bytes)
    """
    data = p.read_bytes()
    try:
        text = data.decode("utf-8")
    except Exception:
        # last-chance: treat as not countable
        return (0, 0, len(data))
    # normalize newlines
    lines = text.splitlines()
    non_empty = sum(1 for ln in lines if ln.strip() != "")
    return (len(lines), non_empty, len(data))


def main() -> int:
    ap = argparse.ArgumentParser(description="Count LoC for a repo (excluding node_modules, dist, etc.)")
    ap.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Project root directory (default: repo root inferred from this script location)",
    )
    ap.add_argument(
        "--include-dotfiles",
        action="store_true",
        help="Include dotfiles and dot-directories (default: skipped)",
    )
    ap.add_argument(
        "--excludes",
        nargs="*",
        default=sorted(DEFAULT_EXCLUDES),
        help="Directory or file names to exclude (match by name)",
    )
    args = ap.parse_args()

    root = Path(args.root).resolve()
    excludes = set(args.excludes)

    per_ext_total = defaultdict(int)
    per_ext_non_empty = defaultdict(int)
    per_ext_files = defaultdict(int)

    total_files = 0
    total_lines = 0
    total_non_empty = 0

    for p in root.rglob("*"):
        name = p.name
        if not args.include_dotfiles and name.startswith("."):
            # Skip dotfiles and dot-directories by default.
            if p.is_dir():
                # rglob will still walk into it; skip by name filter below as well.
                pass
            continue

        # Exclude by name anywhere in the path (directory names and common outputs).
        if any(part in excludes for part in p.parts):
            continue

        if p.is_dir():
            continue
        if not p.is_file():
            continue

        # Skip very large files (likely generated bundles) unless explicitly wanted.
        try:
            if p.stat().st_size > 10 * 1024 * 1024:
                continue
        except Exception:
            continue

        if not is_probably_text(p):
            continue

        ext = p.suffix.lower() or "<noext>"
        lines, non_empty, _bytes = count_file_lines(p)
        if lines == 0 and non_empty == 0:
            continue

        total_files += 1
        total_lines += lines
        total_non_empty += non_empty
        per_ext_files[ext] += 1
        per_ext_total[ext] += lines
        per_ext_non_empty[ext] += non_empty

    print(f"Root: {root}")
    print(f"Excluded names: {', '.join(sorted(excludes))}")
    print("")
    print("TOTAL")
    print(f"  Files: {total_files}")
    print(f"  Lines (physical): {total_lines}")
    print(f"  Non-empty lines:  {total_non_empty}")
    print("")
    print("BY EXTENSION (sorted by non-empty lines)")

    rows = sorted(per_ext_non_empty.items(), key=lambda kv: kv[1], reverse=True)
    for ext, non_empty in rows:
        print(
            f"  {ext:>8}  files={per_ext_files[ext]:>5}  "
            f"non-empty={non_empty:>8}  total={per_ext_total[ext]:>8}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())



