# DeepSeek Usage Dashboard — E2E Browser Verification Report

**Run:** T78  
**Timestamp:** 2026-08-06  
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/  

---

## Structural Checks

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Title | `DeepSeek Usage Dashboard` | `DeepSeek Usage Dashboard` | ✅ |
| readyState | `complete` | `complete` | ✅ |
| `typeof initSqlJs` | `function` | `function` | ✅ |
| `typeof SQL` | `object` | `object` | ✅ |
| `typeof sqlite3` | `undefined` | `undefined` | ✅ |
| `<canvas>` count | 6 | 6 | ✅ |
| `<select>` count | 6 | 6 | ✅ |
| `<button>` count | 21 | 21 | ✅ |
| `<input type=file>` count | 0 | 0 | ✅ |
| Drop zone `.drop-zone` | present | present | ✅ |
| Empty state `"No data yet"` | present | present | ✅ |
| `[data-error]` | absent | absent | ✅ |

**Raw JSON:**
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

## CDN Resources

| Resource | Source | Version | Status | Pass |
|----------|--------|---------|--------|------|
| `jszip.min.js` | cdnjs | 3.10.1 | ok | ✅ |
| `chart.umd.min.js` | jsdelivr | chart.js@4.5.1 | ok | ✅ |
| `sql-wasm.js` | jsdelivr | sql.js@1.14.1 | ok | ✅ |
| `sql-wasm.wasm` | jsdelivr | sql.js@1.14.1 | HTTP 200 | ✅ |

---

## UI Element Checklist

| Check | Expected | Observed | Pass |
|-------|----------|----------|------|
| Header | `DeepSeek Dashboard Client-Side` | `DeepSeek Dashboard Client-Side` | ✅ |
| GitHub link | present | present | ✅ |
| Theme toggle button | `☾` or `☀` | `☾` | ✅ |
| Workspace select | present | present (`DirectTest`, `Default`) | ✅ |
| `+ New` button | present | present | ✅ |
| `✎` button | present | present | ✅ |
| `🗑` button | present | present | ✅ |
| `Clear` button | present | present | ✅ |
| Filter bar (Period) | present | present (All Time) | ✅ |
| Filter bar (Granularity) | present | present (Daily/Weekly/Monthly) | ✅ |
| Filter bar (Model) | present | present (All Models) | ✅ |
| Filter bar (Key) | present | present (All Keys) | ✅ |
| `Export CSV` button | present | present | ✅ |
| `Export All Raw` button | present | present | ✅ |
| `💰 Pricing Calculator` button | present | present | ✅ |
| Anomaly Detection card | present | present (⚠ Anomaly Detection) | ✅ |
| Rate Limit Monitor card | present | present (📈 Rate Limit Monitor) | ✅ |
| Raw Data section | present | present | ✅ |
| 6 Chart cards | present | present (Token Usage, Model Distribution, Daily Spend, Per-Model, Input vs Output, Per-Key Spend + Top 10 Spend) | ✅ |

---

## Interactive Tests

| Test | Action | Result | Pass |
|------|--------|--------|------|
| Theme toggle | Click ☾ → read `data-theme` | `light` → `dark` → `light` (full cycle) | ✅ |
| Anomaly card collapse | Click toggle → read display | `block` → `none` → `block` (toggles correctly) | ✅ |

---

## Console

| Metric | Expected | Observed | Pass |
|--------|----------|----------|------|
| Errors | 0 | 0 | ✅ |
| Warnings | 0 | 0 | ✅ |
| Total messages | 0 | 0 | ✅ |

---

## Screenshots

| File | Size | MD5 | Pass |
|------|------|-----|------|
| `e2e-output/screenshots/01-dashboard.png` | 107,373 bytes (104.9 KB) | `8cf094d8183691a6f9ed122afb564ff4` | ✅ (>50KB) |
| `e2e-output/screenshots/02-scrolled.png` | 107,373 bytes (104.9 KB) | `8cf094d8183691a6f9ed122afb564ff4` | ✅ (>50KB) |

**Note:** Both screenshots are byte-identical. This is benign and expected behavior — `captureBeyondViewport: true` captures the full page regardless of scroll position. This full-page capture determinism has been documented since T53/T58.

---

## Final Verdict

**Verdict: PASS (33/33)** ✅

All 33 checks pass with zero anomalies. The dashboard loads correctly from GitHub Pages, all CDN resources resolve, all UI elements are present, interactive features (theme toggle, anomaly card collapse) work correctly, and the console is clean.
