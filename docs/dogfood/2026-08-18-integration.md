# Dogfood Integration Report — 2026-08-18 (Run 2)

**Project:** DeepSeek Usage Dashboard · **Verdict:** ✅ SHIPPABLE
**Run:** real-use browser sessions (Playwright + Chrome, 4 sessions) against a
local serve of `main` (http://127.0.0.1:8099) **and** the live GitHub Pages
demo.
**Evidence:** `/tmp/dogfood-dsd/run2/s{1,1b,1c,1d,2,2b,3}-evidence.jsonl`,
screenshots in `/tmp/dogfood-dsd/run2/shots/`.
**Previous run:** 2026-08-09 → 🟡 PROMISING-BUT-ROUGH (6 findings, all now closed).

## Promise vs Reality

**Promise (README):** "Drag in your DeepSeek usage ZIP. Get charts, trends, and
breakdowns. All processing happens in your browser — the data never touches any
server." Live demo at totalwindupflightsystems.github.io/deepseek-dashboard.

**Reality:** ✅ The promise holds — verified end-to-end on the **deployed live
site**, not just locally. This run was primarily a regression re-check of the
2026-08-09 findings plus new probes. **All six 2026-08-09 findings are fixed
and verified in real use** (details below). The remaining gaps are one P2 UI
inconsistency (cost KPIs frozen under the key filter) and three P2/P3
docs/perf/integrity nits — none of which break the core workflow.

## Time-to-First-Success & Friction

| Metric | Value |
|---|---|
| TTFS (fresh profile → workspace → drag ZIP → KPI cards) | **228 ms** (was 201 ms in run 1) |
| Upload toast | "Added 568 rows · 2026-06-01 → 2026-06-22" |
| KPI accuracy | $380.08 · 16.2B in · 92.5M out · 174,766 req · 22 days — matches README exactly |
| Console errors | 0 across all sessions (only the 2 *intentional* error-path toasts logged) |
| Friction count | 4 (see findings) |

## Regression Re-Checks (2026-08-09 findings — ALL FIXED)

| Old finding | Re-check evidence |
|---|---|
| DSD-GAP-013 key filter dead | Selecting `Chimera-CI` now filters: input 16.2B→4.4M, requests 174,766→3,270, per-key chart shows 1 bar. **BUT cost KPIs stay frozen — see Finding 1.** |
| DSD-GAP-014 raw export transposed | Raw export header now `utc_date,model,api_key_name,type,amount,price,cost`; sample row `input_cache_hit_tokens,397074944,3.625e-9,1.439396672` — amount>1 and price<1 for 40/40 checked token rows ✓ |
| DSD-GAP-015 live demo stale | Live index.html MD5 **identical** to local HEAD (871b164e); drop-help on live describes `amount-YYYY-M.csv`/`cost-YYYY-M.csv`; SRI `integrity` on all 3 CDN tags; full upload worked on live (943 ms) ✓ |
| DSD-GAP-016 wall-clock periods | "Last 7 Days" on June data → `2026-06-16 → 2026-06-22 · 7 days of data · $5.49` (data-anchored) ✓; "Last 30 Days" → all 22 days ✓ |
| DSD-GAP-017/019 README/SECURITY persistence claims | README + SECURITY + SUPPORT all describe IndexedDB persistence ✓ |
| DSD-GAP-018 vague failure toast | CSV-less ZIP → "Done: 0 succeeded, 1 failed — no-csv.zip: **No amount-*/cost-* CSV found in archive**" ✓ |
| DSD-GAP-029 silent non-ZIP skip | Mixed drop [sample-data.zip + stray.csv] → "**Skipped 1 non-ZIP file: stray.csv**" + ZIP processed (612 rows) ✓ |
| DSD-GAP-030 XSS | Crafted ZIP with `utc_date=<img src=x onerror=window.__xss=1>`: `window.__xss` never set, no `<img>` in rate-panel DOM — defense-in-depth (parse-time drop, dashboard.js:432-441) + render-time `escapeHtml` both verified ✓ |

## New Verified Behavior (run 2)

- **Diff re-upload:** same ZIP twice → "Updated 568 rows · 2026-06-01 →
  2026-06-22", history marks "(updated)", no duplicate rows.
- **Multi-month:** June + July ZIPs → All Time $760.17 / 44 days / 349,532 req;
  per-month period options appear; July-only filter correct.
- **Corrupt ZIP:** clear error "Can't find end of central directory : is this a
  zip file?" (raw but honest).
- **Workspaces:** create/rename work; data isolated (Work2 empty vs Personal
  intact); **Clear** and **Delete** both guarded by `confirm()` dialogs and
  work when confirmed.
- **Large export (synthetic 6-month, 14,240 rows):** virtual scrolling active
  (tbody height 398,720 px but only 27 DOM rows), all 6 months filterable,
  0 console errors. **But 31 s upload — see Finding 3.**
- **Privacy:** exactly 7 requests (page, 3 CDN libs + wasm, local css/js);
  IndexedDB DB `deepseek-dashboard` confirmed.
- **Mobile 390×844:** filter bottom sheet opens, panels collapse.
- **Per-key chart truth:** cKey sums to exactly $380.08 unfiltered
  (price×amount per key: hermes-kara-acemagic-mde $246.04, hermes4friends
  $123.38, ...) — matches the billed TOTAL COST KPI.

## Findings (→ board tasks DSD-GAP-032..035)

1. **DSD-GAP-032 (P2) — Key filter freezes cost KPIs.** TOTAL COST stays
   $380.08 and AVG DAILY COST $17.28 under any key filter while every token/
   request KPI and chart filters correctly. Root cause: cost KPI reads
   `cost_daily` (per-model billed cost — DeepSeek's cost export has no key
   column) while the rest reads `token_usage`. The cKey chart computes
   key-attributed spend and sums to the same $380.08, so the KPI contradicts
   the chart one card away. Fix: derive cost KPI from price×amount when a key
   filter is active (or annotate "billed cost — not split by key").
2. **DSD-GAP-033 (P2) — README claims the raw table is "Searchable"; there is
   no search UI** (0 hits for "search" in index.html + js/dashboard.js).
   Filterable (period/model/key) — yes. Searchable — no.
3. **DSD-GAP-034 (P3) — Upload time scales super-linearly:** 612 rows → 228 ms;
   14,240 rows → 31,013 ms (23× data, ~136× time), drop zone stuck on
   "Processing..." with no progress UI.
4. **DSD-GAP-035 (P3) — Malformed-date rows silently dropped:** XSS-probe ZIP
   (6 rows, 2 with malicious dates) imported as "4 rows" with no warning.
   Defense-in-depth works, but a real user with a date-format quirk loses rows
   invisibly. Fix: report dropped-row counts in the toast/history.

## How to Use It (verified end-to-end)

1. Serve: `python3 -m http.server 8099` (or just open the live link — it is in
   sync with main as of 2026-08-18).
2. Create a workspace → drag/click the ZIP onto the drop zone.
3. Done — KPIs in ~230 ms, 6 charts below.
4. Pro tips: upload several months at once; re-upload replaces overlapping
   ranges; use Clear (confirm dialog) to wipe a workspace.

## Automation Notes (how this run was driven)

- Click-upload: `page.waitForEvent('filechooser')` + `page.click('#dropZone')`
  + `chooser.setFiles(...)` (the input is created dynamically).
- Drag-drop: construct a `DataTransfer` with real `File`s in page context and
  dispatch `dragenter/dragover/drop` on `#dropZone`.
- **Confirm dialogs:** Clear/Delete use `window.confirm` — Playwright
  auto-dismisses dialogs, which makes those buttons look broken. Register a
  `page.on('dialog')` handler that accepts before testing them.
- Wait for upload completion via
  `waitForFunction(() => kpiGrid.innerText.includes('TOTAL COST'))` — KPI cards
  are built dynamically and have no stable IDs.
- Read chart state via `window.Chart.getChart('cTokens')`.
- Fixtures built by `/tmp/dogfood-dsd/run2/prep.js`: `xss.zip`, `corrupt.zip`,
  `stray.csv`, `july-variant.zip`, `big-6mo.zip` (real export schema:
  amount = `user_id,utc_date,model,api_key_name,api_key,type,price,amount`;
  cost = `user_id,utc_date,model,wallet_type,cost,currency`).
