# Contributing to DeepSeek Dashboard

Thanks for contributing! This is a zero-build client-side dashboard — no build system, no bundler, no framework, no server. Open `index.html` in a browser and you're done.

## How to Test

1. Open `index.html` directly in a browser (`file://` protocol works, no server needed)
2. Drop a DeepSeek usage **ZIP** export onto the page (the app accepts `.zip` archives only — direct CSV upload is rejected; the archive must contain `amount-YYYY-M.csv` and/or `cost-YYYY-M.csv` files with columns `utc_date/model/type/price/amount`)
3. Exercise the feature you're changing: switch workspaces, toggle charts, change granularity, test rate limit panel, trigger anomaly detection
4. For JS logic tests: `npm test` (Vitest, jsdom — 83 tests across 11 files)

## How the Code is Organized

The app is split across three files (no build step — `index.html` loads them directly):

| File | Role |
|------|------|
| `index.html` (~225 lines) | App shell: CSP, CDN script tags (JSZip 3.10.1, Chart.js 4.5.1, sql.js 1.14.1 — all with SRI `integrity` hashes), drop zone, controls, chart canvases, modal |
| `css/dashboard.css` (~320 lines) | Theming (light/dark via `[data-theme]`), layout, responsive breakpoints |
| `js/dashboard.js` (~2,040 lines) | All application logic: ZIP upload via `handleUpload`/`_processSingleFile` (JSZip.loadAsync → parseCSV routing by `amount-`/`cost-` filename prefix), sql.js persistence, Chart.js rendering, pricing calculator, anomaly detection, workspace management |

Everything is static files by design — it deploys as-is to GitHub Pages with zero build step.

## How to Update CDN Dependencies

Dependencies are loaded from CDN in `<head>` (index.html lines 9-11):

| Library | CDN | Purpose |
|---------|-----|---------|
| Chart.js | jsDelivr | All chart rendering |
| sql.js | jsDelivr | SQL-powered persistence via IndexedDB |
| JSZip | cdnjs | DeepSeek ZIP export extraction |

To update:
1. Find the latest version on [jsDelivr](https://www.jsdelivr.com/) or [cdnjs](https://cdnjs.com/)
2. Update the `<script src="...">` tag in `index.html` — and **recompute the SRI `integrity="sha384-..."` hash** for the new bytes (`openssl dgst -sha384 -binary <file> | openssl base64 -A`), keeping the `crossorigin="anonymous"` attribute
3. Update the `README.md` tech stack table
4. Open `index.html` and verify all features still work (charts render, ZIP uploads, raw-data export)

## How to Add a Chart Type

1. Add the `<canvas>` element in the HTML skeleton section of `index.html`
2. Add a chart card wrapper in the grid layout
3. Write a `render<ChartName>()` function in `js/dashboard.js` following the existing pattern:
   - Create or reuse a Chart.js instance (track in `chartInstances` object)
   - Destroy the previous instance before creating a new one (`chartInstances.xxx?.destroy()`)
   - Add the instance to `allChartInstances` array for global cleanup
   - Register it in the `refreshAll()` function
4. Add the chart name to the PNG export list in the download handler
5. Add the chart card to the KPI card row if it shows aggregate metrics

## Coding Conventions

- **Vanilla JavaScript only** — no frameworks, no TypeScript, no transpilation
- **Split files** — HTML in `index.html`, CSS in `css/dashboard.css`, JS in `js/dashboard.js`; keep each concern in its file
- **'use strict'** at the top of `js/dashboard.js` (line 1)
- **Escape user data** — always pass user-controlled strings through `escapeHtml()` before injecting into innerHTML
- **LocalStorage for preferences only** — theme, granularity, anomaly settings, rate limit tier, custom pricing. Keys use the `ds-dash-` prefix (e.g. `ds-dash-anomaly-prefs`, `ds-dash-granularity`). Uploaded usage data lives in IndexedDB (store `sqlite-db`), not localStorage
- **semantic HTML** — prefer `<button>` over `<div onclick>`, `<label>` for form elements
- **CSS custom properties** for theming — vars in `:root` for light, `[data-theme="dark"]` for dark
- **Mobile-first** — responsive breakpoints at 768px, bottom sheet for filters on small screens
- **Tests for calculations** — CSV parsing, anomaly detection, date grouping, pricing, filters. UI rendering tests are manual (browser-based)

## Git Workflow

- Branch from `main`, submit PRs
- Commits use conventional prefixes: `feat:`, `fix:`, `quality:`, `docs:`, `test:`, `chore:`, `perf:`
- GitHub Pages deploys from the `main` branch — every push to `main` triggers a Pages rebuild, so board/audit commits stay local under this project's NO-PUSH policy. Only real code destined for the live site is pushed

## Project Philosophy

- Zero runtime dependencies beyond CDN (no npm install required to use)
- Works offline after first load (sql.js + IndexedDB persistence)
- No telemetry, no analytics, no server — your usage data stays in your browser
