#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

import build_dashboard_data
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


def validate_published_archives(archives: list[Path]) -> None:
    archive_names = {archive.name for archive in archives}
    published_names = {study.name for study in study_dirs()}
    missing = sorted(published_names - archive_names)
    if missing:
        joined = ", ".join(missing)
        raise FileNotFoundError(f"Published study folder(s) missing matching archive(s): {joined}")


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


def validate_payload(archive: Path, payload: dict) -> None:
    problems = []
    signals = payload.get("signals") or []
    horizons = payload.get("horizons") or []
    series = payload.get("series") or []
    stats_rows = payload.get("statsRows") or {}
    result_table = payload.get("resultTable") or {}
    comparison = payload.get("comparison") or []
    summary_sections = payload.get("summarySections") or {}

    if not series:
        problems.append("no source price rows parsed")
    if not signals:
        problems.append("no signal rows parsed")
    if not horizons:
        problems.append("no forward-return horizons parsed")
    if not result_table.get("rows"):
        problems.append("results table parsed with no rows")
    if not summary_sections:
        problems.append("study summary parsed with no sections")

    required_stat_rows = [
        "Average Signal Return",
        "Median Signal Return",
        "Average All-Dataset Return",
        "Median All-Dataset Return",
        "Signal Hit Rate",
        "All-Dataset Hit Rate",
    ]
    missing_stats = [row for row in required_stat_rows if row not in stats_rows]
    if missing_stats:
        problems.append(f"missing summary stat row(s): {', '.join(missing_stats)}")

    numeric_comparison = [
        row
        for row in comparison
        if any(
            row.get(key) is not None
            for key in (
                "signalAverage",
                "signalMedian",
                "allAverage",
                "allMedian",
                "signalHitRate",
                "allHitRate",
            )
        )
    ]
    if comparison and not numeric_comparison:
        problems.append("comparison rows parsed, but all return and hit-rate stats are blank")

    expected_12m_points = build_dashboard_data.TRADING_DAY_HORIZONS["12M"] + 1
    short_completed = [
        signal.get("date")
        for signal in signals
        if signal.get("completed12M")
        and signal.get("asset") is not None
        and len(signal.get("performance") or []) < expected_12m_points
    ]
    if short_completed:
        preview = ", ".join(str(date) for date in short_completed[:5])
        extra = "" if len(short_completed) <= 5 else f" (+{len(short_completed) - 5} more)"
        problems.append(f"completed 12M signal(s) have short performance paths: {preview}{extra}")

    if problems:
        joined = "; ".join(problems)
        raise ValueError(joined)


def validate_archive_payloads(archives: list[Path]) -> None:
    failures = []
    with tempfile.TemporaryDirectory(prefix="backtest-parse-validate-") as tmp:
        backup_map = backup_root_files(Path(tmp))
        try:
            for archive in archives:
                try:
                    copy_archive_to_root(archive)
                    payload = build_dashboard_data.build_payload()
                    validate_payload(archive, payload)
                    completed = sum(1 for signal in payload.get("signals", []) if signal.get("completed12M"))
                    print(
                        f"Validated {archive.name}: "
                        f"{len(payload.get('signals', []))} signals, "
                        f"{completed} completed 12M windows, "
                        f"{len(payload.get('horizons', []))} horizons."
                    )
                except Exception as exc:
                    failures.append(f"- {archive.name}: {exc}")
        finally:
            restore_root_files(backup_map)

    if failures:
        details = "\n".join(failures)
        raise RuntimeError(f"Archive parse validation failed:\n{details}")


def rebuild_all(dry_run: bool = False) -> None:
    archives = archive_dirs()
    for archive in archives:
        validate_archive(archive)
    validate_published_archives(archives)
    validate_archive_payloads(archives)

    if dry_run:
        print("Dry run: every published study has a matching archive and every archive parsed successfully.")
        print("Archived studies ready to rebuild:")
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
