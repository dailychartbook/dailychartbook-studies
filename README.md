# Backtest Visualizer

Static dashboard generator for Daily Chartbook backtest studies.

The project uses two local Excel workbooks as inputs:

- `backtest-data.xlsx`
- `backtest-results.xlsx`

These raw Excel files are intentionally local and ignored by Git. Do not commit them to the public repo.

Public study metadata is controlled by `study-metadata.json`:

- `title`: public dashboard and landing-page title
- `description`: short landing-page/card description
- `slug`: exported study folder name inside `docs/`

If a metadata field is blank or missing, the scripts fall back to workbook-generated values.

## Public Output

Public/shareable output lives in `docs/`.

GitHub Pages publishes the `docs/` folder, and that folder powers `studies.dailychartbook.com`. Anything committed inside `docs/` is public.

Each exported study gets its own folder inside `docs/`, and `docs/index.html` is the public landing page.

## Workflow

After replacing either workbook, regenerate the dashboard data:

```bash
python3 scripts/build_dashboard_data.py
```

Export a shareable static study bundle:

```bash
python3 scripts/export_study.py
```

This writes a self-contained study folder under `docs/`, updates `docs/index.html` as the public landing page, and writes `docs/CNAME` for `studies.dailychartbook.com`.

The recurring workflow is:

1. Replace `backtest-data.xlsx` and `backtest-results.xlsx`.
2. Edit `study-metadata.json`.
3. Run `python3 scripts/build_dashboard_data.py`.
4. Run `python3 scripts/export_study.py`.
5. Commit and push the updated files.

## Local Preview

Serve the project locally:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/index.html`.
