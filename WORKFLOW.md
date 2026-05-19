# Operator Workflow

This file documents the internal workflow for generating, archiving, rebuilding, and publishing Daily Chartbook study dashboards.

## Private Inputs

The raw Excel workbooks are local/private inputs and are intentionally ignored by Git:

- `backtest-data.xlsx`
- `backtest-results.xlsx`

Local archived inputs live under `Archives/`, which is also ignored by Git. Do not commit raw workbook inputs or archived inputs to the public repository.

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

## A. Publishing One New Study

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

5. Preview locally.
6. Commit and publish:

```bash
git add -A
git commit -m "Add new backtest study"
git push origin main
```

## B. Archiving The Current Study

After confirming the study is correct, run:

```bash
python3 scripts/archive_inputs.py
```

This saves the Excel inputs and metadata locally under:

```text
Archives/<study-slug>/
  backtest-data.xlsx
  backtest-results.xlsx
  study-metadata.json
```

`Archives/` is local/private and ignored by Git.

## C. Rebuilding All Published Studies

Use this after a dashboard design/code change when you want every archived study to be regenerated with the latest `app.js`, `styles.css`, `index.html`, and export logic.

```bash
python3 scripts/rebuild_all_studies.py
```

The rebuild script clears old study folders from `docs/`, regenerates studies from `Archives/`, rebuilds `docs/index.html`, and preserves `docs/CNAME` as `studies.dailychartbook.com`.

After rebuilding, preview `docs/`, then commit and publish:

```bash
git add -A
git commit -m "Rebuild backtest studies"
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
http://127.0.0.1:8765/docs/index.html
```

If you used a different port, replace `8765` in the URL with that port.
