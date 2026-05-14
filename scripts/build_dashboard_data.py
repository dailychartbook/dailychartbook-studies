#!/usr/bin/env python3
from __future__ import annotations

import bisect
import json
import math
import re
import statistics
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
DATA_XLSX = ROOT / "backtest-data.xlsx"
RESULTS_XLSX = ROOT / "backtest-results.xlsx"
OUTPUT_JS = ROOT / "dashboard-data.js"

TRADING_DAY_HORIZONS = {
    "1W": 5,
    "2W": 10,
    "1M": 21,
    "2M": 42,
    "3M": 63,
    "6M": 126,
    "9M": 189,
    "12M": 252,
}

CARD_HORIZONS = ["1M", "3M", "6M", "9M", "12M"]

HORIZON_ALIASES = {
    "1w": "1W",
    "1 wk": "1W",
    "1 week": "1W",
    "2w": "2W",
    "2 wk": "2W",
    "2 week": "2W",
    "2 weeks": "2W",
    "1m": "1M",
    "1 mo": "1M",
    "1 month": "1M",
    "2m": "2M",
    "2 mo": "2M",
    "2 month": "2M",
    "2 months": "2M",
    "3m": "3M",
    "3 mo": "3M",
    "3 month": "3M",
    "3 months": "3M",
    "6m": "6M",
    "6 mo": "6M",
    "6 month": "6M",
    "6 months": "6M",
    "9m": "9M",
    "9 mo": "9M",
    "9 month": "9M",
    "9 months": "9M",
    "12m": "12M",
    "12 mo": "12M",
    "12 month": "12M",
    "12 months": "12M",
    "1y": "12M",
    "1 yr": "12M",
    "1 year": "12M",
}

STAT_LABEL_ALIASES = {
    "median signal return": "Median Signal Return",
    "median signal": "Median Signal Return",
    "median return signal": "Median Signal Return",
    "signal median": "Median Signal Return",
    "average signal return": "Average Signal Return",
    "average signal": "Average Signal Return",
    "avg signal return": "Average Signal Return",
    "avg signal": "Average Signal Return",
    "mean signal return": "Average Signal Return",
    "hit rate signal": "Signal Hit Rate",
    "signal hit rate": "Signal Hit Rate",
    "signal z score": "Signal Z-Score",
    "z score": "Signal Z-Score",
    "zscore": "Signal Z-Score",
    "median all dataset return": "Median All-Dataset Return",
    "median all dataset": "Median All-Dataset Return",
    "median all day return": "Median All-Dataset Return",
    "median all day": "Median All-Dataset Return",
    "median baseline return": "Median All-Dataset Return",
    "average all dataset return": "Average All-Dataset Return",
    "average all dataset": "Average All-Dataset Return",
    "avg all dataset return": "Average All-Dataset Return",
    "avg all dataset": "Average All-Dataset Return",
    "average all day return": "Average All-Dataset Return",
    "avg all day return": "Average All-Dataset Return",
    "average baseline return": "Average All-Dataset Return",
    "hit rate all dataset": "All-Dataset Hit Rate",
    "all dataset hit rate": "All-Dataset Hit Rate",
    "hit rate all day": "All-Dataset Hit Rate",
    "all day hit rate": "All-Dataset Hit Rate",
    "baseline hit rate": "All-Dataset Hit Rate",
}


