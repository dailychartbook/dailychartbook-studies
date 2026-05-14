# Backtest Visualizer

Static dashboard for the two workbook inputs in this folder:

- `backtest-data.xlsx`
- `backtest-results.xlsx`

Regenerate the dashboard data after replacing either workbook:

```bash
/Users/pav/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_dashboard_data.py
```

Export a shareable static study bundle:

```bash
/Users/pav/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/export_study.py
```

This writes a self-contained study folder under `dist/` and updates `dist/index.html` as a landing page. Upload `dist/` to a static host such as Netlify, Vercel, Cloudflare Pages, GitHub Pages, or S3.

Serve locally:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/index.html`.
