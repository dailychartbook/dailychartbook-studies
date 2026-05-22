#!/usr/bin/env python3
from __future__ import annotations

import json
import math
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
GA4_MEASUREMENT_ID = "G-DS53FBC30P"
BUG_REPORT_EMAIL = "dailychartbook@pm.me"
BUG_REPORT_SUBJECT = "Daily Chartbook Studies bug report"
WEB_FILES = ["index.html", "styles.css", "app.js", "dashboard-data.js"]
FAVICON_FILE = "DC_Logo_BnW.png"
FAVICON_SOURCES = [ROOT / FAVICON_FILE]
LOGO_FILE = FAVICON_FILE
LOGO_SOURCES = [ROOT / LOGO_FILE]
LANDING_LOGO_FILE = "dc-logo-wnb.png"
LANDING_LOGO_SOURCES = [ROOT / LANDING_LOGO_FILE]
WATERMARK_FILE = LANDING_LOGO_FILE
WATERMARK_SOURCES = [ROOT / LANDING_LOGO_FILE]
THUMBNAIL_FILE = "trigger-map-thumbnail.svg"
DISCLAIMER = (
    "Daily Chartbook Studies are for informational and educational purposes only and are not investment advice "
    "or a recommendation to buy or sell any security, strategy, or financial instrument. Past performance is not "
    "indicative of future results. Backtested results are hypothetical, assumption-dependent, and may not reflect "
    "trading costs, taxes, slippage, liquidity, or execution constraints. Data and calculations may contain errors "
    "or omissions. Readers should conduct their own research and consult a qualified adviser before making investment decisions."
)


def google_tag() -> str:
    return f"""<script async src="https://www.googletagmanager.com/gtag/js?id={GA4_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', '{GA4_MEASUREMENT_ID}');
    </script>"""


def bug_report_script() -> str:
    return """<script>
      document.querySelectorAll("[data-report-bug-button]").forEach((button) => {
        button.addEventListener("click", () => {
          const email = button.dataset.reportEmail || "dailychartbook@pm.me";
          const subject = button.dataset.reportSubject || "Daily Chartbook Studies bug report";
          const body = `Page: ${window.location.href}\\n\\nWhat happened?\\n`;
          const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          const original = button.dataset.label || button.textContent;
          button.dataset.label = original;
          window.setTimeout(async () => {
            if (document.hidden) return;
            let label = email;
            try {
              if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
              await navigator.clipboard.writeText(email);
              label = "Email copied";
            } catch {
              // Showing the address is the fallback when clipboard access is unavailable.
            }
            button.textContent = label;
            window.setTimeout(() => {
              button.textContent = button.dataset.label;
            }, 2200);
          }, 900);
          window.location.href = href;
        });
      });
    </script>"""


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


def format_percent(value: float | None, digits: int = 1, signed: bool = True) -> str | None:
    if value is None:
        return None
    sign = "+" if signed and value > 0 else ""
    return f"{sign}{value * 100:.{digits}f}%"


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


def latest_signal_date(payload: dict) -> str | None:
    dates = [
        str(signal.get("date")).strip()
        for signal in payload.get("signals", [])
        if isinstance(signal, dict) and signal.get("date")
    ]
    return max(dates) if dates else None


def study_key_result(payload: dict) -> str:
    comparison_12m = next(
        (point for point in payload.get("comparison", []) if isinstance(point, dict) and point.get("horizon") == "12M"),
        None,
    )
    signal_average = format_percent(safe_float(comparison_12m.get("signalAverage")) if comparison_12m else None)
    hit_rate = format_percent(safe_float(comparison_12m.get("signalHitRate")) if comparison_12m else None, digits=0, signed=False)
    count_card = next((card for card in payload.get("cards", []) if isinstance(card, dict) and card.get("kind") == "count"), None)
    signal_count = count_card.get("value") if count_card else len(payload.get("signals", []) or [])

    parts = []
    if signal_average is not None:
        parts.append(f"12M avg {signal_average}")
    if hit_rate is not None:
        parts.append(f"12M hit rate {hit_rate}")
    if signal_count:
        parts.append(f"n={signal_count}")
    return " | ".join(parts)