def normalize_key(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("−", "-").replace("–", "-").replace("—", "-")
    text = re.sub(r"([a-zA-Z])([0-9])", r"\1 \2", text)
    text = re.sub(r"([0-9])([a-zA-Z])", r"\1 \2", text)
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().lower()
    return re.sub(r"\s+", " ", text)


def normalize_header(value: Any) -> str:
    text = "" if value is None else str(value).strip()
    key = normalize_key(text)
    if not key:
        return ""
    if key == "signal date":
        return "Signal Date"
    if key in HORIZON_ALIASES:
        return HORIZON_ALIASES[key]
    if "max" in key and ("dd" in key or "drawdown" in key):
        if "12" in key or "1 y" in key or "1 year" in key:
            return "12M MaxDD"
    return re.sub(r"\s+", " ", text)


def canonical_stat_label(value: Any) -> str | None:
    key = normalize_key(value)
    return STAT_LABEL_ALIASES.get(key)


def parse_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%B %d, %Y"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                pass
    return None


def to_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return float(value)
        return None
    if isinstance(value, str):
        stripped = value.strip().replace(",", "")
        if stripped.lower() in {"", "n/a", "na", "none", "-"}:
            return None
        is_percent = stripped.endswith("%")
        if is_percent:
            stripped = stripped[:-1]
        try:
            num = float(stripped)
            return num / 100 if is_percent else num
        except ValueError:
            return None
    return None


def serialize_cell(value: Any) -> Any:
    parsed_date = parse_date(value)
    if parsed_date:
        return parsed_date
    number = to_number(value)
    if number is not None:
        return number
    if value is None:
        return None
    return str(value)


def percentile(values: list[float], q: float) -> float | None:
    clean = sorted(v for v in values if v is not None and math.isfinite(v))
    if not clean:
        return None
    if len(clean) == 1:
        return clean[0]
    pos = (len(clean) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return clean[lo]
    weight = pos - lo
    return clean[lo] * (1 - weight) + clean[hi] * weight


def median(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None and math.isfinite(v)]
    return statistics.median(clean) if clean else None


def average(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None and math.isfinite(v)]
    return sum(clean) / len(clean) if clean else None


def read_source_data() -> dict[str, Any]:
    workbook = openpyxl.load_workbook(DATA_XLSX, data_only=True, read_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    headers = [str(cell.value).strip() if cell.value is not None else "" for cell in sheet[1]]
    if len(headers) < 3:
        raise ValueError("backtest-data.xlsx needs at least Date, asset, and trigger columns.")

    series: list[dict[str, Any]] = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        row_date = parse_date(row[0])
        asset = to_number(row[1])
        indicator = to_number(row[2])
        if row_date and asset is not None and indicator is not None:
            series.append({"date": row_date, "asset": asset, "indicator": indicator})

    if not series:
        raise ValueError("No usable rows found in backtest-data.xlsx.")

    return {
        "assetName": headers[1],
        "indicatorName": headers[2],
        "series": series,
        "dateRange": {
            "start": series[0]["date"],
            "end": series[-1]["date"],
            "tradingDays": len(series),
        },
    }


def find_results_table(workbook: openpyxl.Workbook) -> tuple[openpyxl.worksheet.worksheet.Worksheet, int, int]:
    for sheet in workbook.worksheets:
        for row_idx in range(1, sheet.max_row + 1):
            row = [sheet.cell(row_idx, col).value for col in range(1, sheet.max_column + 1)]
            for col_idx, value in enumerate(row, start=1):
                if normalize_header(value) != "Signal Date":
                    continue
                headers = [normalize_header(cell) for cell in row[col_idx - 1 :]]
                horizon_count = sum(1 for header in headers if header in TRADING_DAY_HORIZONS)
                if horizon_count >= 2:
                    return sheet, row_idx, col_idx
    raise ValueError("Could not find a sheet with a 'Signal Date' header.")


def read_summary_text(workbook: openpyxl.Workbook) -> tuple[str, list[str]]:
    if "Summary" not in workbook.sheetnames:
        return "Backtest Visualizer", []
    sheet = workbook["Summary"]
    text = []
    for row in sheet.iter_rows(values_only=True):
        value = next((cell for cell in row if cell is not None and str(cell).strip()), None) if row else None
        if value is not None and str(value).strip():
            text.append(str(value).strip())
    title = text[0] if text else "Backtest Visualizer"
    return title, text


def read_results() -> dict[str, Any]:
    workbook = openpyxl.load_workbook(RESULTS_XLSX, data_only=True, read_only=False)
    title, summary_text = read_summary_text(workbook)
    sheet, header_row, header_start_col = find_results_table(workbook)

    header_cols = [
        col
        for col in range(header_start_col, sheet.max_column + 1)
        if sheet.cell(header_row, col).value is not None and str(sheet.cell(header_row, col).value).strip()
    ]
    if not header_cols:
        raise ValueError("Could not read the Backtest Results header row.")
    last_header_col = max(header_cols)
    table_cols = list(range(header_start_col, last_header_col + 1))

    headers = [
        normalize_header(sheet.cell(header_row, col).value) or f"Column {col}"
        for col in table_cols
    ]

    table_rows: list[dict[str, Any]] = []
    signal_rows: list[dict[str, Any]] = []
    stats_rows: dict[str, dict[str, Any]] = {}
    notes: list[str] = []

    for row_num in range(header_row + 1, sheet.max_row + 1):
        values = [sheet.cell(row_num, col).value for col in table_cols]
        if not any(value is not None and str(value).strip() != "" for value in values):
            continue

        row_values = [serialize_cell(value) for value in values]
        first_text = "" if values[0] is None else str(values[0]).strip()
        parsed_signal_date = parse_date(values[0])
        canonical_label = canonical_stat_label(first_text)
        kind = "signal" if parsed_signal_date else "note" if first_text.startswith(("Notes", "-", "*", "•")) else "stat"

        table_rows.append({"kind": kind, "label": canonical_label or first_text, "values": row_values})

        if parsed_signal_date:
            row_map = {
                headers[idx]: to_number(values[idx]) if idx > 0 else parsed_signal_date
                for idx in range(len(headers))
            }
            signal_rows.append({"date": parsed_signal_date, "values": row_map})
        elif kind == "stat" and first_text:
            stats_key = canonical_label or first_text
            stats_rows[stats_key] = {
                headers[idx]: serialize_cell(values[idx]) if idx > 0 else stats_key
                for idx in range(len(headers))
            }
        elif first_text:
            notes.append(first_text)

    horizons = [header for header in headers[1:] if header in TRADING_DAY_HORIZONS]

    return {
        "title": title,
        "summaryText": summary_text,
        "headers": headers,
        "horizons": horizons,
        "signalRows": signal_rows,
        "statsRows": stats_rows,
        "notes": notes,
        "resultTable": {"headers": headers, "rows": table_rows},
    }


def stat_value(stats_rows: dict[str, dict[str, Any]], row_name: str, horizon: str) -> float | None:
    row = stats_rows.get(row_name)
    if not row:
        return None
    return to_number(row.get(horizon))


def find_source_index(dates: list[str], signal_date: str) -> int | None:
    position = bisect.bisect_left(dates, signal_date)
    if position < len(dates) and dates[position] == signal_date:
        return position
    if position < len(dates):
        return position
    return None


def enrich_signals(source: dict[str, Any], results: dict[str, Any]) -> list[dict[str, Any]]:
    series = source["series"]
    dates = [point["date"] for point in series]
    enriched: list[dict[str, Any]] = []

    for signal in results["signalRows"]:
        idx = find_source_index(dates, signal["date"])
        if idx is None:
            continue
        start = series[idx]
        start_asset = start["asset"]
        performance = []
        for offset in range(0, TRADING_DAY_HORIZONS["12M"] + 1):
            current_idx = idx + offset
            if current_idx >= len(series):
                break
            point = series[current_idx]
            performance.append(
                {
                    "day": offset,
                    "date": point["date"],
                    "return": point["asset"] / start_asset - 1,
                }
            )

        row_values = {
            key: value
            for key, value in signal["values"].items()
            if key != "Signal Date"
        }
        enriched.append(
            {
                "date": signal["date"],
                "asset": start["asset"],
                "indicator": start["indicator"],
                "values": row_values,
                "performance": performance,
                "completed12M": row_values.get("12M") is not None,
            }
        )

    return enriched


def build_median_performance(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    max_day = TRADING_DAY_HORIZONS["12M"]
    median_series = []
    for day in range(max_day + 1):
        values = []
        for signal in signals:
            if day < len(signal["performance"]):
                values.append(signal["performance"][day]["return"])
        day_median = median(values)
        if day_median is not None:
            median_series.append({"day": day, "return": day_median})
    return median_series


def build_comparison(results: dict[str, Any], signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stats = results["statsRows"]
    comparison = []
    for horizon in results["horizons"]:
        sample_size = sum(1 for signal in signals if to_number(signal["values"].get(horizon)) is not None)
        comparison.append(
            {
                "horizon": horizon,
                "signalCount": sample_size,
                "signalAverage": stat_value(stats, "Average Signal Return", horizon),
                "signalMedian": stat_value(stats, "Median Signal Return", horizon),
                "allAverage": stat_value(stats, "Average All-Dataset Return", horizon),
                "allMedian": stat_value(stats, "Median All-Dataset Return", horizon),
                "signalHitRate": stat_value(stats, "Signal Hit Rate", horizon),
                "allHitRate": stat_value(stats, "All-Dataset Hit Rate", horizon),
                "zScore": stat_value(stats, "Signal Z-Score", horizon),
            }
        )
    return comparison


def build_distribution(signals: list[dict[str, Any]], horizons: list[str]) -> list[dict[str, Any]]:
    distribution = []
    for horizon in horizons:
        dots = []
        values = []
        for signal in signals:
            value = to_number(signal["values"].get(horizon))
            if value is None:
                continue
            values.append(value)
            dots.append(
                {
                    "date": signal["date"],
                    "value": value,
                    "asset": signal["asset"],
                    "indicator": signal["indicator"],
                }
            )
        clean = sorted(values)
        distribution.append(
            {
                "horizon": horizon,
                "values": dots,
                "box": {
                    "min": clean[0] if clean else None,
                    "q1": percentile(clean, 0.25),
                    "median": percentile(clean, 0.5),
                    "q3": percentile(clean, 0.75),
                    "max": clean[-1] if clean else None,
                },
            }
        )
    return distribution


def build_cards(signals: list[dict[str, Any]], results: dict[str, Any]) -> list[dict[str, Any]]:
    stats = results["statsRows"]
    completed_count = sum(1 for signal in signals if signal.get("completed12M"))
    cards = [
        {
            "kind": "count",
            "label": "Signal count",
            "value": len(signals),
            "detail": f"{completed_count} completed 12M windows",
        }
    ]

    horizon_samples: dict[str, list[float]] = {}
    for horizon in CARD_HORIZONS:
        horizon_values = [to_number(signal["values"].get(horizon)) for signal in signals]
        clean = [value for value in horizon_values if value is not None]
        horizon_samples[horizon] = clean
        median_return = stat_value(stats, "Median Signal Return", horizon)
        if median_return is None:
            median_return = median(clean)
        cards.append(
            {
                "kind": "medianReturn",
                "label": f"{horizon} median return",
                "horizon": horizon,
                "value": median_return,
                "baseline": stat_value(stats, "Median All-Dataset Return", horizon),
                "sampleSize": len(clean),
            }
        )

    maxdd_values = [to_number(signal["values"].get("12M MaxDD")) for signal in signals]
    clean_dd = [value for value in maxdd_values if value is not None]
    cards.append(
        {
            "kind": "drawdown",
            "label": "Avg. max drawdown",
            "value": average(clean_dd),
            "median": median(clean_dd),
            "sampleSize": len(clean_dd),
        }
    )

    for horizon in CARD_HORIZONS:
        clean = horizon_samples[horizon]
        hit_rate = stat_value(stats, "Signal Hit Rate", horizon)
        if hit_rate is None and clean:
            hit_rate = sum(1 for value in clean if value > 0) / len(clean)
        cards.append(
            {
                "kind": "hitRate",
                "label": f"{horizon} hit rate",
                "horizon": horizon,
                "value": hit_rate,
                "baseline": stat_value(stats, "All-Dataset Hit Rate", horizon),
                "sampleSize": len(clean),
            }
        )
    return cards


def generate_description(source: dict[str, Any], signals: list[dict[str, Any]], results: dict[str, Any]) -> str:
    stats = results["statsRows"]
    signal_count = len(signals)
    completed = sum(1 for signal in signals if signal.get("completed12M"))
    one_month = stat_value(stats, "Average Signal Return", "1M")
    one_month_base = stat_value(stats, "Average All-Dataset Return", "1M")
    twelve_month = stat_value(stats, "Average Signal Return", "12M")
    twelve_month_base = stat_value(stats, "Average All-Dataset Return", "12M")
    twelve_median = stat_value(stats, "Median Signal Return", "12M")
    drawdown = average([to_number(signal["values"].get("12M MaxDD")) for signal in signals])

    short_term = "mixed"
    if one_month is not None and one_month_base is not None:
        short_term = "weaker than the all-day baseline" if one_month < one_month_base else "stronger than the all-day baseline"

    long_term = "mixed"
    if twelve_month is not None and twelve_month_base is not None:
        long_term = "above baseline" if twelve_month > twelve_month_base else "below baseline"

    parts = [
        f"This {source['assetName']} backtest found {signal_count} signals from {source['dateRange']['start']} through {source['dateRange']['end']}, with {completed} completed 12-month forward windows.",
        f"The setup's 1-month average forward return was {format_percent(one_month)} versus {format_percent(one_month_base)} for all days, making the short-term read {short_term}.",
        f"At 12 months, average signal return was {format_percent(twelve_month)} versus {format_percent(twelve_month_base)} baseline, while the median signal return was {format_percent(twelve_median)}.",
        f"Average 12-month max drawdown after signals was {format_percent(drawdown)}, so the sample points to meaningful path risk even when the 12-month endpoint is positive.",
    ]
    return " ".join(parts)


def format_percent(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%"


def build_payload() -> dict[str, Any]:
    source = read_source_data()
    results = read_results()
    signals = enrich_signals(source, results)
    comparison = build_comparison(results, signals)
    distribution = build_distribution(signals, results["horizons"])
    cards = build_cards(signals, results)

    payload = {
        "title": results["title"],
        "assetName": source["assetName"],
        "indicatorName": source["indicatorName"],
        "dateRange": source["dateRange"],
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "aiDescription": generate_description(source, signals, results),
        "summaryText": results["summaryText"],
        "horizons": results["horizons"],
        "cardHorizons": CARD_HORIZONS,
        "series": source["series"],
        "signals": signals,
        "medianPerformance": build_median_performance(signals),
        "comparison": comparison,
        "distribution": distribution,
        "cards": cards,
        "statsRows": results["statsRows"],
        "resultTable": results["resultTable"],
    }
    return payload


def main() -> None:
    payload = build_payload()
    body = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    OUTPUT_JS.write_text(f"window.BACKTEST_DATA = {body};\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_JS}")


if __name__ == "__main__":
    main()
