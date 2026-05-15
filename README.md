# Backtest Visualizer

Static dashboard for the two workbook inputs in this folder:

- `backtest-data.xlsx`
- `backtest-results.xlsx`

These raw Excel workbooks stay local and are intentionally ignored by Git. The shareable/public output is generated into `docs/`.

Regenerate the dashboard data after replacing either workbook:

```bash
/Users/pav/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_dashboard_data.py
```

Export a shareable static study bundle:

```bash
/Users/pav/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/export_study.py
```

This writes a self-contained study folder under `docs/`, updates `docs/index.html` as the public landing page, and writes `docs/CNAME` for `studies.dailychartbook.com`.

For GitHub Pages, set the repo Pages source to the `docs/` folder on your publishing branch. The recurring workflow is just:

1. Replace `backtest-data.xlsx` and `backtest-results.xlsx`.
2. Run `scripts/export_study.py`.
3. Commit and push the updated `docs/` folder.

Serve locally:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/index.html`.
