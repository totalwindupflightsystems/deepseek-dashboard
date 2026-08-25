# AGENTS.md — DeepSeek Usage Dashboard

## Purpose

Client-side analytics dashboard for DeepSeek API usage. Users drag a DeepSeek
Platform usage ZIP export into the page and everything runs in the browser —
Chart.js, JSZip, sql.js — with zero server and zero telemetry. Deployed on
GitHub Pages from `main` (`totalwindupflightsystems.github.io/deepseek-dashboard`).

## Commands

| Task | Command |
|------|---------|
| Run tests | `npm test` (vitest run — 60+ unit tests, jsdom) |
| Dependency audit | `npm audit` (must stay 0 vulnerabilities) |
| Validate HTML | `npx html-validate index.html` |
| GitReins guard (secrets/lint/tests) | `gitreins guard` |
| Hilo graph stats | `hilo graph stats` |

## Architecture

- `index.html` — app shell: CSP, CDN script tags (JSZip 3.10.1, Chart.js 4.5.1,
  sql.js 1.14.2, all with SRI `integrity` hashes), drop zone, controls, chart canvases.
- `js/dashboard.js` (~1,960 lines) — all application logic: ZIP upload via
  `handleUpload`/`_processSingleFile` (JSZip.loadAsync → parseCSV routing by
  `amount-`/`cost-` filename prefix), sql.js persistence, Chart.js rendering,
  pricing calculator, anomaly detection, workspace management.
- `css/dashboard.css` — theming (light/dark via `[data-theme]`).
- `tests/` — vitest unit tests (jsdom). `tests/setup.js` loads `js/dashboard.js`
  into a JSDOM window and exposes helper functions (parseCSV, detectAnomalies,
  groupDays, pricing helpers) as test globals.
- Data model: sql.js in-memory SQLite (`token_usage`, `cost_daily`, `uploads`,
  `workspaces`) backed by IndexedDB persistence.

## Conventions & pitfalls

- **Date formats:** DeepSeek CSV `utc_date` may be `YYYYMMDD` or `YYYY-MM-DD` —
  normalize to `YYYY-MM-DD` on parse (`_processSingleFile` in js/dashboard.js).
- **CSP:** requires `'unsafe-eval'` for sql.js WebAssembly instantiation; never
  remove it or the dashboard shows "Failed to initialize".
- **Drop-help text:** documents the real ZIP-of-CSV format
  (`amount-YYYY-M.csv` / `cost-YYYY-M.csv`, columns
  `utc_date/model/type/price/amount`) — keep it in sync with `_processSingleFile`.
- **ZIP fixtures:** `sample-data.zip` / `usage_data.zip` are gitignored personal
  exports (`*.zip` in .gitignore). Tests reference them with `it.runIf(existsSync)`
  guards — never commit them.
- **NO-PUSH policy:** board/audit commits stay local; only real code destined
  for the live site is pushed (Pages deploys from `main`).
