# Dogfood Log — DeepSeek Usage Dashboard

| Run | Date | Verdict | Time-to-first-success | Frictions |
|-----|------|---------|----------------------|-----------|
| deep-dogfood #1 | 2026-08-09 | 🟡 PROMISING-BUT-ROUGH | 201 ms (drag → KPIs) | 6 |

## 2026-08-09 — Deep Dogfood Run

**Promise statement:** "A user can drag a DeepSeek Platform usage ZIP export into a
browser page and get charts, trends, KPIs, anomaly alerts, rate-limit gauges and
exports — all client-side, nothing leaving the browser."

**Verdict:** 🟡 PROMISING-BUT-ROUGH — the core promise holds up beautifully
(201 ms to first chart, zero console errors, privacy claim verified), but the
README-promised key drill-down is dead UI, the raw export transposes
amount/price, and the live demo link serves a stale build missing the board's
own completed fixes.

**Top findings (→ tasks):**
1. Key filter select is inert — `refreshAll()` never reads `#keySelect` → DSD-GAP-013 (P1)
2. "Export All Raw" swaps amount/price columns vs the source CSVs → DSD-GAP-014 (P1)
3. Live Pages demo is stale — still shows the GAP-001 "daily JSON files" drop-help bug, 0 SRI hashes → DSD-GAP-015 (P1)
4. "Last 7 Days"/"Last 30 Days" are wall-clock windows → misleading "No data yet — drag in a ZIP" on old data → DSD-GAP-016 (P2)
5. README claims usage data "evaporates when you close the tab" — actually persists in IndexedDB → DSD-GAP-017 (P2)
6. CSV-less ZIP failure toast has no reason → DSD-GAP-018 (P2)

**Evidence trail:** `/tmp/dogfood-dsd/evidence.jsonl` + `evidence-b.jsonl` (per-step
real-use evidence), screenshots in `/tmp/dogfood-dsd/shots/`, full report in
`docs/dogfood/2026-08-09-integration.md`.
