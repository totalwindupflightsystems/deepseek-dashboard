<!--
  BOARD FORMAT NOTE — the live board is v2.1 JSONL at .coding-hermes/board/tasks.jsonl
  (this file is a human-readable mirror; tasks.md.bak is the archived v1.3 matrix).
  New tasks MUST be appended to .coding-hermes/board/tasks.jsonl (see the rows added
  by dogfood runs below) — the foreman reads the JSONL.
-->

# DeepSeek Dashboard — Task Overview

**Core purpose:** Client-side analytics dashboard for DeepSeek API usage ZIP
exports — zero server, zero telemetry, GitHub Pages. Vanilla JS + Chart.js +
JSZip + sql.js, 90 vitest tests (11 files), deployed from `main`.

## Dogfood Findings (2026-08-18)

Run 2 (real-use browser sessions, local + live site). Verdict: ✅ SHIPPABLE.
All 2026-08-09 findings verified fixed; 4 new gaps filed as board tasks
(JSONL rows appended to `.coding-hermes/board/tasks.jsonl`):

- [ ] **DSD-GAP-032 (P2)** — Key filter leaves TOTAL COST / AVG DAILY COST
  KPIs frozen ($380.08 / $17.28 unchanged) while token/request KPIs and charts
  filter. Root cause: cost KPI reads `cost_daily` (no api_key column); per-key
  chart (price×amount) sums to exactly $380.08, so key-attributed cost exists
  and the KPI contradicts it. Fix: key-filtered cost KPI from token_usage, or
  annotate "billed cost — not split by key".
- [ ] **DSD-GAP-033 (P2)** — README:42 claims the raw table is "Searchable";
  zero search UI in index.html/js/dashboard.js. Filterable only.
- [ ] **DSD-GAP-034 (P3)** — Upload time super-linear: 612 rows → 228 ms,
  14,240 rows → 31 s, drop zone stuck on "Processing..." with no progress.
- [ ] **DSD-GAP-035 (P3)** — Malformed-date rows silently dropped at parse
  (defense-in-depth works — no XSS — but toast reports only kept rows).

Evidence: `/tmp/dogfood-dsd/run2/*.jsonl`; full report:
`docs/dogfood/2026-08-18-integration.md`.

## Dogfood Findings (2026-08-09)

Run 1 verdict: 🟡 PROMISING-BUT-ROUGH — 6 findings (DSD-GAP-013..018), all
closed and re-verified fixed on 2026-08-18. See
`docs/dogfood/2026-08-09-integration.md` and the JSONL board for history.

## Standing Tasks

- [ ] **NEVER-DONE — 12-point audit sweep** (perpetual, runs every tick)
- [ ] **E2E-001 — E2E Testing Tick** (self-improving loop, every 5-10 ticks)

## Dogfood Findings (2026-09-01)
Verdict: SHIPPABLE
Promise: {"entry_point":"Static single-page web app: open index.html in a browser (no CLI binary, no HTTP server required); live demo at https://totalwindupflightsystems.github.io/deepseek-dashboard/; optional local serve via python3 -m http.server","promise":"This project claims a user can turn DeepSeek's r

- [P2] README test count understated — '60+' vs 332 actual — npm test runs 332/332 vitest/jsdom tests; README says '60+'. Docs drift, but in the conservative direction (suite is larger than advertised, not smaller), so no trust impact on the deliverable itself.
- [P2] Dropped-rows toast lacks row/file-level detail — Upload toast '2 dropped — invalid utc_date' reports only a count; with real (not fixture) data the user cannot tell which file or rows were skipped and why, which is alarming when failures are intenti
- [P2] Row accounting mismatch between toast and upload history — Same ZIP shows 'Added 21 rows' in the toast but '42 rows' in upload history for one drag — appears to be added-vs-updated semantics (21 new + 21 diff-managed updates) but is never explained in the UI
- [P2] 'Load sample data' buttons render invisible and are undocumented — Buttons exist in the DOM but measure 0x0 once a workspace has data, and the README never mentions the feature at all — new users can't discover it, and users who do see it flash cannot understand why
- [P2] Two cosmetic/UX noise items: Vite configLoader warning and favicon 404 — Every npm test run emits a Vite 'configLoader native / ESM-in-CJS' warning that reads like an error to a new contributor; local serve logs a favicon.ico 404. Neither affects functionality, but both er
