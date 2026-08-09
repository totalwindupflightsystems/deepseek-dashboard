# Dogfood Integration Report — 2026-08-09

**Project:** DeepSeek Usage Dashboard · **Verdict:** 🟡 PROMISING-BUT-ROUGH
**Run:** real-use browser session (Playwright + Chrome) against a local serve of
`main`, plus probes of the live GitHub Pages demo.
**Evidence:** `/tmp/dogfood-dsd/evidence.jsonl`, `evidence-b.jsonl`, `shots/`.

## The Promise vs Reality

**Promise (README):** drag a DeepSeek Platform usage ZIP export into the page →
charts, KPIs, trends, breakdowns; everything client-side; nothing leaves the
browser; live demo at totalwindupflightsystems.github.io/deepseek-dashboard.

**Reality:** ✅ The core workflow works and is fast — 201 ms from drop to KPI
cards, zero console errors across two full sessions, all six charts render with
real data, KPI numbers match the README's sample figures exactly
($380.08 total, 16.2B input / 92.5M output tokens, 174,766 requests, 9 keys,
2 models, 22 days). The privacy claim is verifiably true: the Network panel
shows exactly 7 requests — the page, 3 pinned CDN libraries (JSZip, Chart.js,
sql.js + its wasm), and the local css/js. No telemetry, no analytics.

⚠️ But three README-level promises fall apart in real use:
1. **"Drill down by API key" — the key filter does nothing.**
2. **"Export cleaned, aggregated data (aggregated + raw)" — the raw export
   mislabels amount/price.**
3. **"Just open the link" — the live link serves a build missing the board's
   own completed fixes (still shows the wrong JSON drop-help, no SRI hashes).**

## How to Use It (verified end-to-end)

1. Open `index.html` (or serve: `python3 -m http.server 8099`). No install, no
   build. The first screen is "Create a Workspace" → name it → Create.
2. Upload: **drag** the ZIP anywhere onto the drop zone, or **click** the drop
   zone to open a file picker (accepts multiple ZIPs — a real user can drop
   several months at once).
3. That's it. KPI cards appear in ~200 ms; six charts render below.

### Verified working paths (with numbers)

| Path | Result |
|---|---|
| Create workspace → upload sample-data.zip | $380.08 total · 16.2B input · 92.5M output · 174,766 req · 22 days |
| Drag-drop upload | TTFS 201 ms |
| Granularity Daily → Weekly → Monthly | chart regroups (22 days → 4 weeks) |
| Period: All Time / month options ("June 2026") | works; "Last 7 Days" is wall-clock (see pitfalls) |
| Model filter (deepseek-v4-flash) | $23.21 · 43,199 req ✓ |
| Key filter | ❌ NOTHING changes (bug, DSD-GAP-013) |
| Anomaly panel, threshold 1σ → 4σ | 20 alerts → 0 alerts, z-scores shown |
| Rate Limit Monitor, tiers free/paid/enterprise | gauge 55.2% → 1.1% → 0.1%, peak day Jun 21 (20,336 req) |
| Pricing Calculator | recalc + breakdown per model works (input price applies to cache-miss tokens only) |
| Export CSV (aggregated) | `deepseek-export.csv`, 44 data rows, columns date,model,cache_hit,cache_miss,output,requests ✓ |
| Export All Raw | ❌ amount/price transposed vs source CSVs (bug, DSD-GAP-014) |
| Chart PNG export | 66 KB PNG, `token-usage_weekly_Jun 1-7_Jun 22-28.png` ✓ |
| Theme toggle dark ↔ light | persists across reload (localStorage) |
| Data persistence | survives reload (IndexedDB) — README says it evaporates (DSD-GAP-017) |
| Workspace isolation | Work2 empty, Personal intact ($380.08) ✓ |
| Multi-ZIP upload | sample + July variant → 1,136 rows, per-month options ✓ |
| Re-upload (diff) | "Updated 568 rows · 2026-06-01 → 2026-06-22" ✓ |
| Error paths | .txt → "No .zip files found" ✓; CSV-less ZIP → "Done: 0 succeeded, 1 failed" (no reason, DSD-GAP-018) |
| Mobile 390×844 | filters toggle + bottom sheet open, panels collapsed ✓ |
| Console | 0 errors, 0 warnings in both sessions |

## Errors Hit and Their Fixes (for the next agent)

| Symptom | Cause | Fix |
|---|---|---|
| Key dropdown click → nothing changes | `refreshAll()` (js/dashboard.js:728) reads `periodSelect` + `modelSelect` but never `keySelect`; key filter is wired to refresh but its value is never consumed | DSD-GAP-013 |
| Raw export shows `3.625e-9` under "amount" | `exportAllBtn` maps `SELECT *` indices r[6],r[7] to header amount,price, but schema order is `..., type, price, amount` | DSD-GAP-014 |
| Live demo says "daily JSON files" | fixes for GAP-001..008 are unpushed (NO-PUSH policy); Pages deploys from origin/main | DSD-GAP-015 |
| "Last 7 Days" → "No data yet — drag in a DeepSeek usage ZIP" | `queryPeriod('7d')` uses wall-clock dates, not data-relative; empty-state message misleads when data exists | DSD-GAP-016 |
| README says data evaporates on tab close | sql.js DB is serialized to IndexedDB (`deepseek-dashboard` / store `sqlite-db`); it survives | DSD-GAP-017 |

## Automation Notes (how this run was driven)

- Drive with Playwright (chromium); the drop zone accepts a real
  `DataTransfer` drop — construct a `File` from the ZIP bytes in page context
  and dispatch `dragenter`/`dragover`/`drop` on `#dropZone`. Clicking the drop
  zone opens a dynamically created `<input type=file multiple>` — Playwright's
  `filechooser` event captures it.
- Panel toggles (anomaly/rate) start **expanded** at desktop widths and
  collapsed ≤768 px — check the `collapsed` class before clicking, or you'll
  close what you meant to open.
- All evidence capture: `page.on('request')` to verify the privacy claim,
  `page.on('console')`/`pageerror` for errors, `Chart.getChart(canvasId)` to
  read dataset point counts.
- Sample fixtures: `sample-data.zip` = real June 2026 export, 568 amount +
  44 cost rows (612 total), gitignored.
