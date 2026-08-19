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
