---
name: deepseek-dashboard-usage
description: "How to use and verify the DeepSeek Usage Dashboard (client-side analytics for DeepSeek API usage ZIP exports) — entry points, real-use flows, verified behavior, and known gaps."
version: 1.1.0
---

# DeepSeek Usage Dashboard — Usage Skill

What this project is, how to drive it for real, and what's known broken.
Written from real-use dogfood runs: 2026-08-09 (run 1) and 2026-08-18 (run 2).
Evidence: `docs/dogfood/2026-08-09-integration.md`,
`docs/dogfood/2026-08-18-integration.md`; diagnostic trail:
`docs/dogfood/diagnostics.md`.

## What It Is

A **zero-backend static web app**: drag a DeepSeek Platform usage ZIP export
(`amount-YYYY-M.csv` / `cost-YYYY-M.csv`) into the page → KPIs, 6 charts,
anomaly detection, rate-limit gauges, pricing calculator, exports. Everything
runs in the browser; only 3 pinned CDN libraries (with SRI hashes) are
fetched. Deployed on GitHub Pages from `main`.

## Entry Points

| Entry | How |
|---|---|
| Local | `python3 -m http.server 8099` → open `http://127.0.0.1:8099/` (or open index.html directly) |
| Live demo | https://totalwindupflightsystems.github.io/deepseek-dashboard/ — **in sync with main as of 2026-08-18** (verify by MD5, don't assume stale) |
| Tests | `npm test` (vitest, 90 tests / 11 files, ~1.6 s) |
| Validate | `npx html-validate index.html` · `npm audit` (0 vulns) · `gitreins guard` |
| Board | `.coding-hermes/board/tasks.jsonl` (JSONL authority; board.db is a cache; tasks.md is archived as tasks.md.bak) |

## Real-Use Flow (the happy path, verified)

1. Open the page → "Create a Workspace" → name it → Create.
2. **Drag** the ZIP onto the drop zone, or **click** it to pick files
   (multiple ZIPs supported — upload several months at once).
3. KPI cards render in ~230 ms; six charts follow. Re-upload → overlapping
   date ranges are diff-replaced ("Updated 568 rows" toast; history marks
   "(updated)").

## Verified Behaviors (don't re-test these)

- KPIs match the sample export exactly: $380.08 total · 16.2B input · 92.5M
  output · 174,766 requests · 9 keys · 2 models · 22 days (June 2026).
- Privacy: opening + uploading produces exactly 7 network requests (page,
  3 CDN libs + wasm, local css/js). Zero console errors/warnings on happy
  paths.
- **Key filter works** (since GAP-013): tokens/requests/charts/per-key chart
  filter; ⚠️ TOTAL COST / AVG DAILY COST KPIs stay frozen (GAP-032, open).
- "Last 7/30 Days" are **data-anchored** (GAP-016 fixed): June data in August
  shows the last 7 days OF THE DATA.
- Raw export columns are correct (GAP-014 fixed): header
  `utc_date,model,api_key_name,type,amount,price,cost`.
- Error toasts carry reasons (GAP-018/029 fixed): CSV-less ZIP → "No
  amount-*/cost-* CSV found in archive"; mixed drop → "Skipped 1 non-ZIP
  file: stray.csv"; corrupt ZIP → jszip's error text.
- XSS hardened (GAP-030): malicious `utc_date` rows are dropped at parse and
  escaped at render — verified with a crafted probe ZIP.
- Workspaces isolate data; switching is instant; data persists across reloads
  (IndexedDB DB `deepseek-dashboard`); Clear/Delete are guarded by
  `window.confirm`.
- Granularity daily (22 pts)/weekly (4)/monthly (1), model filter ($23.21
  flash), per-month periods, anomaly threshold (1σ → alerts, 4σ → fewer),
  rate-limit tiers (free 13.6% → paid 0.3% → enterprise 0.0% on sample),
  pricing calculator, PNG chart export, theme toggle — all work. Mobile
  (≤768 px): filters move to a bottom sheet, panels collapse.
- Virtual scrolling verified with a synthetic 6-month export (14,240 rows:
  27 DOM rows, tbody 398,720 px) — but upload took ~31 s (GAP-034, open).

## Known Gaps (open board tasks — don't report as new findings)

| ID | Gap | Workaround for now |
|---|---|---|
| DSD-GAP-032 | **Key filter freezes cost KPIs** (TOTAL COST stays $380.08 while tokens/requests filter) | Cross-check the per-key chart (cKey) for key-attributed spend |
| DSD-GAP-033 | README:42 claims table is "Searchable" — **no search UI exists** | Use period/model/key selects; the table is filterable only |
| DSD-GAP-034 | Upload time super-linear: 14,240 rows → ~31 s, no progress UI | Upload one month at a time |
| DSD-GAP-035 | Malformed-date rows silently dropped (defense-in-depth) | Check the toast row count vs the ZIP's CSV row counts |

## Automation Pitfalls (for agents driving the UI)

- The drop zone has **no** `<input type=file>` in the DOM — clicking it creates
  one dynamically. Use Playwright's `filechooser` event for click-upload, or
  dispatch a real `DataTransfer` `drop` event on `#dropZone` for drag-upload.
- **`window.confirm` dialogs:** Clear and Delete buttons only act when the
  confirm is accepted. Playwright auto-dismisses dialogs — register
  `page.on('dialog', d => d.accept())` or these buttons will look broken.
- KPI cards are built dynamically (no stable IDs) — wait for upload via
  `waitForFunction(() => kpiGrid.innerText.includes('TOTAL COST'))`.
- Read chart state via `window.Chart.getChart('cTokens')` (datasets/labels).
- Anomaly/rate panels start **expanded** on desktop, **collapsed** ≤768 px.
- Fixtures: `sample-data.zip` (612 rows: 568 amount + 44 cost, June 2026) is
  gitignored but present locally. Synthetic fixtures (xss/corrupt/july-variant/
  big-6mo zips, real export schema) are built by
  `/tmp/dogfood-dsd/run2/prep.js` — amount CSV columns:
  `user_id,utc_date,model,api_key_name,api_key,type,price,amount`; cost CSV:
  `user_id,utc_date,model,wallet_type,cost,currency`.
- NEVER push: NO-PUSH policy (board/audit/dogfood commits stay local; only
  real code destined for the live site is pushed).
