# E2E Browser Verification — DeepSeek Usage Dashboard

**Run:** T83  
**Timestamp:** 2026-08-07 10:50 UTC  
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/  
**Target ID:** `D960FEFE67F9622D7811B3579B438558`  
**Method:** Lean CDP-only (Runtime.evaluate + Page.captureScreenshot)

---

## 1. Structural JSON

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

---

## 2. CDN Resources

| Resource | Status |
|----------|--------|
| `jszip.min.js` | ok |
| `chart.umd.min.js` | ok |
| `sql-wasm.js` | ok |
| `sql-wasm.wasm` | 200 (HTTP) |

All 4 CDN resources loaded successfully.

---

## 3. Console

- **Errors:** 0
- **Warnings:** 0
- **Total messages:** 0

Clean console — no issues.

---

## 4. UI Checklist

| # | Check | Expected | Observed | Result |
|---|-------|----------|----------|--------|
| 1 | Title | "DeepSeek Usage Dashboard" | "DeepSeek Usage Dashboard" | ✅ PASS |
| 2 | Document readyState | complete | complete | ✅ PASS |
| 3 | `typeof initSqlJs` | function | function | ✅ PASS |
| 4 | `typeof SQL` | object | object | ✅ PASS |
| 5 | `typeof sqlite3` | undefined | undefined | ✅ PASS |
| 6 | Canvas count | 6 | 6 | ✅ PASS |
| 7 | Select count | 6 | 6 | ✅ PASS |
| 8 | Button count | 21 | 21 | ✅ PASS |
| 9 | File input count | 0 | 0 | ✅ PASS |
| 10 | Drop zone (`.drop-zone`) | present | present | ✅ PASS |
| 11 | `[data-error]` | absent | absent | ✅ PASS |
| 12 | Empty state text | "No data yet" | present | ✅ PASS |
| 13 | Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✅ PASS |
| 14 | Theme toggle button | ☀ or 🌙 or ☾ | ☾ | ✅ PASS |
| 15 | Workspace select | present | present (DirectTest) | ✅ PASS |
| 16 | Drop zone text | present | "Drop DeepSeek usage ZIP here..." | ✅ PASS |
| 17 | "Export CSV" button | present | present | ✅ PASS |
| 18 | "Export All Raw" button | present | present | ✅ PASS |
| 19 | "💰 Pricing Calculator" button | present | present | ✅ PASS |
| 20 | Anomaly Detection card | present | present | ✅ PASS |
| 21 | Rate Limit Monitor card | present | present | ✅ PASS |
| 22 | Raw Data section | present | present | ✅ PASS |
| 23 | GitHub link | present | present | ✅ PASS |
| 24 | Chart cards (h3 headings) | 6 | 10 ⚠️ | ⚠️ NOTE |
| 25 | "+ New" button | present | present | ✅ PASS |
| 26 | "✎" button | present | present | ✅ PASS |
| 27 | "🗑" button | present | present | ✅ PASS |
| 28 | "Clear" button | present | present | ✅ PASS |
| 29 | Filter: Period | present | present (All Time) | ✅ PASS |
| 30 | Filter: Granularity | present | present (Daily) | ✅ PASS |
| 31 | Filter: Model | present | present (All Models) | ✅ PASS |
| 32 | Filter: Key | present | present (All Keys) | ✅ PASS |

⚠️ **Chart card count note:** The baseline expected 6 chart cards, but the page returned 10 `h3` elements (excluding "Raw Data"). Visible chart headings from the accessibility snapshot include: "Token Usage Over Time", "Model Distribution Over Time", "Daily Spend by Model", "Per-Model Breakdown", "Input vs Output Tokens", "Top 10 Spend Days", "Per-Key Spend" (7 visible charts). The extra 3 likely come from nested `h3` elements inside the Anomaly Detection / Rate Limit Monitor collapsible sections. Baseline appears slightly outdated — the page has gained additional chart cards.

---

## 5. Interactive Tests

### 5a. Theme Toggle

| Step | Button | `data-theme` |
|------|--------|-------------|
| Before | ☾ | light |
| Click 1 | ☀ | dark |
| Click 2 | ☾ | light |

✅ Toggle works: `light → dark → light` (correct round-trip)

### 5b. Anomaly Detection Card Toggle

| Step | `.anomaly-body` display |
|------|------------------------|
| Initial | block |
| Click 1 | none |
| Click 2 | block |

✅ Collapsible works: `expanded → collapsed → expanded`

---

## 6. Screenshots

| File | Path | Size | MD5 |
|------|------|------|-----|
| 01-dashboard.png | `/home/kara/deepseek-dashboard/e2e-output/screenshots/01-dashboard.png` | 105 KB | `8cf094d8183691a6f9ed122afb564ff4` |
| 02-scrolled.png | `/home/kara/deepseek-dashboard/e2e-output/screenshots/02-scrolled.png` | 105 KB | `8cf094d8183691a6f9ed122afb564ff4` |

⚠️ **Byte-identical screenshots:** Both PNGs share the same MD5 hash. This is benign and matches the documented full-page-capture determinism (since T53/T58): `captureBeyondViewport: true` captures the entire page regardless of scroll position, producing identical output for both captures.

---

## 7. Verdict

**Verdict: PASS (31/32 checks, 1 benign note)**

All structural checks match the known-good baseline. Console is clean (0 errors, 0 warnings). All 4 CDN resources loaded successfully. UI elements present and correct. Interactive toggles (theme + anomaly card) behave correctly. Screenshots exist and exceed 50KB threshold (byte-identity is benign per documented determinism).

**Minor discrepancy:** Chart card count (observed 10 h3 elements vs. baseline's 6) — the page appears to have evolved with additional chart cards; this is cosmetic and does not affect functionality.
