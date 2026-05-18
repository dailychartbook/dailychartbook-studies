#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime
from html import escape
from pathlib import Path

import build_dashboard_data


ROOT = Path(__file__).resolve().parents[1]
PUBLISH_DIR = ROOT / "docs"
CNAME_DOMAIN = "studies.dailychartbook.com"
WEB_FILES = ["index.html", "styles.css", "app.js", "dashboard-data.js"]
LOGO_FILE = "dc_logo_bnw.png"
LOGO_SOURCES = [ROOT / LOGO_FILE, ROOT / "DC_Logo_BnW.png"]
LANDING_LOGO_FILE = "dc-logo-wnb.png"
LANDING_LOGO_SOURCES = [ROOT / LANDING_LOGO_FILE]
WATERMARK_FILE = "dc_watermark_w.png"
WATERMARK_SOURCES = [ROOT / WATERMARK_FILE, ROOT / "DC_Watermark_W.png"]


def slugify(text: str, fallback: str = "backtest-study") -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = normalized.replace("%", "pct")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    if not normalized:
        normalized = fallback
    return normalized[:90].strip("-")


def format_display_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return value
    return parsed.strftime("%b %-d, %Y")


def compact_description(payload: dict) -> str:
    description = str(payload.get("description") or "").strip()
    if not description:
        description = str(payload.get("aiDescription") or "").strip()
    if not description:
        summary_text = payload.get("summaryText") or []
        description = next((str(item).strip() for item in summary_text[1:] if str(item).strip()), "")
    if not description:
        return "Interactive dashboard for this backtest study."

    first_sentence = re.split(r"(?<=[.!?])\s+", description)[0].strip()
    description = first_sentence or description
    if len(description) <= 220:
        return description
    return description[:217].rstrip() + "..."


def read_study_card(study: Path) -> dict:
    data_file = study / "dashboard-data.js"
    payload: dict = {}
    if data_file.exists():
        text = data_file.read_text(encoding="utf-8")
        prefix = "window.BACKTEST_DATA = "
        if text.startswith(prefix):
            payload = json.loads(text[len(prefix) :].rstrip(";\n"))

    title = str(payload.get("title") or study.name).strip()
    date_range = payload.get("dateRange") or {}
    start = format_display_date(date_range.get("start"))
    end = format_display_date(date_range.get("end"))
    if start and end:
        date_label = f"{start} - {end}"
    else:
        date_label = end or start or ""

    return {
        "href": f"./{study.name}/",
        "title": title,
        "description": compact_description(payload),
        "date": date_label,
    }


def copy_logo(destination: Path) -> None:
    logo_source = next((path for path in LOGO_SOURCES if path.exists()), None)
    if logo_source:
        shutil.copy2(logo_source, destination / LOGO_FILE)


def copy_landing_logo(destination: Path) -> None:
    logo_source = next((path for path in LANDING_LOGO_SOURCES if path.exists()), None)
    if logo_source:
        shutil.copy2(logo_source, destination / LANDING_LOGO_FILE)


def copy_watermark(destination: Path) -> None:
    watermark_source = next((path for path in WATERMARK_SOURCES if path.exists()), None)
    if watermark_source:
        shutil.copy2(watermark_source, destination / WATERMARK_FILE)


