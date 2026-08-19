# E2E Report — DeepSeek Dashboard

**Run:** T170 (window T169-174, first available tick — T169 was productive GAP-035)
**Timestamp:** 2026-08-19T11:30Z
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**HTTP Status:** 200 (page loaded successfully)

---

## Structural Checks

```json
{
  "title": "DeepSeek Usage Dashboard",
  "ready": "complete",
  "sqlJs": "function",
  "SQL": "object",
  "sqlite3": "undefined",
  "canvases": 6,
  "selects": 6,
  "buttons": 21,
  "fileInputs": 0,
  "dropZone": true,
  "hasErrors": false,
  "emptyState": true
}
```

All structural checks match known-good baseline.

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js (cdnjs 3.10.1) | 200 (typeof JSZip = function) |
| chart.umd.min.js (jsdelivr 4.5.1) | 200 (typeof Chart = function) |
| sql-wasm.js (jsdelivr 1.14.1) | 200 (typeof initSqlJs = function) |
| sql-wasm.wasm | loaded (SQL initialized to object via locateFile) |

All 4 CDN resources OK. Chart.js 4.5.1 + JSZip 3.10.1 + sql.js present.

## UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | Present | ✅ |
| Theme toggle button | ☀ or 🌙 | ☀ (dark) | ✅ |
| Workspace select | Present | Present (Default) | ✅ |
| Drop zone present | .drop-zone present | Present | ✅ |
| Drop zone text | "Drop DeepSeek usage ZIP here" | Present | ✅ |
| Export CSV button | Present | true | ✅ |
| Export All Raw button | Present | true | ✅ |
| Pricing Calculator button | Present | true | ✅ |
| Anomaly Detection card | Present | true | ✅ |
| Rate Limit Monitor card | Present | true | ✅ |
| Raw Data section | Present (with search box) | Present | ✅ |
| GitHub link | Present | true | ✅ |
| Empty state text | "No data yet" | true | ✅ |
| 6 canvas elements | 6 | 6 | ✅ |
| 6 select elements | 6 | 6 | ✅ |
| 21 button elements | 21 | 21 | ✅ |
| 0 file inputs | 0 | 0 | ✅ |
| initSqlJs function | "function" | "function" | ✅ |
| SQL object | "object" (bare identifier) | "object" | ✅ |
| sqlite3 undefined | "undefined" | "undefined" | ✅ |
| No [data-error] | false | false | ✅ |

Note: `window.SQL` is undefined — SQL is a module-level `let` (global lexical
binding, not a window property); bare `SQL` is `"object"`. Same check shape as
T164 baseline.

## Interactive Tests

### Theme Toggle
- Before: `data-theme` = "dark"
- After click 1: `data-theme` = "light" (toggled)
- After click 2: `data-theme` = "dark" (toggled back)
- **Result: PASS** (dark → light → dark cycle confirmed)

### Anomaly Card Toggle
- Selector: `#anomalyToggle` — found
- After click 1: `.anomaly-body` display = "none" (collapsed)
- After click 2: `.anomaly-body` display = "block" (expanded)
- **Result: PASS** (block → none → block cycle confirmed)

## Console Output

- Console messages: 0
- JS errors: 0
- **Result: PASS** (clean console)

## Screenshots

| File | Dimensions | Size | MD5 | Verified |
|------|-----------|------|-----|----------|
| 01-dashboard-t170.png | 1009x3172 | — | 80dd18c334b7438f9ba2517649afbffc | VALID (PNG) |

Full-page capture (captureBeyondViewport). Vision QA confirms: header, drop
zone, filters, all 7 chart cards, anomaly + rate-limit cards, raw-data section
render correctly; blank chart areas are the expected no-data state; no visual
breakage or error overlays.

## Benign Notes

1. **h3 count = 11** — same as T164 (7 chart sections + nested h3s in
   collapsibles + Raw Data). Documented benign.
2. **Single screenshot this run** (T164 produced 2 byte-identical captures due
   to captureBeyondViewport; the scroll capture adds no information). Benign.

---

## Verdict: PASS (33/33)

All 33 checks passed:
- 21 structural checks ✅
- 4 CDN resources ✅
- 2 interactive tests ✅
- 1 console check ✅
- 5 UI element presence checks ✅

No failures. 2 benign notes documented.

---

**Files written:**
- `/home/kara/deepseek-dashboard/e2e-output/report.md` (this file)
- `/home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard-t170.png` (md5: 80dd18c334b7438f9ba2517649afbffc)
