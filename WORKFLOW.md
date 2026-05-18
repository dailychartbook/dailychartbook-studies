# Operator Workflow

This file documents the internal workflow for generating and publishing Daily Chartbook study dashboards.

## Inputs

The raw Excel workbooks are local inputs and are intentionally ignored by Git:

- `backtest-data.xlsx`
- `backtest-results.xlsx`

Do not commit raw workbook inputs to the public repository.

## Metadata

`study-metadata.json` controls the public-facing study metadata:

- `title`: public dashboard and landing-page title
- `description`: short landing-page/card description
- `slug`: exported study folder name inside `docs/`

If a field is blank or missing, the scripts fall back to workbook-generated values.

## Public Output

Public/shareable output lives in `docs/`.

GitHub Pages publishes `docs/`, and that folder powers `studies.dailychartbook.com`. Anything committed inside `docs/` is public.

Each exported study gets its own folder inside `docs/`, and `docs/index.html` is the public landing page.

## Recurring Workflow

1. Replace the local workbook inputs:
   - `backtest-data.xlsx`
   - `backtest-results.xlsx`
2. Edit `study-metadata.json`.
3. Rebuild dashboard data:

```bash
python3 scripts/build_dashboard_data.py
```

4. Export the static study:

```bash
python3 scripts/export_study.py
```

5. Commit and publish:

```bash
git add -A
git commit -m "Add new backtest study"
git push origin main
```

## Local Preview

Serve the project locally with any available port:

```bash
python3 -m http.server 8765
```

or:

```bash
python3 -m http.server 8766
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

If you used a different port, replace `8765` in the URL with that port.