def safe_float(value) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def date_number(value: str) -> int | None:
    try:
        return datetime.fromisoformat(value).toordinal()
    except (TypeError, ValueError):
        return None


def sampled_series(series: list[dict], max_points: int = 320) -> list[dict]:
    if len(series) <= max_points:
        return series
    step = (len(series) - 1) / (max_points - 1)
    sampled = []
    seen_dates = set()
    for idx in range(max_points):
        point = series[round(idx * step)]
        point_date = point.get("date")
        if point_date in seen_dates:
            continue
        seen_dates.add(point_date)
        sampled.append(point)
    return sampled


def write_trigger_thumbnail(payload: dict, destination: Path) -> None:
    series = [point for point in payload.get("series", []) if date_number(point.get("date")) and safe_float(point.get("asset"))]
    if len(series) < 2:
        return

    signals = [
        signal
        for signal in payload.get("signals", [])
        if date_number(signal.get("date")) and safe_float(signal.get("asset"))
    ]
    width = 720
    height = 270
    plot = {"left": 28, "right": 692, "top": 24, "bottom": 226}
    times = [date_number(point["date"]) for point in series]
    values = [safe_float(point["asset"]) for point in series]
    positive_values = [value for value in values if value and value > 0]
    if not positive_values:
        return

    x_min, x_max = min(times), max(times)
    y_min = max(min(positive_values) * 0.92, 0.000001)
    y_max = max(positive_values) * 1.05
    if y_min == y_max:
        y_min *= 0.95
        y_max *= 1.05
    log_min = math.log(y_min)
    log_span = math.log(y_max) - log_min or 1

    def x_scale(value: int) -> float:
        return plot["left"] + ((value - x_min) / (x_max - x_min or 1)) * (plot["right"] - plot["left"])

    def y_scale(value: float) -> float:
        return plot["bottom"] - ((math.log(max(value, 0.000001)) - log_min) / log_span) * (plot["bottom"] - plot["top"])

    path_parts = []
    for point in sampled_series(series):
        point_time = date_number(point["date"])
        point_value = safe_float(point["asset"])
        if point_time is None or point_value is None:
            continue
        command = "M" if not path_parts else "L"
        path_parts.append(f"{command}{x_scale(point_time):.2f},{y_scale(point_value):.2f}")

    signal_dots = []
    for signal in signals:
        signal_time = date_number(signal["date"])
        signal_value = safe_float(signal["asset"])
        if signal_time is None or signal_value is None:
            continue
        signal_dots.append(
            f'<circle cx="{x_scale(signal_time):.2f}" cy="{y_scale(signal_value):.2f}" r="4.2" fill="#ff1d18" stroke="#9d0000" stroke-width="1.2"/>'
        )

    asset_name = escape(str(payload.get("assetName") or "Asset"))
    svg_body = "\n    ".join(signal_dots)
    thumbnail = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{asset_name} signal map thumbnail">
  <rect width="{width}" height="{height}" fill="#fff"/>
  <rect x="{plot["left"]}" y="{plot["top"]}" width="{plot["right"] - plot["left"]}" height="{plot["bottom"] - plot["top"]}" rx="8" fill="#fbfcf8" stroke="#d9ded5"/>
  <path d="{"".join(path_parts)}" fill="none" stroke="#151515" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  {svg_body}
