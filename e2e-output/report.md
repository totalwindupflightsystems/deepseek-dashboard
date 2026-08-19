# E2E Report — DeepSeek Dashboard

**Run:** T178 (window T175-180, second tick in window — T175-177 were productive gap/doc ticks)
**Timestamp:** 2026-08-19T19:42Z
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**HTTP Status:** 200 (page loaded successfully)
**Under test:** live Pages build of d120680 (sql.js CDN 1.14.1 → 1.14.2 + recomputed SRI)

---

## Structural Checks

```json
{
  "title": "DeepSeek Usage Dashboard",
  "ready": "complete",
  "sqlJs": "function",
  "SQL": "initialized",
  "canvases": 6,
  "selects": 6,
  "buttons": 21,
  "fileInputs": 0,
  "dropZone": true,
  "hasErrors": false,
  "emptyState": true,
  "searchBox": true
}
```

All structural checks match the T170 known-good baseline.

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js (cdnjs 3.10.1) | 200 (typeof JSZip = function) |
| chart.umd.min.js (jsdelivr 4.5.1) | 200 (typeof Chart = function) |
| sql-wasm.js (jsdelivr **1.14.2**) | 200 (typeof initSqlJs = function, SRI sha384 matches served bytes) |
| sql-wasm.wasm | loaded (SQL initialized to object — version bump live-verified) |

All 4 CDN resources OK. **sql.js 1.14.2 is the change under test this tick (DSD-GAP-038) — wasm initializes cleanly, no console errors.**

## UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | Present | ✅ |
| Theme toggle button | ☀ or 🌙 | ☀ (dark) | ✅ |
| Workspace select | Present | Present (Default) | ✅ |
| Drop zone present | .drop-zone present | Present | ✅ |
| Drop zone text | "Drop DeepSeek usage ZIP here" | Present | ✅ |
| Drop zone format help | ZIP of amount-*/cost-* CSVs (utc_date/model/type/price/amount) | Correct CSV-format text (no JSON mention) | ✅ |
| Export CSV button | Present | true | ✅ |
| Export All Raw button | Present | true | ✅ |
| Pricing Calculator button | Present | true | ✅ |
| Anomaly Detection card | Present | true | ✅ |
| Rate Limit Monitor card | Present | true | ✅ |
| Raw Data section | Present (with search box) | Present + searchbox | ✅ |
| GitHub link | Present | true | ✅ |
| Empty state text | "No data yet — drag in a DeepSeek usage ZIP" | true | ✅ |
| 6 canvas elements | 6 | 6 | ✅ |
| 6 select elements | 6 | 6 | ✅ |

## Interactive Checks

| Check | Result | Pass |
|-------|--------|------|
| Theme toggle dark → light → dark | data-theme flipped both ways | ✅ |
| Console errors | 0 | ✅ |
| Console warnings | 0 | ✅ |

## Screenshot

`screenshots/t178-e2e.png` — dark theme, empty state, all sections rendered; vision-verified (no visual breakage, no overlap, correct styling).

## Verdict

**PASS — 19/19 checks** (structural 11/11, CDN 4/4, UI 16/16, interactive 3/3). Live site serves sql.js 1.14.2 with valid SRI. No regressions from the CDN bump.
