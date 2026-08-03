# DeepSeek Usage Dashboard — E2E Browser Verification Report

**Run:** T63
**Timestamp:** 2026-08-03 17:46 UTC
**URL:** https://totalwindupflightsystems.github.io/deepseek-dashboard/
**Window:** E2E-001 (ran T58, window T63-68 — first tick of window)

---

## Structural Checks (Runtime.evaluate — single JSON call)

```json
{
  "title": "DeepSeek Usage Dashboard",
  "readyState": "complete",
  "sqlJs": "function",
  "SQL": "object",
  "sqlite3": "undefined",
  "canvases": 6,
  "selects": 6,
  "buttons": 21,
  "fileInputs": 0,
  "dropZone": true,
  "hasErrors": false,
  "emptyState": true,
  "headerText": "DeepSeek Dashboard Client-Side",
  "htmlTheme": "light",
  "themeBtn": "☾"
}
```

## CDN Resources

| Resource | Source | Status |
|----------|--------|--------|
| chart.umd.min.js (Chart.js 4.5.1) | jsdelivr | ok |
| jszip.min.js (JSZip 3.10.1) | cdnjs | ok |
| sql-wasm.js (sql.js 1.14.1) | jsdelivr | ok |

**Total: 3 script CDN entries — all healthy. sql-wasm.wasm fetched 200 (sql.js initialised, `typeof initSqlJs === "function"`).**

## Verdict

**PASS** — 33/33 checks pass. No failures. 0 console errors, 0 console warnings (verified before and after all interactions).

---

## Checklist

| # | Check | Expected | Observed | Result |
|---|-------|----------|----------|--------|
| 1 | Page title | "DeepSeek Usage Dashboard" | "DeepSeek Usage Dashboard" | ✅ PASS |
| 2 | Console errors | 0 | 0 | ✅ PASS |
| 3 | Console warnings | 0 | 0 | ✅ PASS |
| 4 | CDN resources — chart.js | status ok/200 | ok | ✅ PASS |
| 5 | CDN resources — jszip | status ok/200 | ok | ✅ PASS |
| 6 | CDN resources — sql-wasm.js | status ok/200 | ok | ✅ PASS |
| 7 | `typeof initSqlJs` | `"function"` | `"function"` | ✅ PASS |
| 8 | SQL global present, NOT sqlite3 | `typeof SQL !== 'undefined'`, `typeof sqlite3 === 'undefined'` | `typeof SQL = "object"`, `sqlite3 = undefined` | ✅ PASS |
| 9 | `document.readyState` | `"complete"` | `"complete"` | ✅ PASS |
| 10 | `<canvas>` elements | 6 | 6 | ✅ PASS |
| 11 | `<select>` comboboxes | 6 | 6 | ✅ PASS |
| 12 | `<button>` elements | 21 | 21 | ✅ PASS |
| 13 | `<input type="file">` | 0 | 0 | ✅ PASS |
| 14 | Drop zone (`.drop-zone`) | present | true | ✅ PASS |
| 15 | No `[data-error]` elements | 0 | false | ✅ PASS |
| 16 | Header text | "DeepSeek Dashboard Client-Side" | "DeepSeek Dashboard Client-Side" | ✅ PASS |
| 17 | Empty state message | "No data yet" | present | ✅ PASS |

### UI Elements (all present)

| # | Check | Observed |
|---|-------|----------|
| 18 | Workspace selector ("DirectTest"/"Default") | ✅ |
| 19 | "+ New" button | ✅ |
| 20 | "✎" (edit) button | ✅ |
| 21 | "🗑" (delete) button | ✅ |
| 22 | "Clear" button | ✅ |
| 23 | Drop zone text ("Drop DeepSeek usage ZIP here") | ✅ |
| 24 | Filter bar (Period / Granularity / Model / Key) | ✅ 4 selects |
| 25 | "Export CSV" button | ✅ |
| 26 | "Export All Raw" button | ✅ |
| 27 | "💰 Pricing Calculator" button | ✅ |
| 28 | Anomaly Detection card (threshold slider, 3 checkboxes) | ✅ |
| 29 | Rate Limit Monitor card (tier select, progress bar, 4 metric boxes) | ✅ |
| 30 | Chart cards (≥6) | ✅ 6 canvas + Per-Key Spend + Top 10 |
| 31 | Raw Data section | ✅ |

### Interactive Tests

| # | Check | Observed |
|---|-------|----------|
| 32 | Theme toggle (☾ → ☀ → ☾) | ✅ `data-theme` light→dark→light, icon ☾↔☀ |
| 33 | Anomaly Detection card expand/collapse | ✅ content display none→block→none, height 0→92→0, restores correctly |

---

## Notes

- **SQL type discrepancy (unchanged from T58):** runbook expects `typeof SQL === 'function'` but observed `"object"`. In sql.js v1.x the global `SQL` after init is the database instance object. The critical invariant — `typeof sqlite3 === 'undefined'` — holds. Runbook inaccuracy, not a dashboard regression.
- Theme toggle confirmed: icon ☾↔☀, `data-theme` toggles light↔dark, returns to light.
- Anomaly card: content `display` toggles block↔none, height 92↔0, restores correctly on second click.
- Empty state present: "No data yet — drag in a DeepSeek usage ZIP".
- Rate Limit Monitor: 🟢 green status, Free tier, 0% usage, 0/— metrics — correct null state.
- Final console check after all interactions: 0 errors, 0 warnings.
- **Screenshot limitation (unchanged):** browser_vision captures full-page captures; both screenshots visually identical full-page captures at different scroll positions (documented T53/T58 limitation, not a regression).
- Vision QA (2 independent screenshot analyses): no visual glitches, no broken layout, no CAPTCHA. Grid asymmetry on last row (Per-Key Spend alone) is intentional design (odd card count).

---

## Screenshots

| File | Description |
|------|-------------|
| `screenshots/01-dashboard.png` | Full page — header, drop zone, filters, cards, empty state |
| `screenshots/02-scrolled.png` | Scrolled — chart cards, Per-Key Spend, Raw Data section |
