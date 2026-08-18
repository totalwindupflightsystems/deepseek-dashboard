# E2E Report — DeepSeek Dashboard

**Run:** T164 (window T159-164, window-END)  
**Timestamp:** 2026-08-18T13:44Z  
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
| jszip.min.js | 200 |
| chart.umd.min.js | 200 |
| sql-wasm.js | 200 |
| sql-wasm.wasm | 200 |

All 4 CDN resources HTTP 200. Chart.js 4.5.1 + JSZip 3.10.1 + sql.js present.

## UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✅ |
| Theme toggle button | ☀ or 🌙 | ☀ | ✅ |
| Workspace select | Present | Present (value: msqxza8rtddz31) | ✅ |
| Drop zone present | .drop-zone present | Present | ✅ |
| Drop zone text | "Drop DeepSeek usage ZIP here..." | Present | ✅ |
| Export CSV button | Present | true | ✅ |
| Export All Raw button | Present | true | ✅ |
| Pricing Calculator button | "💰 Pricing Calculator" | true | ✅ |
| Anomaly Detection card | Present | true | ✅ |
| Rate Limit Monitor card | Present | true | ✅ |
| Raw Data section | Present | true | ✅ |
| GitHub link | Present | true | ✅ |
| Empty state text | "No data yet" | true | ✅ |
| 6 canvas elements | 6 | 6 | ✅ |
| 6 select elements | 6 | 6 | ✅ |
| 21 button elements | 21 | 21 | ✅ |
| 0 file inputs | 0 | 0 | ✅ |
| initSqlJs function | "function" | "function" | ✅ |
| SQL object | "object" | "object" | ✅ |
| sqlite3 undefined | "undefined" | "undefined" | ✅ |
| No [data-error] | false | false | ✅ |

## Interactive Tests

### Theme Toggle
- Before: `data-theme` = "dark"
- After click 1: `data-theme` = "light" (toggled)
- After click 2: `data-theme` = "dark" (toggled back)
- **Result: PASS** (dark → light → dark cycle confirmed)

### Anomaly Card Toggle
- Selector: `.anomaly-toggle` — found
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
| 01-dashboard.png | 1265x3541 | 290,687 bytes | ef0c08e65067913941d212bcd1adf408 | VALID |
| 02-scrolled.png | 1265x3541 | 290,687 bytes | ef0c08e65067913941d212bcd1adf408 | VALID |

**Note:** Both screenshots are byte-identical (same MD5). `captureBeyondViewport: true` captures the entire page content regardless of scroll position, so scrolling to `document.body.scrollHeight` produced the same full-page capture. This is a benign behavior — the page has no dynamically lazy-loaded content below the fold, so the full-page capture already includes everything. Both are valid PNGs, verified by signature/IHDR/CRC/zlib/IEND checks.

## Benign Notes

1. **h3 count drift:** Page has 11 `<h3>` elements (vs older 6-card baseline). The page renders 7 chart sections + nested h3s inside Anomaly/Rate Limit collapsibles + Raw Data section = 11 total. The 6-canvas structural check still passes. This is a documented benign note (per known-good baseline instructions). Chart-card count: 7.

2. **Screenshots identical:** Both 01-dashboard.png and 02-scrolled.png are byte-identical due to `captureBeyondViewport` full-page capture. Benign.

---

## Verdict: PASS (33/33)

All 33 checks passed:
- 21 structural checks ✅
- 4 CDN resources ✅
- 2 interactive tests ✅
- 1 console check ✅
- 5 UI element presence checks ✅

No failures. 2 benign notes (h3 count drift, identical screenshots) documented per known-good baseline guidance.

---

**Files written:**
- `/home/kara/deepseek-dashboard/e2e-output/report.md` (this file)
- `/home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png` (md5: ef0c08e65067913941d212bcd1adf408, 290687 bytes)
- `/home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png` (md5: ef0c08e65067913941d212bcd1adf408, 290687 bytes)