---
name: deepseek-dashboard-usage
description: "How to use and verify the DeepSeek Usage Dashboard (client-side analytics for DeepSeek API usage ZIP exports) — entry points, real-use flows, verified behavior, and known gaps."
version: 1.2.0
---

# DeepSeek Usage Dashboard — Usage Skill

What this project is, how to drive it for real, and what's known broken.
Written from real-use dogfood runs: 2026-08-09 (run 1), 2026-08-18 (run 2),
2026-09-01, 2026-09-07 (run 3 morning + evening — claims below last
verified 2026-09-07 evening, HEAD `0e79c4c`). Evidence:
`docs/dogfood/2026-08-09-integration.md`, `docs/dogfood/2026-08-18-integration.md`,
`docs/dogfood/2026-09-07-integration.md`; diagnostic trail:
`docs/dogfood/diagnostics.md`.

## What It Is

A **zero-backend static web app**: drag a DeepSeek Platform usage ZIP export
(`amount-YYYY-M.csv` / `cost-YYYY-M.csv`) into the page → KPIs, 6 charts,
anomaly detection, rate-limit gauges, pricing calculator, PNG/CSV exports.
Everything runs in the browser; only 3 pinned CDN libraries (with SRI hashes,
dual-host fallback) are fetched. Deployed on GitHub Pages from `main`.

## Entry Points

| Entry | How |
|---|---|
| Local | `python3 -m http.server 8099` → open `http://127.0.0.1:8099/` — **any port works**; `file://…/index.html` also works (verified, 0 console errors) |
| Live demo | https://totalwindupflightsystems.github.io/deepseek-dashboard/ — byte-identical to main as of 2026-09-07 (verify by size/hash, don't assume stale) |
| Tests | `npm test` (vitest, **332 tests / 22 files**, ~6 s) |
| Validate | `npx html-validate index.html` · `npm audit` (0 vulns) · `gitreins guard` |
| Board | `.coding-hermes/board/tasks.jsonl` (JSONL authority; tasks.md is the human mirror) |
| Programmatic | `window.handleMultipleUpload(FileList)`, `window.handleUpload(File)`, `parseCSV`, `detectAnomalies`, `groupDays` — stable, test-driven via `tests/setup.js`; see GAP-060 (still undocumented in README) |

## Real-Use Flow (the happy path, verified)

1. Open the page → "Create a Workspace" → name it → Create.
2. **Drag** the ZIP onto the drop zone, or **click** it to pick files
   (multiple ZIPs supported — upload several months at once).
3. KPI cards render in ~5 s headless / ~230 ms headed; six charts follow.
   Re-upload → overlapping date ranges are diff-replaced (toast reports
   added-vs-updated accounting).

## Verified Behaviors (don't re-test these)

- KPIs match the sample export exactly: $380.08 total · 16.2B input · 92.5M
  output · 174,766 requests · 22 days (June 2026).
- Privacy: external requests go only to `cdn.jsdelivr.net` +
  `cdnjs.cloudflare.com` (pinned libs + wasm). Zero outbound data.
- **Raw-table search works** (GAP-033 fixed): substring, case-insensitive
  across date/model/api-key/type; label shows "(283 of 568 rows)" style
  filtered counts; no-match renders a clean "No data" state.
  ⚠️ searches only the fetched 50,000-row window — GAP-059.
- **Cost KPI freeze fixed** (GAP-032 complete): key filter now threads into
  cost KPIs; per-key chart (cKey) remains the key-attribution view.
- "Last 7/30 Days" are **data-anchored** (GAP-016): June data in August
  shows the last 7 days OF THE DATA.
- Raw export columns correct (GAP-014); error toasts carry reasons
  (GAP-018/029); XSS hardened (GAP-030).
- **PNG chart export** (run 3): every chart's ⬇ button produces a real PNG
  (magic-byte verified), filename `<type>_<granularity>_<start>_<end>.png`.
- **Pricing calculator** (run 3): auto-computes original cost on open
  (sample: $1726.34); recalc with edited prices updates New/Diff + per-model
  breakdown consistently (2× output price → +$421.18 / +24.4%, correct
  model attribution).
