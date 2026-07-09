# Coding Hermes Tasks — deepseek-dashboard

## Active

## Backlog

## Queued (discovery sweep 2026-07-09)

- [ ] DOC: Fix README line count claim — says ~1,100 lines, actual is 2,184
- [ ] DOC: Fix README Chart.js version — says 4.4.7, actual import is 4.4.1
- [ ] DOC: Add sql.js to README tech stack table
- [ ] DOC: Update README localStorage claim — says "no localStorage by default" but theme persistence uses it immediately

## Completed

- ✅ P1: Rate limit monitoring panel — collapsible panel showing request rate metrics, configurable API tier (Free/Paid/Enterprise/Custom), usage gauges, peak day analysis, top request-volume days list, tier preference persisted in localStorage. (commit TBD)

- ✅ P3: Per-hour / weekly / monthly granularity option — granularity selector (Daily/Weekly/Monthly), client-side date grouping via groupDays(), labels for weekly/monthly views, anomaly markers gated to daily, preference persisted in localStorage (commit bba5124)
- ✅ P2: Anomaly detection / spike alerts (TASK-001) — z-score based detection, collapsible panel with threshold slider & metric checkboxes, scatter markers on Token/Spend charts, severity levels, localStorage prefs (commit e6a30d0)
- ✅ P3: Visual polish and desktop/mobile refinements — rounded bar corners, responsive 8/9 px fonts, theme-aware grid/tooltip colors, mobile-only bottom sheet, longer workspace dropdown, drop-zone format help, table scroll indicator (commit 7a3d6e1)
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
- ✅ P1: Model distribution over time (stacked area chart) — added Model Distribution Over Time wide chart, renderModelDistChart function, destroy handling and PNG download (commit b27bbff)
- ✅ P1: OpenRouter comparison overlay — fetch OR Analytics API data, overlay dashed usage curves on Token and Spend charts, handle API errors, comparison KPI card (commit a2c5e71)
- ✅ P2: Chart export as PNG — download button on each Chart.js chart card, toBase64Image(), filename includes chart type + date range
