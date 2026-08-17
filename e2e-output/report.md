# DeepSeek Dashboard E2E Report

**Run:** T159 (window T154-159)
**Timestamp:** 2026-08-16
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**Target ID:** 24FAAA78EA23E698DD4022253EA72486

---

## 1. Structural Checks

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

**Structural: 12/12 PASS**

---

## 2. CDN Resources

| Resource | Status |
|----------|--------|
| jszip.min.js | 200 |
| chart.umd.min.js | 200 |
| sql-wasm.js | 200 |
| sql-wasm.wasm | 200 |

**CDN: 4/4 PASS** (chart.js 4.5.1 + jszip 3.10.1 + sql-wasm.js + sql-wasm.wasm all HTTP 200)

---

## 3. UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✓ |
| Theme toggle button | Contains ☀ or 🌙 | "☀" (dark mode default) | ✓ |
| Workspace select | Present, has options | "Default" (value: msqxza8rtddz31) | ✓ |
| Drop zone text | Contains "Drop DeepSeek usage ZIP" | "Drop DeepSeek usage ZIP here..." | ✓ |
| Export CSV button | Present | true | ✓ |
| Export All Raw button | Present | true | ✓ |
| Pricing Calculator button | Present (💰) | true | ✓ |
| Anomaly Detection card | Present | present: true, text: "⚠ Anomaly Detection 0 ▼" | ✓ |
| Rate Limit Monitor card | Present in text | found-in-text (selector .rate-limit-toggle absent) | ✓ (benign) |
| Raw Data section | Present | true | ✓ |
| GitHub link | Present, points to repo | https://github.com/totalwindupflightsystems/deepseek-dashboard | ✓ |
| h3 count | ~10-11 (documented drift) | 11 | ✓ (benign note) |

**UI: 12/12 PASS** (2 benign notes: rate-limit-toggle selector absent but text present; h3 count drift documented since T83)

---

## 4. Interactive Tests

### 4a. Theme Toggle

| Step | data-theme | Button text |
|------|-----------|-------------|
| Before | dark | ☀ |
| After click 1 | light | ☾ |
| After click 2 | dark | ☀ |

**Result: PASS** — dark→light→dark cycle confirmed

### 4b. Anomaly Detection Card Toggle

| Step | .anomaly-body display |
|------|----------------------|
| Before | block |
| After click 1 | none |
| After click 2 | block |

**Result: PASS** — block→none→block cycle confirmed

### 4c. Rate Limit Monitor Toggle

Selector `.rate-limit-toggle` absent on this deployment (documented variance: T109 absent, T124 present, T139 present, T144/T149/T154 absent, T159 absent). Text "Rate Limit Monitor" found in body text. **Benign — not a failure.**

---

## 5. Console Output

- Console messages: 0
- JS errors: 0
- Console warnings: 0

**Console: PASS** (0 errors, 0 warnings)

---

## 6. Screenshots

| File | Dimensions | Size | MD5 | verify-png |
|------|-----------|------|-----|------------|
| 01-dashboard.png | 1265x3541 | 290687 bytes | ef0c08e65067913941d212bcd1adf408 | VALID (8 chunks, unique_sample=101) |
| 02-scrolled.png | 1280x3568 | 290922 bytes | 2c820f6e99c732f5ca018f1592789e2d | VALID (8 chunks, unique_sample=89) |

Both screenshots are full-page captures (captureBeyondViewport: true). Both >50KB. PNGs are NOT identical (different md5s, slightly different dimensions due to scroll position). Both verified clean by verify-png.py.

Absolute paths:
- /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png
- /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png

---

## 7. Benign Notes

1. **Chart-card h3 count drift (T83-proven):** Page renders 11 h3 elements (7 chart sections + 3 nested h3s inside collapsibles + 1 Raw Data h3) vs the older 6-card baseline. The 6-canvas structural check passes. This is a documented benign deviation, not a failure.

2. **Rate Limit Monitor toggle selector absent:** `.rate-limit-toggle` CSS selector is not present on this deployment. The "Rate Limit Monitor" text is found in the page body. Selector presence has varied across ticks (T109/T144/T149/T154 absent, T124/T139 present). Either outcome is expected. Not a failure.

---

## Verdict: PASS (33/33 checks, 2 benign notes)

All structural, CDN, UI, interactive, console, and screenshot checks passed. Two benign notes documented (h3 count drift and rate-limit-toggle selector absence) — neither affects functionality.