- **Rate-limit tiers** (run 3): Free/Paid/Enterprise/Custom; gauge = avg
  req/day ÷ tier daily cap (Free 14,400 → 55.2%, Paid 720,000 → 1.1% on
  sample); Custom reveals RPM/day inputs. Panel starts collapsed ≤768 px.
- **Anomaly detection** (run 3): 4 alerts @ 2.0σ default on sample; slider
  re-runs detection live (1.0σ → 20 items).
- Granularity daily/weekly/monthly, model filter ($91.55 v4-pro on sample),
  auto-populated per-month periods, CSV aggregate export — all work.
- **Theme toggle persists across reload** (localStorage).
- **Offline CDN failure** (run 3, GAP-055 fix verified): both CDNs blocked →
  visible "Failed to initialize — Libraries failed to load: JSZip (tried
  cdnjs…, jsdelivr…)" banner naming the library and both hosts. Not a blank.
- **Mobile 375 px** (run 3): no horizontal overflow, filters become a "☰
  Filters" bottom sheet, panels collapse, KPI grid fits viewport.
- Workspaces isolate data; persistence via IndexedDB; Clear/Delete are
  `window.confirm`-guarded.
- Hostile ZIP handling (run 3): garbage date row + wrong-column CSV +
  non-CSV member → "Added 2 rows … (1 dropped — invalid utc_date)", no
  breakage, accounting correct.

## Known Gaps (open board tasks — don't report as new findings)

| ID | Gap | Workaround for now |
|---|---|---|
| DSD-GAP-059 | Table search silently caps at the 50k-row fetch window ("(0 of 97,312 rows)" doesn't say only 50k searched) | Filter by period/model/key first to shrink the dataset |
| DSD-GAP-060 | Programmatic surface (window.handleMultipleUpload, parseCSV…) undocumented in README | Read `tests/setup.js` for the exact globals |
| DSD-GAP-061 | rawSearch has no placeholder/label; match semantics undiscoverable | Search terms match date/model/key/type substrings, case-insensitive |
| DSD-GAP-062 | Doc-drift process: docs/skills citing GAP ids go stale when rows complete | Re-grep docs for the GAP id before trusting a claim |
| DSD-GAP-034 | Upload super-linear on huge exports (14,240 rows → ~31 s, no progress UI) | Upload one month at a time |
| DSD-GAP-035 | Malformed-date rows dropped, toast shows count only | Compare toast count vs CSV row counts |
| DSD-GAP-057 | favicon 404 (cosmetic console noise) | Ignore |
| DSD-GAP-058 | vitest configLoader ESM-in-CJS warning every `npm test` | Ignore; tests still 332/332 |

## Automation Pitfalls (for agents driving the UI)

- The drop zone has **no** `<input type=file>` in the DOM — clicking it
  creates one dynamically. Either use Playwright's `filechooser` event, or
  attach your own hidden input inside `#dropZone` wired to
  `handleMultipleUpload(e.target.files)` (equivalent path, verified).
- **`window.confirm` dialogs:** Clear/Delete only act when the confirm is
  accepted. Playwright auto-dismisses dialogs — register
  `page.on('dialog', d => d.accept())` or patch `window.confirm` in-page.
- Collapsible panels (rate/anomaly) start **expanded on desktop, collapsed
  ≤768 px** — a desktop `.click()` on the toggle COLLAPSES them; selects
  inside a collapsed body are not visible to Playwright actionability checks
  (drive via `el.value=…; el.dispatchEvent(new Event('change'))`).
- KPI cards are built dynamically (no stable IDs) — wait for upload via
  `waitForFunction(() => kpiGrid.innerText.includes('TOTAL COST'))`.
- Read chart state via `window.Chart.getChart('cTokens')` (datasets/labels).
- The raw table is `#dataTable` (not #rawTable); search input `#rawSearch`;
  count label `#rowCount`.
- Fixtures: `sample-data.zip` (568 amount + 44 cost rows, June 2026) is
  gitignored but present locally. CSV schemas: amount
  `user_id,utc_date,model,api_key_name,api_key,type,price,amount`; cost
  `user_id,utc_date,model,wallet_type,cost,currency`. `utc_date` may be
  `YYYYMMDD` or `YYYY-MM-DD`.
- NEVER push: NO-PUSH policy (board/audit/dogfood commits stay local; only
  real code destined for the live site is pushed).
