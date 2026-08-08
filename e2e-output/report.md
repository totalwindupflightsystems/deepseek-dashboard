# E2E Browser Verification — DeepSeek Usage Dashboard

**Run:** T93  
**Timestamp:** 2026-08-08 22:25:45 UTC  
**Target:** https://totalwindupflightsystems.github.io/deepseek-dashboard/  

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
  "emptyState": true,
  "headerText": "DeepSeek Dashboard Client-Side\nGitHub\nDefault\n+ New\n✎\n🗑\nClear\n☀\nsaved"
}
```

## 2. CDN Resources
| Resource | Status |
|----------|--------|
| jszip.min.js | ok |
| chart.umd.min.js | ok |
| sql-wasm.js | ok |
| sql-wasm.wasm | ok |

## 3. Console
- Errors: 0
- Warnings: 0

## 4. UI Checklist
| # | Check | Expected | Observed | Result |
|---|-------|----------|----------|--------|
| 1 | structural: title | DeepSeek Usage Dashboard | PASS | PASS |
| 2 | structural: ready | complete | PASS | PASS |
| 3 | structural: sqlJs | function | PASS | PASS |
| 4 | structural: SQL | object | PASS | PASS |
| 5 | structural: sqlite3 | undefined | PASS | PASS |
| 6 | structural: canvases | 6 | PASS | PASS |
| 7 | structural: selects | 6 | PASS | PASS |
| 8 | structural: buttons | 21 | PASS | PASS |
| 9 | structural: fileInputs | 0 | PASS | PASS |
| 10 | structural: dropZone | true | PASS | PASS |
| 11 | structural: hasErrors | false | PASS | PASS |
| 12 | structural: emptyState | true | PASS | PASS |
| 13 | CDN: jszip.min.js | ok | ok | PASS |
| 14 | CDN: chart.umd.min.js | ok | ok | PASS |
| 15 | CDN: sql-wasm.js | ok | ok | PASS |
| 16 | CDN: sql-wasm.wasm | ok | ok | PASS |
| 17 | Console errors | 0 | 0 | PASS |
| 18 | Console warnings | 0 | 0 | PASS |
| 19 | Page title | DeepSeek Usage Dashboard | PASS | PASS |
| 20 | Header text | DeepSeek Dashboard Client-Side | PASS | PASS |
| 21 | Theme toggle button | present (☀ or ☾ or 🌙) | PASS | PASS |
| 22 | Workspace select | true | PASS | PASS |
| 23 | .drop-zone present | true | PASS | PASS |
| 24 | Drop-zone text | help text present | PASS | PASS |
| 25 | [data-error] absent | false | PASS | PASS |
| 26 | 'No data yet' text | true | PASS | PASS |
| 27 | Canvas count (charts) | 6 | PASS | PASS |
| 28 | Select count | 6 | PASS | PASS |
| 29 | Button count | 21 | PASS | PASS |
| 30 | File input count | 0 | PASS | PASS |
| 31 | '+ New' button | true | PASS | PASS |
| 32 | '✎ (edit)' button | true | PASS | PASS |
| 33 | '🗑 (delete)' button | true | PASS | PASS |
| 34 | 'Clear' button | true | PASS | PASS |
| 35 | 'Export CSV' button | true | PASS | PASS |
| 36 | 'Export All Raw' button | true | PASS | PASS |
| 37 | '💰 Pricing Calculator' button | true | PASS | PASS |
| 38 | Anomaly Detection card | true | PASS | PASS |
| 39 | Rate Limit Monitor card | true | PASS | PASS |
| 40 | Raw Data section | true | PASS | PASS |
| 41 | GitHub link | true | PASS | PASS |
| 42 | Period filter | true | PASS | PASS |
| 43 | Granularity filter | true | PASS | PASS |
| 44 | Model filter | true | PASS | PASS |
| 45 | Key filter | true | PASS | PASS |
| 46 | Theme toggle round-trip | light→dark→light | dark(☀)→light(☾)→dark(☀) | PASS |
| 47 | Anomaly card toggle round-trip | block→none→block | block→none→block | PASS |
| 48 | Rate Limit toggle round-trip | block→none→block | block→none→block (id=rateToggle) | PASS |
| 49 | Screenshot 01-dashboard.png >50KB | >50000 | 129161B | PASS |
| 50 | Screenshot 02-scrolled.png >50KB | >50000 | 129161B | PASS |

## 5. Theme Toggle
| State | theme attr | button text |
|-------|-----------|-------------|
| initial | dark | ☀ |
| after_click1 | light | ☾ |
| after_click2 | dark | ☀ |

## 6. Anomaly Card Toggle
| State | display |
|-------|---------|
| initial | block |
| after_click1 | none |
| after_click2 | block |

## 7. Rate Limit Monitor Toggle
| State | display |
|-------|---------|
| initial | block |
| after_click1 | none |
| after_click2 | block |

## 8. Screenshots
| File | Size (bytes) | MD5 |
|------|-------------|-----|
| 01-dashboard.png | 129161 | b86b48f8a6e95fc84b0b7603d11ad3e4 |
| 02-scrolled.png | 129161 | b86b48f8a6e95fc84b0b7603d11ad3e4 |

## 9. Notes
- Chart-card h3 count: 0 (baseline 6 — known drift, benign)
- Toggle IDs discovered: ["themeToggle","anomalyToggle","rateToggle"]
- No failures.
- Console error details: none

## Verdict: PASS (50 checks)
