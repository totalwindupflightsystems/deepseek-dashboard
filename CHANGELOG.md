# Changelog

## 2026-08-19 — August Release Batch

**Security**
- XSS fix: CSV-derived dates in the Rate Limit panel's top-days list are now HTML-escaped — a crafted `utc_date` in an uploaded export can no longer execute script in the page (`c1614cf`).
- All CDN scripts (JSZip, Chart.js, sql.js) now load with SRI `integrity` hashes + `crossorigin` — a compromised CDN can no longer inject code undetected (`91444c9`).

**Features**
- Client-side search over the raw data table — type to filter all loaded rows instantly (`4f42502`).
- Key filter now drives the Total Cost / Avg Daily Cost KPIs: selecting an API key updates the cost cards to that key's computed spend, matching the per-key chart (`1a37657`).

**Performance**
- Upload performance fix: ZIP import wraps inserts in a single SQL transaction and batches IndexedDB persistence, with a visible progress indicator — large exports (6+ months of heavy usage) import in a fraction of the previous time instead of freezing on "Processing..." (`2684996`).

**UX**
- Multi-file drops now report skipped non-ZIP files by name instead of silently discarding them (`c437ec9`).
- Uploads now surface dropped-row counts: rows with invalid `utc_date` values are counted and reported in the result toast (e.g. "4 rows added, 2 dropped (invalid utc_date)") (`6de53dd`).

**Documentation**
- README verify section now enumerates the sql-wasm.wasm fetch alongside the three CDN script loads, re-affirming zero outbound data (`aca3809`).
- Drop-zone help + SUPPORT.md document the real ZIP-of-CSV export format (`amount-YYYY-M.csv` / `cost-YYYY-M.csv`, `utc_date` column) (`91444c9`).
- CONTRIBUTING.md rewritten for the split-file structure and ZIP-only uploads (`3f2b6d1`).
- README local-install path fixed — download the repo, not a single file (`38750f1`).
- Drift-prone test/line counts removed from README (`cfc1a86`).

**Dependencies**
- vitest 2.1.9 → 4.1.10, jsdom 25 → 30 (`da3206b`, `9b6bd00`); MIT license declared (`9b6bd00`).

## 2026-07-19 — Quality & Test Hardening

**Security**
- XSS hardening: added `escapeHtml()` helper, escaped all 29 innerHTML injection sites with user-controlled data. Replaced `innerHTML` with `textContent` for icon toggles.
- Added `'use strict'` directive to the main script block.

**Testing**
- Added Vitest test harness: 55 tests across 5 test files covering CSV parsing (`parseCSV`), anomaly detection (`detectAnomalies`), date grouping (`groupDays`, `getISOWeekStart`), and pricing calculator (`recalcPricing`, `getAvgPriceForModel`).

**Code Quality**
- DRY panel collapse: extracted duplicate toggle logic into shared `setupCollapsiblePanel()` helper, used by both anomaly and rate limit panels.

**Dependencies**
- sql.js: 1.10.3 → 1.14.1
- Chart.js: 4.4.1 → 4.5.1 (switched from cdnjs to jsDelivr)

## 2026-07-18 — Documentation Sweep

**Documentation**
- README feature table updated with all 10+ implemented features (rate limit, anomaly detection, model distribution, pricing calculator, PNG export, virtual scrolling, multi-workspace, granularity, theme toggle, mobile refinements).
- Fixed inaccurate line count claim (~1,100 → ~2,400).
- Fixed Chart.js version claim (4.4.7 → 4.4.1).
- Added sql.js to README tech stack.
- Fixed localStorage claim.
- Removed stale OpenRouter comparison claims (feature was removed in `3959602`).
- Fixed sample-data section referencing non-existent files.

## 2026-07-17 — P1 Features: Rate Limit & Model Distribution

**Rate Limit Monitoring Panel** (`cb63352`)
- Collapsible panel with API tier selector (Free/Paid/Enterprise/Custom).
- Request rate metrics and usage gauges.
- Peak day analysis and top request-volume days list.
- Tier preference persisted in localStorage.

**Model Distribution Over Time** (`b27bbff`)
- Stacked area chart tracking model usage distribution.
- Per-model breakdown with color coding.
- Integrated into PNG export system.

## 2026-07-16 — P1-P3 Feature Wave

**Input vs Output Token Clarity** (`f671695`)
- Combined input tokens on time chart.
- Renamed prompt/completion chart to clarify usage.
- Split KPI cards for input/output tokens.
- Input/output cost split on spend chart.

**Anomaly Detection** (`e6a30d0`)
- Z-score based spike detection on token usage and spend.
- Collapsible panel with threshold slider and metric checkboxes.
- Scatter markers on Token and Spend charts.
- Severity levels (warning, critical).
- Preferences persisted in localStorage.

**Granularity Selector** (`bba5124`)
- Daily/Weekly/Monthly toggle.
- Client-side date grouping via `groupDays()` and `getISOWeekStart()`.
- Anomaly markers gated to daily view only.
- Preference persisted in localStorage.

**Visual Polish** (`7a3d6e1`)
- Rounded bar corners, responsive 8/9px fonts.
- Theme-aware grid and tooltip colors.
- Mobile-only bottom sheet for filters.
- Longer workspace dropdown, drop-zone format help.
- Table scroll indicator.

## 2026-07-15 — P4-P6 Features

**Pricing Calculator** (`cfec1a7`)
- Custom per-model token prices with what-if cost comparison against actual spend.
- Input/output split pricing.
- Currency formatting and total cost projection.

**Dark/Light Theme Toggle** (`85ff11c`)
- System-preference detection on first load.
- Manual toggle with localStorage persistence.
- CSS custom properties for all themed elements.

**Mobile Refinements** (`9036365`)
- Swipe-to-dismiss toast notifications.
- Bottom sheet for filter controls on small screens.
- Responsive breakpoints at 768px.

## 2026-07-14 — Core Features

**PNG Export** (`4ebf58d`)
- Download button on each Chart.js chart card.
- `toBase64Image()` with chart type + date range in filename.

**Virtual Scrolling** (`12dd2f8`)
- Row-pooling approach for raw data table.
- Handles 100K+ rows without DOM overload.

**Multi-File Upload** (`35edc1d`)
- Multiple DeepSeek export ZIPs per workspace.
- Diff-based re-upload: replaces matching date ranges instead of full reset.

**OpenRouter Comparison** (`a2c5e71`)
- Fetch OpenRouter Analytics API data.
- Overlay dashed usage curves on Token and Spend charts.
- Comparison KPI card.

## 2026-07-13 — Initial Release

**DeepSeek Usage Dashboard** (`6af7d30`)
- Single-file HTML dashboard with Chart.js + JSZip.
- DeepSeek CSV export parsing and visualization.
- sql.js persistence via IndexedDB for offline-capable data storage.
- Multi-workspace support (create, rename, delete, switch).
- KPI cards (total tokens, total spend, requests, models).
- Six chart panels: token usage over time, spend over time, model distribution, request volume, prompt vs completion, hourly heatmap.
- CSV export (aggregated + raw).
- Upload history log.
- Clear button per workspace.
- GitHub Pages deployment from `docs` branch.
