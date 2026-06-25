# Coding Hermes Tasks — deepseek-dashboard

## Active

### P1: OpenRouter comparison overlay
- Wire the OpenRouter Analytics API fetch to overlay usage curves on the DeepSeek charts
- When user pastes OR key, fetch their analytics, normalize to same date range, render as dashed overlay lines on the Token Usage and Daily Spend charts
- Handle API errors gracefully (wrong key, rate limit, network failure)
- Show OR cost alongside DeepSeek cost in a comparison KPI card

### P2: Chart export as PNG
- Add a small download icon/button to each chart card that exports the chart as a PNG
- Use Chart.js `toBase64Image()` method
- Filename should include chart type and date range

### P3: Multiple file upload support
- Allow dragging multiple ZIPs at once (multi-month exports)
- Process each ZIP sequentially, show progress per file
- De-duplicate overlapping date ranges across ZIPs

### P4: Virtual scrolling for large data
- When raw data table exceeds 500 rows, implement virtual scrolling
- Only render visible rows + buffer, recycle DOM nodes
- Maintain search/filter functionality

## Backlog

### P5: Dark/light theme toggle
- Add theme switcher in header, persist choice in localStorage
- Light theme with appropriate colors

### P6: Token pricing calculator
- Add a section where users can input custom token prices and compute costs
- Useful if DeepSeek changes pricing and export data is stale

### P7: Mobile refinements
- Swipe to dismiss toast, touch-friendly chart interactions
- Bottom sheet for filters on narrow screens

## Completed
- ✅ Single-file HTML dashboard with Chart.js + JSZip
- ✅ sql.js persistence via IndexedDB
- ✅ Multi-workspace support (create/rename/delete/switch)
- ✅ Diff management on re-upload (replace matching date range)
- ✅ Clear button per workspace
- ✅ Upload history log
- ✅ KPI cards + 6 chart panels
- ✅ CSV export (aggregated + raw)
- ✅ GitHub Pages deployment
