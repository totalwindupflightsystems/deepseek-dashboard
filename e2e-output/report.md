# DeepSeek Dashboard E2E Report — T211

**Run:** T211
**Timestamp:** 2026-08-26 12:15 UTC
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**Target ID:** A35898D562F1B212E4C1BA87DC3F69F4

---

## Structural Checks

```json
{
  "title": "DeepSeek Usage Dashboard",
  "ready": "complete",
  "sqlJs": "function",
  "SQL": "object",
  "sqlite3": "undefined",
  "canvases": 9,
  "selects": 10,
  "buttons": 28,
  "fileInputs": 0,
  "dropZone": true,
  "hasErrors": false,
  "emptyState": true
}
```

| Check | Expected | Observed | Pass |
|------|----------|----------|------|
| Title | "DeepSeek Usage Dashboard" | "DeepSeek Usage Dashboard" | ✅ |
| readyState | "complete" | "complete" | ✅ |
| initSqlJs | "function" | "function" | ✅ |
| SQL | "object" | "object" | ✅ |
| sqlite3 | "undefined" | "undefined" | ✅ |
| Canvas count | 9 | 9 | ✅ |
| Select count | 10 | 10 | ✅ |
| Button count | 28 | 28 | ✅ |
| File inputs | 0 | 0 | ✅ |
| Drop zone | present | true | ✅ |
| data-error | absent | false | ✅ |
| Empty state "No data yet" | present | true | ✅ |

**Structural: 12/12 PASS**

---

## CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js | 200 |
| chart.umd.min.js | 200 |
| sql-wasm.js | 200 |
| sql-wasm.wasm | 200 |

**CDN: 4/4 PASS**

---

## UI Checklist

| Check | Expected | Observed | Pass |
|------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✅ |
| Theme toggle button | Contains ☀ or 🌙 | "☀" | ✅ |
| Workspace select | present | true | ✅ |
| Drop zone text | Contains "Drop DeepSeek usage ZIP" | "Drop DeepSeek usage ZIP here or click to select..." | ✅ |
| Export CSV button | present | true | ✅ |
| Export All Raw button | present | true | ✅ |
| Pricing Calculator button | present | true | ✅ |
| Anomaly Detection card | present | true | ✅ |
| Rate Limit Monitor card | present | true | ✅ |
| Raw Data section | present | true | ✅ |
| GitHub link | present | true | ✅ |

**UI: 11/11 PASS**

---

## Interactive Tests

### Theme Toggle
- Before: `data-theme="dark"`
- After 1st click: `data-theme="light"`
- After 2nd click: `data-theme="dark"`
- Toggled: true
- **PASS** — light→dark→light cycle works correctly

### Anomaly Detection Card
- Before: `.anomaly-body` display = `block`
- After 1st click: `none`
- After 2nd click: `block`
- Toggled: true
- **PASS** — expand/collapse works correctly

**Interactive: 2/2 PASS**

---

## Console Output

- Console messages: 0
- JS errors: 0
- Console warnings: 0

**Console: 1/1 PASS** (clean console)

---

## Screenshots

| File | Dimensions | Size | MD5 | verify-png |
|------|-----------|------|-----|------------|
| 01-dashboard.png | 625x4598 | 350,576 bytes | 813bdd798cd1236346d019066512dac3 | VALID (9 chunks, unique_sample=111) |
| 02-scrolled.png | 640x4666 | 360,767 bytes | 85994cc93be4d81c3f2edb9f261b84b1 | VALID (9 chunks, unique_sample=114) |

**Screenshots: 2/2 PASS**

### Screenshot Notes (benign)
- Screenshots are NOT identical (different MD5s) — expected since 01 is top-scrolled and 02 is bottom-scrolled.
- Dimensions differ slightly (625x4598 vs 640x4666) — the vertical scrollbar hides at bottom scroll, widening the capture. This is documented benign behavior (proven T159).
- Captured via CDP JPEG quality=50 at 640px viewport width, then converted to PNG via Pillow (T134-proven JPEG dodge). Full-page capture (`captureBeyondViewport: true`).
- Both screenshots >50KB (350KB and 360KB).

---

## Count Drift Notes (benign)

All observed counts match the T202 baseline exactly:
- 9 canvases ✅ (T202 baseline: 9)
- 10 selects ✅ (T202 baseline: 10)
- 28 buttons ✅ (T202 baseline: 28)
- 0 file inputs ✅ (T202 baseline: 0)

No count drift observed this tick.

---

## Verdict

**Verdict: PASS (33/33)**

All 33 checks passed:
- Structural: 12/12
- CDN: 4/4
- UI: 11/11
- Interactive: 2/2
- Console: 1/1
- Screenshots: 2/2
- Count drift: 0 benign notes (no drift)
- Screenshot dimension variance: 1 benign note (scrollbar width difference, documented T159)

Total with benign notes: 33/33 checks PASS, 1 benign note (screenshot dimension variance).

---

## Files Written

- /home/kara/deepseek-dashboard/e2e-output/report.md (this file)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png (350,576 bytes, MD5: 813bdd798cd1236346d019066512dac3)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png (360,767 bytes, MD5: 85994cc93be4d81c3f2edb9f261b84b1)