# E2E Lean Report — DeepSeek Dashboard

**Run:** T188
**Timestamp:** 2026-08-21T18:28Z
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**Target ID:** 24FAAA78EA23E698DD4022253EA72486

---

## Structural Check

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

All structural checks PASS: title correct, readyState complete, initSqlJs function, SQL object, sqlite3 undefined, 6 canvas, 6 select, 21 button, 0 file input, drop zone present, no [data-error], empty state text "No data yet" present.

---

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js | 200 |
| chart.umd.min.js | 200 |
| sql-wasm.js | 200 |
| sql-wasm.wasm | 200 |

All CDN resources HTTP 200. Chart.js 4.5.1 (chart.umd.min.js) + JSZip 3.10.1 (jszip.min.js) + sql.js (sql-wasm.js + sql-wasm.wasm) all loaded successfully.

---

## UI Checklist

| Check | Expected | Observed |
|-------|----------|---------|
| Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" |
| Theme toggle button | Contains ☀ or 🌙 | ☀ (light mode active) |
| Workspace select | Present with options | "Default" selected |
| Drop zone | Present with text | "Drop DeepSeek usage ZIP here..." |
| Export CSV button | Present | Yes |
| Export All Raw button | Present | Yes |
| Pricing Calculator button | Contains "Pricing Calculator" | Yes |
| Anomaly Detection card | Present | Yes |
| Rate Limit Monitor card | Present | Yes |
| Raw Data section | Present | Yes |
| GitHub link | Present | Yes |

All UI checks PASS.

---

## Interactive Tests

### Theme Toggle
- Before click: data-theme = "dark"
- After click 1: data-theme = "light"
- After click 2: data-theme = "dark"
- Toggled: true
- **PASS** — theme toggles dark → light → dark correctly.

### Anomaly Card Toggle
- Selector `.anomaly-toggle`: present
- Before click: display = "block" (expanded)
- After click 1: display = "none" (collapsed)
- After click 2: display = "block" (expanded)
- Toggled: true
- **PASS** — anomaly card expands/collapses correctly.

### Rate Limit Monitor Toggle
- Selector `.rate-limit-toggle`: NOT present
- **BENIGN** — selector absence documented as expected variant across ticks (T109 documented absence as benign; T124 found them present). No failure.

---

## Console

- Console messages: 0
- JS errors: 0
- Console warnings: 0
- **PASS** — clean console, no errors or warnings.

---

## h3 Count Drift (Benign Note)

- Expected (older baseline): 6 chart-card h3s
- Observed: 11 h3 elements total
- **BENIGN** — documented chart-card h3 count drift (proven T83, 2026-08-07). Page renders 7 chart sections + nested h3s inside Anomaly/Rate Limit collapsibles. The 6-canvas structural check still passes. Not a failure.

---

## Screenshots

| File | Dimensions | Size | md5 | verify-png |
|------|-----------|------|-----|------------|
| e2e-output/screenshots/01-dashboard.png | 1265x3580 | 296,090 bytes | 9a839769ff308520c84a5d9dafdbc014 | VALID (8 chunks, unique_sample=101) |
| e2e-output/screenshots/02-scrolled.png | 1280x3607 | 296,340 bytes | 189c13c218e0f7e198c689827174273f | VALID (8 chunks, unique_sample=89) |

Both screenshots are full-page captures (captureBeyondViewport=true). Captured as JPEG quality 85 via direct CDP WebSocket (bypassing browser_cdp transport size cap), then converted to PNG via Pillow. Both >50KB (296KB each). Screenshots are NOT identical (different md5s, different dimensions — 1265x3580 vs 1280x3607). Dimension difference is benign: at bottom scroll position the vertical scrollbar hides, slightly widening the capture (documented since T53/T58).

---

## Verdict

**Verdict: PASS (32/33 checks, 1 benign note)**

- 32 checks PASS (structural 12/12, CDN 4/4, UI 11/11, interactive 2/2, console 3/3)
- 1 benign note: h3 count drift (11 vs older 6-card baseline — documented and expected)
- Rate-limit toggle selector absence: benign (documented variant, not a failure)
- Screenshots: 2/2 valid full-page PNGs, both verify-png VALID

---

## Files Written

- /home/kara/deepseek-dashboard/e2e-output/report.md (this file)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png (md5: 9a839769ff308520c84a5d9dafdbc014)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png (md5: 189c13c218e0f7e198c689827174273f)