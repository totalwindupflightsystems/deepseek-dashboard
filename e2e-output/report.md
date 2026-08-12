# DeepSeek Dashboard E2E Report — T124

**Run:** T124  
**Timestamp:** 2026-08-12 02:29 UTC  
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/  
**Method:** CDP Runtime.evaluate + Page.captureScreenshot (no browser_vision)  
**Target ID:** 61C34E592DFF8C6C9D320E9C9E56E7E6  

---

## 1. Structural Check

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
| title | "DeepSeek Usage Dashboard" | "DeepSeek Usage Dashboard" | ✓ |
| readyState | "complete" | "complete" | ✓ |
| typeof initSqlJs | "function" | "function" | ✓ |
| typeof SQL | "object" | "object" | ✓ |
| typeof sqlite3 | "undefined" | "undefined" | ✓ |
| canvas count | 6 | 6 | ✓ |
| select count | 6 | 6 | ✓ |
| button count | 21 | 21 | ✓ |
| input[type=file] | 0 | 0 | ✓ |
| .drop-zone present | true | true | ✓ |
| [data-error] absent | true | true (hasErrors=false) | ✓ |
| empty state "No data yet" | true | true | ✓ |

**Structural: 12/12 PASS**

---

## 2. CDN Resources

| Resource | Expected | Observed | Pass |
|----------|----------|----------|------|
| chart.umd.min.js (Chart.js 4.5.1) | ok | ok | ✓ |
| jszip.min.js (JSZip 3.10.1) | ok | ok | ✓ |
| sql-wasm.js | ok | ok | ✓ |
| sql-wasm.wasm | 200 | 200 | ✓ |

**CDN: 4/4 PASS**

---

## 3. UI Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header h1 | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✓ |
| Theme toggle button | ☀ or ☾ | ☾ | ✓ |
| Workspace select | present (DirectTest) | DirectTest (value: mrz5pdn8yp7hws) | ✓ |
| Drop zone text | "Drop DeepSeek usage ZIP here..." | present | ✓ |
| Export CSV button | present | true | ✓ |
| Export All Raw button | present | true | ✓ |
| Pricing Calculator button | present (💰) | true | ✓ |
| Anomaly Detection card | .anomaly-toggle present | true | ✓ |
| Rate Limit Monitor card | .rate-limit-toggle present | true | ✓ |
| Raw Data section | h3 "Raw Data" | true | ✓ |
| GitHub link | a[href*="github.com"] | true | ✓ |

**UI: 11/11 PASS**

---

## 4. Interactive Tests

### 4a. Theme Toggle

| State | Button text | data-theme attr |
|-------|-------------|-----------------|
| Before | ☾ | light |
| After click 1 | ☀ | dark |
| After click 2 | ☾ | light |

**Result: light → dark → light ✓ PASS**

### 4b. Anomaly Detection Card

| State | .anomaly-body display |
|-------|-----------------------|
| Before | block |
| After click 1 | none |
| After click 2 | block |

**Result: block → none → block ✓ PASS**

### 4c. Rate Limit Monitor Card

| State | .rate-limit-body display |
|-------|--------------------------|
| Before | block |
| After click 1 | none |
| After click 2 | block |

**Result: block → none → block ✓ PASS**

**Interactive: 3/3 PASS**

---

## 5. Console

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Console errors | 0 | 0 | ✓ |
| Console warnings | 0 | 0 | ✓ |

**Console: 2/2 PASS**

---

## 6. Screenshots

| File | Path | Size | MD5 | PNG Valid |
|------|------|------|-----|-----------|
| 01-dashboard.png | /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png | 115,832 bytes | 24dfa3efda3d91085c2ccebe2b902599 | VALID 1265x3560 |
| 02-scrolled.png | /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png | 115,832 bytes | 24dfa3efda3d91085c2ccebe2b902599 | VALID 1265x3560 |

**Notes:**
- Both screenshots are byte-identical (same MD5). Full-page capture with `captureBeyondViewport: true` captures the entire page regardless of scroll position, so scrolling produces an identical image. This is benign and documented since T53/T58.
- verify-png.py flags both as "SUSPICIOUS: near-blank" (unique_sample=52). The PNG structure is fully VALID (correct IHDR, CRC, zlib-to-EOF, IEND; 32 chunks; decoded bytes match expected). One retake was attempted with identical full-page params — produced byte-identical result (same MD5). Per T103/T109 guidance, retake loop stopped after one retry; artifacts left in place.
- Viewport override: 1280x800, deviceScaleFactor=1, mobile=false (T109/T119-proven).

**Screenshots: 2/2 captured (with benign notes)**

---

## 7. Benign Notes

1. **Chart-card h3 count drift (T83-documented):** The page renders 11 h3 elements (Upload History, Token Usage Over Time, Model Distribution Over Time, Daily Spend by Model, Per-Model Breakdown, Input vs Output Tokens, Top 10 Spend Days, Per-Key Spend, Raw Data, Create Workspace, Token Pricing Calculator) vs the older 6-card baseline. The 6-canvas structural check still passes. This is a benign note — the extra h3s come from collapsible section headers, modal dialogs (Create Workspace, Pricing Calculator), and the Upload History section.

2. **Screenshots byte-identical and flagged near-blank:** Both captures are byte-identical due to full-page `captureBeyondViewport` mode (scroll position does not affect full-page capture). The "near-blank" flag from verify-png.py (unique_sample=52) is a known characteristic of this deployment's full-page captures. PNG structure is VALID. One retake attempted — identical result. Artifacts left in place per T103/T109 anti-loop guidance.

---

## 8. Verdict

**Verdict: PASS (32/32 checks, 2 benign notes)**

All 32 functional checks pass:
- Structural: 12/12
- CDN: 4/4
- UI: 11/11
- Interactive: 3/3
- Console: 2/2

Benign notes (do not affect verdict):
1. Chart-card h3 count drift (11 vs 6 baseline) — T83-documented
2. Screenshots byte-identical + near-blank flag — T53/T58/T103/T109-documented full-page capture behavior

---

## Artifacts

- /home/kara/deepseek-dashboard/e2e-output/report.md (this file)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png (115,832 bytes, md5: 24dfa3efda3d91085c2ccebe2b902599)
- /home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png (115,832 bytes, md5: 24dfa3efda3d91085c2ccebe2b902599)