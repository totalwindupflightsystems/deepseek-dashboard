# Coding Hermes Tasks — deepseek-dashboard

## Active

### P5: Dark/light theme toggle
- Add theme switcher in header, persist choice in localStorage
- Light theme with appropriate colors

## Backlog

### P6: Token pricing calculator
- Add a section where users can input custom token prices and compute costs
- Useful if DeepSeek changes pricing and export data is stale

### P7: Mobile refinements
- Swipe to dismiss toast, touch-friendly chart interactions
- Bottom sheet for filters on narrow screens

## Completed
- ✅ P3: Virtual scrolling for large data — pool of ~40 recycled DOM nodes, rAF-throttled scroll, 500-row threshold (commit `12dd2f8`)
- ✅ P2: Multiple file upload support — drag multiple ZIPs, sequential processing with per-file progress, error resilience, multi-select file picker (commit `35edc1d`)
- ✅ Single-file HTML dashboard with Chart.js + JSZip
- ✅ sql.js persistence via IndexedDB
- ✅ Multi-workspace support (create/rename/delete/switch)
- ✅ Diff management on re-upload (replace matching date range)
- ✅ Clear button per workspace
- ✅ Upload history log
- ✅ KPI cards + 6 chart panels
- ✅ CSV export (aggregated + raw)
- ✅ GitHub Pages deployment
- ✅ P1: OpenRouter comparison overlay — fetch OR Analytics API data, overlay dashed usage curves on Token and Spend charts, handle API errors, comparison KPI card (commit `a2c5e71`)
- ✅ P2: Chart export as PNG — download button on each Chart.js chart card, `toBase64Image()`, filename includes chart type + date range
