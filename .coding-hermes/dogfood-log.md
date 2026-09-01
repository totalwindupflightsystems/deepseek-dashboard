# Dogfood Log — DeepSeek Usage Dashboard

| Run | Date | Verdict | Time-to-first-success | Frictions |
|-----|------|---------|----------------------|-----------|
| deep-dogfood #1 | 2026-08-09 | 🟡 PROMISING-BUT-ROUGH | 201 ms (drag → KPIs) | 6 |
| deep-dogfood #2 | 2026-08-18 | ✅ SHIPPABLE | 228 ms (drag → KPIs) | 4 |

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

## 2026-08-18 — Deep Dogfood Run (Run 2)

**Promise statement:** "A user can drag a DeepSeek Platform usage ZIP export
into a browser page (or just open the live demo link) and get charts, trends,
KPIs, anomaly alerts, rate-limit gauges and exports — all client-side, nothing
leaving the browser."

**Verdict:** ✅ SHIPPABLE — the core promise holds end-to-end on the live
deployed site (byte-identical to local HEAD). All 6 run-1 findings re-verified
fixed: key filter works for tokens/charts (GAP-013), raw export columns
correct (GAP-014), live demo in sync with SRI (GAP-015), Last 7/30 Days
data-anchored (GAP-016), persistence docs truthful (GAP-017/019/022),
error toasts carry reasons (GAP-018), mixed-drop notice (GAP-029), XSS closed
both layers (GAP-030). New verified: diff re-upload, multi-month, workspace
Clear/Delete (confirm-guarded), virtual scrolling on 14,240 rows, privacy
(7 requests), 0 console errors across all sessions.

**Top findings (→ tasks):**
1. Key filter freezes cost KPIs (TOTAL COST stays $380.08 while everything
   else filters; per-key chart sums to exactly $380.08 so attribution exists)
   → DSD-GAP-032 (P2)
2. README claims table is "Searchable" — no search UI exists → DSD-GAP-033 (P2)
3. Upload time super-linear: 14,240 rows → 31 s, no progress → DSD-GAP-034 (P3)
4. Malformed-date rows silently dropped on upload → DSD-GAP-035 (P3)

**Evidence trail:** `/tmp/dogfood-dsd/run2/s{1,1b,1c,1d,2,2b,3}-evidence.jsonl`,
screenshots in `/tmp/dogfood-dsd/run2/shots/`, full report in
`docs/dogfood/2026-08-18-integration.md`, diagnostics updated in
`docs/dogfood/diagnostics.md` (run-2 section: two-source cost attribution,
silent drops, super-linear upload, doc ghosts).
2026-09-01 | SHIPPABLE | 3s t2fs | friction 6 | 5 findings