</svg>
"""
    (destination / THUMBNAIL_FILE).write_text(thumbnail, encoding="utf-8")


def read_study_card(study: Path) -> dict:
    data_file = study / "dashboard-data.js"
    payload: dict = {}
    if data_file.exists():
        text = data_file.read_text(encoding="utf-8")
        prefix = "window.BACKTEST_DATA = "
        if text.startswith(prefix):
            payload = json.loads(text[len(prefix) :].rstrip(";\n"))

    title = str(payload.get("title") or study.name).strip()
    latest_signal = latest_signal_date(payload)
    date_range = payload.get("dateRange") or {}
    start = format_display_date(date_range.get("start"))
    end = format_display_date(date_range.get("end"))
    if latest_signal:
        date_label = f"Most recent signal: {format_display_date(latest_signal)}"
    elif start and end:
        date_label = f"{start} - {end}"
    else:
        date_label = end or start or ""
    published = payload.get("publishedDate") or payload.get("published")
    published_label = f"Published: {format_display_date(published)}" if published else ""

    return {
        "href": f"./{study.name}/",
        "title": title,
        "description": compact_description(payload),
        "date": date_label,
        "publishedDate": published_label,
        "keyResult": study_key_result(payload),
        "sortDate": latest_signal or date_range.get("end") or date_range.get("start") or "",
        "thumbnail": f"./{study.name}/{THUMBNAIL_FILE}" if (study / THUMBNAIL_FILE).exists() else "",
    }


def customized_study_index(payload: dict) -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    title = str(payload.get("title") or "Backtest Visualizer").strip()
    description = compact_description(payload)
    html = re.sub(r"<title>.*?</title>", f"<title>{escape(title)} | Daily Chartbook Studies</title>", html, count=1, flags=re.DOTALL)
    meta_tag = f'<meta name="description" content="{escape(description, quote=True)}">'
    if '<meta name="description"' in html:
        html = re.sub(r'\s*<meta name="description" content=".*?">', f"\n    {meta_tag}", html, count=1, flags=re.DOTALL)
    else:
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n    {meta_tag}',
            1,
        )
    html = re.sub(
        r'(<h1 id="study-title">).*?(</h1>)',
        lambda match: f"{match.group(1)}{escape(title)}{match.group(2)}",
        html,
        count=1,
        flags=re.DOTALL,
    )
    return html


def copy_logo(destination: Path) -> None:
    logo_source = next((path for path in LOGO_SOURCES if path.exists()), None)
    if logo_source:
        shutil.copy2(logo_source, destination / LOGO_FILE)


def copy_favicon(destination: Path) -> None:
    favicon_source = next((path for path in FAVICON_SOURCES if path.exists()), None)
    if favicon_source:
        shutil.copy2(favicon_source, destination / FAVICON_FILE)


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
    study_cards = [read_study_card(study) for study in studies]
    study_cards.sort(key=lambda card: card["title"].lower())
    study_cards.sort(key=lambda card: card["sortDate"] or "0000-00-00", reverse=True)
    for card in study_cards:
        date = f'<p class="study-date">{escape(card["date"])}</p>' if card["date"] else ""
        published_date = f'<p class="study-published">{escape(card["publishedDate"])}</p>' if card["publishedDate"] else ""
        key_result = f'<p class="study-key-result">{escape(card["keyResult"])}</p>' if card["keyResult"] else ""
        thumbnail = (
            f"""<a class="study-thumbnail" href="{escape(card["href"])}" aria-label="Open {escape(card["title"], quote=True)}">
            <img src="{escape(card["thumbnail"])}" alt="Signal map thumbnail for {escape(card["title"], quote=True)}">
          </a>"""
            if card["thumbnail"]
            else ""
        )
        cards.append(
            f"""<article class="study-card">
          {thumbnail}
          <div class="study-card-body">
            {date}
            {published_date}
            <h2><a class="study-title-link" href="{escape(card["href"])}">{escape(card["title"])}</a></h2>
            {key_result}
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
    <link rel="icon" type="image/png" href="/DC_Logo_BnW.png">
    <link rel="apple-touch-icon" href="/DC_Logo_BnW.png">
    {google_tag()}
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

      .brand-block {{
        display: grid;
        justify-items: start;
        gap: 7px;
      }}

      .beta-tag {{
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 5px 8px;
        border: 1px solid rgba(38, 152, 77, 0.24);
        border-radius: 999px;
        background: rgba(38, 152, 77, 0.08);
        color: var(--accent);
        font-size: 0.68rem;
        font-weight: 820;
        line-height: 1;
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
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 18px 42px rgba(23, 23, 23, 0.06);
        overflow: hidden;
      }}

      .study-thumbnail {{
        display: block;
        border-bottom: 1px solid var(--line);
        background: var(--soft);
        text-decoration: none;
      }}

      .study-thumbnail img {{
        display: block;
        width: 100%;
        aspect-ratio: 16 / 6;
        object-fit: cover;
      }}

      .study-card-body {{
        padding: 22px 24px 0;
      }}

      .study-date {{
        margin: 0;
        color: var(--accent);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }}

      .study-published {{
        margin: 5px 0 14px;
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 700;
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

      .study-key-result {{
        display: inline-flex;
        margin: 16px 0 0;
        padding: 7px 9px;
        border: 1px solid rgba(38, 152, 77, 0.22);
        border-radius: 999px;
        background: rgba(38, 152, 77, 0.08);
        color: var(--ink);
        font-size: 0.78rem;
        font-weight: 780;
        line-height: 1.2;
      }}

      .study-link {{
        margin: 26px 24px 24px;
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

      .site-footer {{
        margin-top: 40px;
        padding-top: 22px;
        border-top: 1px solid var(--line);
        text-align: center;
      }}

      .footer-cta {{
        display: inline-flex;
        margin-bottom: 18px;
        color: var(--accent);
        font-size: 0.95rem;
        font-weight: 830;
        text-decoration: none;
      }}

      .footer-cta:hover {{
        text-decoration: underline;
      }}

      .disclaimer {{
        max-width: 980px;
        margin: 0 auto;
        color: var(--muted);
        font-size: 0.72rem;
        line-height: 1.55;
        text-align: center;
      }}

      .report-bug-button {{
        position: fixed;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 30;
        display: inline-flex;
        align-items: center;
        min-height: 38px;
        padding: 10px 14px;
        border: 1px solid rgba(38, 152, 77, 0.28);
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 820;
        line-height: 1;
        text-decoration: none;
        box-shadow: 0 16px 34px rgba(23, 23, 23, 0.16);
        cursor: pointer;
      }}

      .report-bug-button:hover,
      .report-bug-button:focus-visible {{
        background: #1f7d3f;
        outline: none;
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

        .brand-block {{
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
        }}

        .study-card-body {{
          padding: 20px 20px 0;
        }}

        .study-link {{
          margin: 22px 20px 20px;
        }}
      }}
    </style>
  </head>
  <body>
    <div class="page-shell">
      <header class="site-nav">
        <div class="brand-block">
          <div class="brand-mark">Daily Chartbook Studies</div>
          <div class="beta-tag" aria-label="Website is still in beta">BETA</div>
        </div>
        <img class="site-logo" src="{LANDING_LOGO_FILE}" alt="Daily Chartbook logo">
        <a class="home-link" href="https://www.dailychartbook.com">Daily Chartbook</a>
      </header>
      <main>
        <section class="hero">
          <h1>Backtests: Visualized</h1>
          <p class="subtitle">Interactive market study dashboards built to show you the numbers, not tell a story</p>
        </section>
        <section class="studies-grid" aria-label="Backtest studies">
          {items}
        </section>
      </main>
      <footer class="site-footer">
        <a class="footer-cta" href="https://www.dailychartbook.com">Get charts like these in your inbox &rarr; Subscribe to Daily Chartbook</a>
        <p class="disclaimer"><strong>Disclaimer:</strong> {escape(DISCLAIMER)}</p>
      </footer>
    </div>
    <button
      class="report-bug-button"
      type="button"
      data-report-bug-button
      data-report-email="{escape(BUG_REPORT_EMAIL, quote=True)}"
      data-report-subject="{escape(BUG_REPORT_SUBJECT, quote=True)}"
    >Report bug</button>
    {bug_report_script()}
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
    (study_dir / "index.html").write_text(customized_study_index(payload), encoding="utf-8")
    copy_favicon(study_dir)
    copy_logo(study_dir)
    copy_watermark(study_dir)
    write_trigger_thumbnail(payload, study_dir)

    (study_dir / "README.txt").write_text(
        "This folder is a self-contained static Backtest Visualizer study. "
        "GitHub Pages publishes the parent docs folder as the public site.\n",
        encoding="utf-8",
    )

    study_dirs = [path for path in PUBLISH_DIR.iterdir() if path.is_dir() and (path / "index.html").exists()]
    copy_favicon(PUBLISH_DIR)
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
