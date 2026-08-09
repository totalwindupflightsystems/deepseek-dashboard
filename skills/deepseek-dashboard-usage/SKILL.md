---
name: deepseek-dashboard-usage
description: "How to use and verify the DeepSeek Usage Dashboard (client-side analytics for DeepSeek API usage ZIP exports) — entry points, real-use flows, verified behavior, and known gaps."
version: 1.0.0
---

# DeepSeek Usage Dashboard — Usage Skill

What this project is, how to drive it for real, and what's known broken.
Written from a real-use dogfood run (2026-08-09) — see
`docs/dogfood/2026-08-09-integration.md` for evidence and
`docs/dogfood/diagnostics.md` for the diagnostic trail.

## What It Is

A **zero-backend static web app**: drag a DeepSeek Platform usage ZIP export
(`amount-YYYY-M.csv` / `cost-YYYY-M.csv`) into the page → KPIs, 6 charts,
anomaly detection, rate-limit gauges, pricing calculator, exports. Everything
runs in the browser; only 3 pinned CDN libraries are fetched. Deployed on
GitHub Pages from `main`.

## Entry Points

| Entry | How |
|---|---|
| Local | `python3 -m http.server 8099` → open `http://127.0.0.1:8099/` (or open index.html directly) |
| Live demo | https://totalwindupflightsystems.github.io/deepseek-dashboard/ — ⚠️ currently stale (missing fixes, see Gaps) |
| Tests | `npm test` (vitest, 65 tests / 7 files, ~1 s) |
| Validate | `npx html-validate index.html` · `npm audit` (0 vulns) · `gitreins guard` |
| Board | `.coding-hermes/board/tasks.jsonl` (JSONL authority; board.db is a cache) |

## Real-Use Flow (the happy path, verified)

1. Open the page → "Create a Workspace" → name it → Create.
2. **Drag** the ZIP onto the drop zone, or **click** the drop zone to pick
   files (multiple ZIPs supported — one per month works great).
3. KPI cards render in ~200 ms; six charts follow. Upload again → overlapping
   date ranges are diff-replaced ("Updated N rows" toast).

## Verified Behaviors (don't re-test these)

- KPIs match the sample export exactly: $380.08 total · 16.2B input tokens ·
  92.5M output · 174,766 requests · 9 keys · 2 models · 22 days (June 2026).
- Privacy: opening + uploading produces exactly 7 network requests (page,
  3 CDN libs + wasm, local css/js). Zero console errors/warnings.
- Workspaces isolate data; switching is instant; data persists across reloads
  (IndexedDB — despite README claiming it evaporates).
- Granularity daily/weekly/monthly, model filter, per-month periods, anomaly
  threshold (1σ → 20 alerts, 4σ → 0), rate-limit tiers (free 55.2% → paid
  1.1% → enterprise 0.1%), pricing calculator, PNG chart export, theme toggle
  — all work. Mobile (≤768 px): filters move to a bottom sheet, panels
  collapse.

## Known Gaps (open board tasks — don't report as new findings)

| ID | Gap | Workaround for now |
|---|---|---|
| DSD-GAP-013 | **Key filter does nothing** (refreshAll never reads #keySelect) | Use the model filter + raw table's per-key rows |
| DSD-GAP-014 | **Export All Raw swaps amount/price columns** | Re-derive: exported "amount" is price, "price" is amount; cost column is correct |
| DSD-GAP-015 | **Live demo is stale** (pre-GAP-001 build: wrong JSON drop-help, no SRI) | Test against a local serve of main, not the live link |
| DSD-GAP-016 | "Last 7/30 Days" are wall-clock windows → misleading empty state on old data | Use "All Time" or the per-month options |
| DSD-GAP-017 | README says data evaporates; it persists in IndexedDB | Use Clear button to wipe |
| DSD-GAP-018 | CSV-less ZIP fails with "0 succeeded, 1 failed" (no reason) | Check the ZIP contains amount-*/cost-* CSVs yourself |

## Automation Pitfalls (for agents driving the UI)

- The drop zone has **no** `<input type=file>` in the DOM — clicking it creates
  one dynamically. Use Playwright's `filechooser` event for click-upload, or
  dispatch a real `DataTransfer` `drop` event on `#dropZone` for drag-upload.
- Anomaly/rate panels start **expanded** on desktop, **collapsed** ≤768 px —
  check the `collapsed` class before clicking a toggle or you'll close them.
- Read chart state via `window.Chart.getChart('cTokens')` (datasets/labels) —
  the Chart.js instance is on the page.
- Fixtures: `sample-data.zip` (612 rows: 568 amount + 44 cost, June 2026) is
  gitignored but present locally; tests reference it with `runIf` guards.
- NEVER push: the project has a NO-PUSH policy (board/audit commits stay
  local). Commit locally, leave pushing to an authorized human.
