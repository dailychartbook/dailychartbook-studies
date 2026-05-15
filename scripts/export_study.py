#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime
from pathlib import Path

import build_dashboard_data


ROOT = Path(__file__).resolve().parents[1]
PUBLISH_DIR = ROOT / "docs"
CNAME_DOMAIN = "studies.dailychartbook.com"
WEB_FILES = ["index.html", "styles.css", "app.js", "dashboard-data.js"]


def slugify(text: str, fallback: str = "backtest-study") -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = normalized.replace("%", "pct")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    if not normalized:
        normalized = fallback
    return normalized[:90].strip("-")


def build_landing_page(studies: list[Path]) -> str:
    links = []
    for study in sorted(studies):
        data_file = study / "dashboard-data.js"
        title = study.name
        if data_file.exists():
            text = data_file.read_text(encoding="utf-8")
            prefix = "window.BACKTEST_DATA = "
            if text.startswith(prefix):
                payload = json.loads(text[len(prefix) :].rstrip(";\n"))
                title = payload.get("title", title)
        links.append(f'<li><a href="./{study.name}/">{title}</a></li>')

    items = "\n          ".join(links) if links else "<li>No exported studies yet.</li>"
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Backtest Studies</title>
    <style>
      body {{
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f7f8f5;
        color: #1d211c;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }}
      main {{
        width: min(860px, calc(100vw - 32px));
        padding: 34px;
        border: 1px solid #d9ded5;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 48px rgba(29, 33, 28, 0.08);
      }}
      p {{
        color: #657063;
      }}
      ul {{
        padding-left: 20px;
        line-height: 1.75;
      }}
      a {{
        color: #167c62;
        font-weight: 750;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Backtest Studies</h1>
      <p>Published dashboards from exported workbook studies.</p>
      <ul>
          {items}
      </ul>
    </main>
  </body>
</html>
"""


def main() -> None:
    payload = build_dashboard_data.build_payload()
    build_dashboard_data.OUTPUT_JS.write_text(
        f"window.BACKTEST_DATA = {json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )

    date_part = payload.get("dateRange", {}).get("end") or datetime.now().date().isoformat()
    slug = slugify(f"{date_part}-{payload.get('title', 'backtest-study')}")
    study_dir = PUBLISH_DIR / slug
    study_dir.mkdir(parents=True, exist_ok=True)

    for file_name in WEB_FILES:
        shutil.copy2(ROOT / file_name, study_dir / file_name)

    (study_dir / "README.txt").write_text(
        "This folder is a self-contained static Backtest Visualizer study. "
        "GitHub Pages publishes the parent docs folder as the public site.\n",
        encoding="utf-8",
    )

    study_dirs = [path for path in PUBLISH_DIR.iterdir() if path.is_dir() and (path / "index.html").exists()]
    (PUBLISH_DIR / "index.html").write_text(build_landing_page(study_dirs), encoding="utf-8")
    (PUBLISH_DIR / "CNAME").write_text(CNAME_DOMAIN, encoding="utf-8")

    print(f"Exported {study_dir}")
    print(f"Landing page {PUBLISH_DIR / 'index.html'}")
    print(f"CNAME {PUBLISH_DIR / 'CNAME'}")


if __name__ == "__main__":
    main()
