#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARCHIVES_DIR = ROOT / "Archives"
DATA_XLSX = ROOT / "backtest-data.xlsx"
RESULTS_XLSX = ROOT / "backtest-results.xlsx"
METADATA_JSON = ROOT / "study-metadata.json"
ARCHIVE_FILES = [DATA_XLSX, RESULTS_XLSX, METADATA_JSON]


def slugify(text: str, fallback: str = "backtest-study") -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = normalized.replace("%", "pct")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    return (normalized or fallback)[:90].strip("-")


def read_metadata() -> dict[str, str]:
    if not METADATA_JSON.exists():
        return {}
    try:
        raw = json.loads(METADATA_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse {METADATA_JSON.name}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError(f"{METADATA_JSON.name} must contain a JSON object.")
    return {key: value.strip() for key, value in raw.items() if isinstance(value, str) and value.strip()}


def archive_slug(metadata: dict[str, str]) -> str:
    timestamp = datetime.now().strftime("study-%Y%m%d-%H%M%S")
    if metadata.get("slug"):
        return slugify(metadata["slug"], fallback=timestamp)
    if metadata.get("title"):
        return slugify(metadata["title"], fallback=timestamp)
    return timestamp


def unique_archive_dir(base_slug: str) -> Path:
    candidate = ARCHIVES_DIR / base_slug
    if not candidate.exists():
        return candidate

    suffix = datetime.now().strftime("%Y%m%d-%H%M%S")
    candidate = ARCHIVES_DIR / f"{base_slug}-{suffix}"
    counter = 2
    while candidate.exists():
        candidate = ARCHIVES_DIR / f"{base_slug}-{suffix}-{counter}"
        counter += 1
    return candidate


def validate_sources() -> None:
    missing = [path.name for path in ARCHIVE_FILES if not path.exists()]
    if missing:
        joined = ", ".join(missing)
        raise FileNotFoundError(f"Cannot archive inputs because these files are missing: {joined}")


def main() -> None:
    metadata = read_metadata()
    validate_sources()

    ARCHIVES_DIR.mkdir(exist_ok=True)
    destination = unique_archive_dir(archive_slug(metadata))
    destination.mkdir(parents=True)

    for source in ARCHIVE_FILES:
        shutil.copy2(source, destination / source.name)

    print(f"Archived study inputs to {destination}")
    for source in ARCHIVE_FILES:
        print(f"- {source.name}")


if __name__ == "__main__":
    main()
