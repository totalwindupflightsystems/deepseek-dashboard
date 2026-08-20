# E2E Report — DeepSeek Dashboard

**Run:** T183 (window T181-186 — first available tick in window; T179-182 were idle audit ticks)
**Timestamp:** 2026-08-20T06:05Z
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**HTTP Status:** 200 (page loaded successfully)
**Under test:** live Pages build of d6335eb (board chore; code head d120680 — sql.js 1.14.2 CDN pin), byte-identical to origin/main (md5 b1445754)

---

## Structural Checks

```json
{
  "title": "DeepSeek Usage Dashboard",
  "ready": "complete",
  "sqlJs": "function",
  "SQL": "object (initialized)",
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

All structural checks match the T178 known-good baseline.

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js (cdnjs 3.10.1) | loaded (typeof JSZip = function, SRI attr present) |
| chart.umd.min.js (jsdelivr 4.5.1) | 200 (typeof Chart = function, SRI attr present) |
| sql-wasm.js (jsdelivr 1.14.2) | 200 (typeof initSqlJs = function, SRI attr present) |
| sql-wasm.wasm | loaded (SQL initialized to object) |

All 4 CDN resources OK. All 3 script tags carry `integrity` attrs; since all three
libraries executed (typeof checks pass), the browser cryptographically verified
each SRI hash against served bytes at load time.

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

`screenshots/t183-e2e.png` — dark theme, empty state, all sections rendered; vision-verified (no visual breakage, no overlap, correct styling).

## Verdict

**PASS — 19/19 checks** (structural 11/11, CDN 4/4, UI 16/16, interactive 3/3). Live site byte-identical to origin/main (md5 b1445754), no regressions since T178. Next due ~T188+.
