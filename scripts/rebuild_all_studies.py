#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

import export_study


ROOT = Path(__file__).resolve().parents[1]
ARCHIVES_DIR = ROOT / "Archives"
PUBLISH_DIR = ROOT / "docs"
CNAME_DOMAIN = "studies.dailychartbook.com"
ROOT_INPUTS = [
    ROOT / "backtest-data.xlsx",
    ROOT / "backtest-results.xlsx",
    ROOT / "study-metadata.json",
]
ROOT_GENERATED = ROOT / "dashboard-data.js"
ARCHIVE_FILENAMES = [path.name for path in ROOT_INPUTS]


def study_dirs() -> list[Path]:
    if not PUBLISH_DIR.exists():
        return []
    return [
        path
        for path in PUBLISH_DIR.iterdir()
        if path.is_dir() and (path / "index.html").exists() and (path / "dashboard-data.js").exists()
    ]


def archive_dirs() -> list[Path]:
    if not ARCHIVES_DIR.exists():
        raise FileNotFoundError(f"{ARCHIVES_DIR} does not exist. Archive studies before rebuilding.")
    archives = sorted(path for path in ARCHIVES_DIR.iterdir() if path.is_dir())
    if not archives:
        raise FileNotFoundError(f"No archived studies found in {ARCHIVES_DIR}.")
    return archives


def validate_archive(archive: Path) -> None:
    missing = [file_name for file_name in ARCHIVE_FILENAMES if not (archive / file_name).exists()]
    if missing:
        joined = ", ".join(missing)
        raise FileNotFoundError(f"{archive} is missing required archive file(s): {joined}")


def backup_root_files(backup_dir: Path) -> dict[Path, Path | None]:
    backup_map: dict[Path, Path | None] = {}
    for path in [*ROOT_INPUTS, ROOT_GENERATED]:
        if path.exists():
            backup = backup_dir / path.name
            shutil.copy2(path, backup)
            backup_map[path] = backup
        else:
            backup_map[path] = None
    return backup_map


def restore_root_files(backup_map: dict[Path, Path | None]) -> None:
    for original, backup in backup_map.items():
        if backup is not None and backup.exists():
            shutil.copy2(backup, original)
        elif original.exists():
            original.unlink()


def clear_published_studies() -> list[str]:
    removed = []
    for path in study_dirs():
        removed.append(path.name)
        shutil.rmtree(path)
    PUBLISH_DIR.mkdir(exist_ok=True)
    (PUBLISH_DIR / "CNAME").write_text(CNAME_DOMAIN, encoding="utf-8")
    return removed


def copy_archive_to_root(archive: Path) -> None:
    for file_name in ARCHIVE_FILENAMES:
        shutil.copy2(archive / file_name, ROOT / file_name)


def rebuild_all(dry_run: bool = False) -> None:
    archives = archive_dirs()
    for archive in archives:
        validate_archive(archive)

    if dry_run:
        print("Dry run: archived studies ready to rebuild:")
        for archive in archives:
            print(f"- {archive.name}")
        print("No files were changed.")
        return

    with tempfile.TemporaryDirectory(prefix="backtest-rebuild-") as tmp:
        backup_map = backup_root_files(Path(tmp))
        try:
            removed = clear_published_studies()
            if removed:
                print("Cleared old published study folders:")
                for name in removed:
                    print(f"- {name}")

            for archive in archives:
                print(f"Rebuilding {archive.name}...")
                copy_archive_to_root(archive)
                export_study.main()

            (PUBLISH_DIR / "CNAME").write_text(CNAME_DOMAIN, encoding="utf-8")

            rebuilt = [path.name for path in study_dirs()]
            print("Rebuilt studies:")
            for name in rebuilt:
                print(f"- {name}")
            print(f"Preserved {PUBLISH_DIR / 'CNAME'} as {CNAME_DOMAIN}")
        finally:
            restore_root_files(backup_map)


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild every published study from local archived inputs.")
    parser.add_argument("--dry-run", action="store_true", help="Validate archives and list rebuild targets without changing files.")
    args = parser.parse_args()
    rebuild_all(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
