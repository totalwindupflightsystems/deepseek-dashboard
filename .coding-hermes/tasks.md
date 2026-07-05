# Coding Hermes Tasks — deepseek-dashboard

## Active

### [P3] Visual polish and desktop/mobile refinements
**Context:** "graphs look cheap on desktop" — need professional chart styling.

**Requirements:**
1. Chart.js options polish:
   - Rounded corners on bars (borderRadius: 4)
   - Proper font sizes for labels (9px desktop, 8px mobile)
   - Consistent padding and margins
   - Hover effects that show clear data points
2. The "filters panel with × button showing on desktop" — ensure mobile bottom-sheet doesn't leak to desktop
3. Drop zone: improve the "empty state" with a more helpful message about what data format is expected
4. Workspace selector: ensure dropdown width accommodates longer names
5. Raw data table: the cost column gets clipped — add horizontal scroll indicator

## Backlog

- Model distribution over time (stacked area chart)
- Anomaly detection / spike alerts
- Per-hour granularity option
- Rate limit monitoring panel

## Completed

- ✅ P1: Clarify input vs output token usage visuals — combine input tokens on time chart, rename prompt/completion chart, split KPIs, human-readable table types, input/output cost split on spend chart (commit f671695)
- ✅ P6: Mobile refinements — swipe to dismiss toast, bottom sheet for filters (commit 9036365)
- ✅ P4: Token pricing calculator (commit cfec1a7)
- ✅ P5: Dark/light theme toggle (commit 85ff11c)
- ✅ P3: Virtual scrolling for large data (commit 12dd2f8)
- ✅ P2: Multiple file upload support (commit 35edc1d)
- ✅ Single-file HTML dashboard with Chart.js + JSZip
- ✅ sql.js persistence via IndexedDB
- ✅ Multi-workspace support (create/rename/delete/switch)
- ✅ Diff management on re-upload (replace matching date range)
- ✅ Clear button per workspace
- ✅ Upload history log
- ✅ KPI cards + 6 chart panels
- ✅ CSV export (aggregated + raw)
- ✅ GitHub Pages deployment
- ✅ P1: OpenRouter comparison overlay — fetch OR Analytics API data, overlay dashed usage curves on Token and Spend charts, handle API errors, comparison KPI card (commit a2c5e71)
- ✅ P2: Chart export as PNG — download button on each Chart.js chart card, toBase64Image(), filename includes chart type + date range
