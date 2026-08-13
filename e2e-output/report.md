# E2E Lean Report — DeepSeek Dashboard

**Run:** T139  
**Timestamp:** 2026-08-13T17:05 UTC  
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

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Title | "DeepSeek Usage Dashboard" | "DeepSeek Usage Dashboard" | ✓ |
| readyState | "complete" | "complete" | ✓ |
| typeof initSqlJs | "function" | "function" | ✓ |
| typeof SQL | "object" | "object" | ✓ |
| typeof sqlite3 | "undefined" | "undefined" | ✓ |
| canvas count | 6 | 6 | ✓ |
| select count | 6 | 6 | ✓ |
| button count | 21 | 21 | ✓ |
| input[type=file] | 0 | 0 | ✓ |
| .drop-zone present | true | true | ✓ |
| [data-error] present | false | false | ✓ |
| Empty state "No data yet" | true | true | ✓ |

---

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js | ok |
| chart.umd.min.js | ok |
| sql-wasm.js | ok |
| sql-wasm.wasm | 200 |

All 4 CDN resources loaded successfully (Chart.js 4.5.1 + JSZip 3.10.1 + sql.js).

---

## UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✓ |
| GitHub link | present | present | ✓ |
| Theme toggle button | text contains ☀ or 🌙 | "☀" | ✓ |
| Workspace select | present, value "Default" | present, value "Default" | ✓ |
| + New button | present | present | ✓ |
| ✎ button | present | present | ✓ |
| 🗑 button | present | present | ✓ |
| Clear button | present | present | ✓ |
| Filter: Period select | present | present | ✓ |
| Filter: Granularity select | present | present | ✓ |
| Filter: Model select | present | present | ✓ |
| Filter: Key select | present | present | ✓ |
| Export CSV button | text contains "Export CSV" | true | ✓ |
| Export All Raw button | text contains "Export All Raw" | true | ✓ |
| Pricing Calculator button | text contains "Pricing Calculator" | true | ✓ |
| Anomaly Detection card | text contains "Anomaly Detection" | true | ✓ |
| Rate Limit Monitor card | text contains "Rate Limit Monitor" | true | ✓ |
| Raw Data section | text contains "Raw Data" | true | ✓ |
| Drop zone text | "Drop DeepSeek usage ZIP here..." | "Drop DeepSeek usage ZIP here..." | ✓ |

---

## Interactive Tests

### Theme Toggle
- Before click: `data-theme` = "dark"
- After 1st click: `data-theme` = "light"
- After 2nd click: `data-theme` = "dark"
- Result: **PASS** — toggles dark→light→dark correctly

### Anomaly Card Collapse/Expand
- `.anomaly-toggle` selector: present
- `.anomaly-body` selector: present
- Before click: display = "block" (expanded)
- After 1st click: display = "none" (collapsed)
- After 2nd click: display = "block" (expanded)
- Result: **PASS** — collapses and expands correctly

---

## Console Output

- Console errors: **0**
- Console warnings: **0**
- Total messages: **0**
- Result: **PASS** — clean console

---

## Screenshots

| File | Path | Size | MD5 | PNG Valid |
|------|------|------|-----|-----------|
| 01-dashboard.png | /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png | 218,309 bytes | faa9a1bdd88c062d806020ddc166a37e | VALID (1280x800) |
| 02-scrolled.png | /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png | 31,673 bytes | 0b05b2bfb88b5dd485cf8819c3787915 | VALID (1280x800, near-blank) |

- Screenshots are NOT identical (different MD5s)
- 02-scrolled.png is 31KB (below 50KB threshold) — expected: scrolling to bottom of no-data dashboard shows mostly empty space; verify-png.py confirms VALID with near-blank content (28 unique samples). Benign.
- Capture method: CDP Page.captureScreenshot (JPEG quality 50) → decoded to PNG via Pillow

---

## Benign Notes

1. **Chart-card h3 count drift (documented T83):** Page renders 11 h3 elements (Upload History, Token Usage Over Time, Model Distribution Over Time, Daily Spend by Model, Per-Model Breakdown, Input vs Output Tokens, Top 10 Spend Days, Per-Key Spend, Raw Data, Create Workspace, Token Pricing Calculator) vs older 6-card baseline. Chart cards = 6 (canvas count). The extra h3s come from collapsible card headers, dialog titles, and nested sections. This is a known benign deviation — NOT a failure.

2. **02-scrolled.png below 50KB:** 31,673 bytes. The scrolled-to-bottom viewport of an empty dashboard is mostly blank space. PNG is structurally valid per verify-png.py. Benign.

---

## Verdict

**Verdict: PASS (33/33 checks, 2 benign notes)**

All 33 checks passed:
- 12 structural checks: PASS
- 4 CDN resources: PASS
- 12 UI checks: PASS (note: h3 count drift recorded as benign)
- 2 interactive tests: PASS
- 1 console check: PASS
- 2 screenshot captures: PASS (note: 02-scrolled below 50KB recorded as benign)

---

## Files Written

- `/home/kara/deepseek-dashboard/e2e-output/report.md` (this file)
- `/home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png` (218,309 bytes, md5: faa9a1bdd88c062d806020ddc166a37e)
- `/home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png` (31,673 bytes, md5: 0b05b2bfb88b5dd485cf8819c3787915)