def build_landing_page(studies: list[Path]) -> str:
    cards = []
    for study in sorted(studies):
        card = read_study_card(study)
        date = f'<p class="study-date">{escape(card["date"])}</p>' if card["date"] else ""
        cards.append(
            f"""<article class="study-card">
          <div>
            {date}
            <h2><a class="study-title-link" href="{escape(card["href"])}">{escape(card["title"])}</a></h2>
            <p class="study-description">{escape(card["description"])}</p>
          </div>
          <a class="study-link" href="{escape(card["href"])}">Open study &rarr;</a>
        </article>"""
        )

    items = "\n        ".join(cards) if cards else '<p class="empty-state">No exported studies yet.</p>'
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Backtests: Visualized</title>
    <style>
      :root {{
        --accent: #26984D;
        --ink: #171717;
        --muted: #666f68;
        --line: #e4e7e2;
        --soft: #f7f8f5;
      }}

      * {{
        box-sizing: border-box;
      }}

      body {{
        margin: 0;
        min-height: 100vh;
        background: #fff;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }}

      .page-shell {{
        width: min(1120px, calc(100vw - 36px));
        margin: 0 auto;
        padding: 30px 0 56px;
      }}

      .site-nav {{
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 18px;
        align-items: center;
        padding-bottom: 28px;
        border-bottom: 1px solid var(--line);
      }}

      .brand-mark {{
        color: var(--accent);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }}

      .home-link {{
        display: inline-flex;
        align-items: center;
        justify-self: end;
        min-height: 36px;
        padding: 8px 13px;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--ink);
        font-size: 0.86rem;
        font-weight: 750;
        text-decoration: none;
      }}

      .home-link:hover {{
        border-color: var(--accent);
        color: var(--accent);
      }}

      .site-logo {{
        display: block;
        width: 92px;
        height: 92px;
        object-fit: contain;
      }}

      main {{
        padding-top: 58px;
      }}

      .hero {{
        max-width: 760px;
        margin: 0 auto 30px;
        text-align: center;
      }}

      h1 {{
        margin: 0 auto;
        max-width: 760px;
        font-size: clamp(2.1rem, 5vw, 4.6rem);
        line-height: 0.98;
        letter-spacing: 0;
      }}

      p {{
        color: var(--muted);
      }}

      .subtitle {{
        max-width: 560px;
        margin: 18px auto 0;
        font-size: clamp(1.05rem, 1.8vw, 1.28rem);
        line-height: 1.48;
      }}

      .studies-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
        gap: 18px;
        margin-top: 34px;
      }}

      .study-card {{
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 250px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 18px 42px rgba(23, 23, 23, 0.06);
      }}

      .study-date {{
        margin: 0 0 14px;
        color: var(--accent);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }}

      h2 {{
        margin: 0;
        color: var(--ink);
        font-size: 1.42rem;
        line-height: 1.18;
        letter-spacing: 0;
      }}

      .study-title-link {{
        color: inherit;
        text-decoration: none;
      }}

      .study-title-link:hover {{
        color: var(--accent);
      }}

      .study-description {{
        margin: 14px 0 0;
        line-height: 1.55;
      }}

      .study-link {{
        margin-top: 26px;
        color: var(--accent);
        font-weight: 820;
        text-decoration: none;
      }}

      .study-link:hover {{
        text-decoration: underline;
      }}

      .empty-state {{
        padding: 22px;
        border: 1px dashed var(--line);
        border-radius: 12px;
        background: var(--soft);
      }}

      @media (max-width: 640px) {{
        .page-shell {{
          width: min(100vw - 28px, 1120px);
          padding-top: 20px;
        }}

        .site-nav {{
          grid-template-columns: 1fr auto;
          align-items: center;
        }}

        .site-logo {{
          grid-column: 1 / -1;
          grid-row: 1;
          justify-self: center;
          width: 82px;
          height: 82px;
        }}

        .brand-mark {{
          grid-column: 1;
          grid-row: 2;
        }}

        .home-link {{
          grid-column: 2;
          grid-row: 2;
        }}

        main {{
          padding-top: 36px;
        }}

        .study-card {{
          min-height: 0;
          padding: 20px;
        }}
      }}
    </style>
  </head>
  <body>
    <div class="page-shell">
      <header class="site-nav">
        <div class="brand-mark">Daily Chartbook Studies</div>
        <img class="site-logo" src="{LANDING_LOGO_FILE}" alt="Daily Chartbook logo">
        <a class="home-link" href="https://www.dailychartbook.com">Daily Chartbook</a>
      </header>
      <main>
        <section class="hero">
          <h1>Backtests: Visualized</h1>
          <p class="subtitle">Interactive backtest dashboards and market studies.</p>
        </section>
        <section class="studies-grid" aria-label="Backtest studies">
          {items}
        </section>
      </main>
    </div>
  </body>
</html>
"""


def main() -> None:
    payload = build_dashboard_data.build_payload()
    build_dashboard_data.OUTPUT_JS.write_text(
        f"window.BACKTEST_DATA = {json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )

    metadata_slug = str(payload.get("slug") or "").strip()
    if metadata_slug:
        slug = slugify(metadata_slug)
    else:
        date_part = payload.get("dateRange", {}).get("end") or datetime.now().date().isoformat()
        slug = slugify(f"{date_part}-{payload.get('title', 'backtest-study')}")
    study_dir = PUBLISH_DIR / slug
    study_dir.mkdir(parents=True, exist_ok=True)

    for file_name in WEB_FILES:
        shutil.copy2(ROOT / file_name, study_dir / file_name)
    copy_logo(study_dir)
    copy_watermark(study_dir)

    (study_dir / "README.txt").write_text(
        "This folder is a self-contained static Backtest Visualizer study. "
        "GitHub Pages publishes the parent docs folder as the public site.\n",
        encoding="utf-8",
    )

    study_dirs = [path for path in PUBLISH_DIR.iterdir() if path.is_dir() and (path / "index.html").exists()]
    copy_logo(PUBLISH_DIR)
    copy_landing_logo(PUBLISH_DIR)
    copy_watermark(PUBLISH_DIR)
    (PUBLISH_DIR / "index.html").write_text(build_landing_page(study_dirs), encoding="utf-8")
    (PUBLISH_DIR / "CNAME").write_text(CNAME_DOMAIN, encoding="utf-8")

    print(f"Exported {study_dir}")
    print(f"Landing page {PUBLISH_DIR / 'index.html'}")
    print(f"CNAME {PUBLISH_DIR / 'CNAME'}")


if __name__ == "__main__":
    main()
