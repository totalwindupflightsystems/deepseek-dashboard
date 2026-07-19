# Coding Hermes Tasks — deepseek-dashboard

## Active

## Backlog

## Queued (Never-Done Audit 2026-07-19)

- [ ] DEPS: sql.js 1.10.3 → 1.14.1 — 4 major versions behind (latest 1.14.1, 3 months old). Check breaking changes in 1.11, 1.12, 1.13, 1.14. Update CDN URLs in index.html lines 10 and 2402. Verify IndexedDB persistence still works.
- [ ] DEPS: Chart.js 4.4.1 → 4.5.1 — minor version behind (latest 4.5.1, 9 months old). Update CDN URL in index.html line 9. Verify all 7 chart types still render (token, modelDist, spend, modelPie, ratio, key, anomaly scatter).
- [ ] QUALITY: XSS hardening — 29 innerHTML calls with untrusted data. Workspace names (line 2023), CSV model names (line 1241), API key names (line 1246), filenames (line 1537), raw data table (line 1972). All client-side-only so risk is low, but add textContent for text nodes or an escapeHtml() helper for mixed content.
- [ ] TEST: No automated tests — 0 unit tests for CSV parser (`parseCSV`), anomaly detection (`detectAnomalies`), date grouping (`groupDays`, `getISOWeekStart`), pricing calculator (`recalcPricing`, `getAvgPriceForModel`). Add at minimum a basic test harness (Jest/Vitest) for critical calculation functions.
- [ ] QUALITY: Add 'use strict' directive — entire 2,426-line file has no strict mode. Add at top of `<script>` block.
- [ ] QUALITY: DRY panel collapse — anomaly toggle (lines 2298-2321) and rate limit toggle (lines 2324-2352) have identical collapse/resize logic. Extract to shared `setupCollapsiblePanel(toggleId, bodyId, chevronId)` helper.
- [ ] DOC: Add CONTRIBUTING.md — no contribution guide exists. Should cover: how to test (open index.html), how to update CDN deps, how to add a chart type, coding conventions.
- [ ] DOC: Add CHANGELOG.md — track version history. 26+ completed features across 20+ commits with no changelog. Retroactively populate from git log.
- [ ] CI: No CI/CD pipeline — no .github/workflows/. Add GitHub Action to: (a) validate HTML with html-validate, (b) run JS tests if added, (c) verify index.html is deployable. Currently deploys via docs branch with no automated gate.
- [ ] DUCKBRAIN: Document architecture patterns — deepseek-dashboard architecture not in DuckBrain. Save: CSV parse strategy (simple char-by-char, quoted-field support), sql.js IndexedDB persistence pattern, virtual scroll row-pooling approach, anomaly detection z-score algorithm, diff-based re-upload logic.
- [ ] PITFALL: CSV parser edge cases — `parseCSV` char-by-char parser (line 828) silently drops quoted fields with embedded newlines and may misparse commas inside quotes. The `continue` after `"` toggle (line 837) trims the quote character but doesn't handle escaped quotes (`""`). DeepSeek exports are simple but format changes could break silently.
- [ ] QUALITY: Monolithic 2,426-line file — HTML, CSS (lines 11-367), and JS (lines 569-2423) all in one file. Consider splitting CSS to `<style>` external and JS to `<script src>`. Low priority but aids maintainability.
- [ ] PERF: No debounce on filter changes — `periodSelect`, `modelSelect`, `keySelect`, `granularitySelect` all trigger `refreshAll` on every `change` event with no debounce. Rapid filter switching triggers redundant chart destruction/re-creation and SQL queries.
- [ ] PERF: Full dataset in memory — `renderTable` loads all rows for virtual scroll (line 1933 comment: "Remove LIMIT 1000 - fetch all"). For 6+ months of heavy usage this could be 100K+ rows in the JS array. Consider windowed SQL queries for very large datasets.

## Completed

- ✅ DOC: README feature table updated with 10+ implemented features — rate limit, anomaly detection, model distribution, pricing calculator, PNG export, virtual scrolling, multi-workspace, granularity, theme toggle, mobile refinements (commit 21882be)
- ✅ DOC: Sample data section references non-existent files — ZIPs are gitignored, no sample-data/ directory (commit c545db0)
- ✅ DOC: OpenRouter comparison claimed in README but not implemented — removed stale claims in 3 sections (Privacy, Features, Known Limitations); feature was intentionally removed in 3959602
- ✅ DOC: Fix README line count claim — says ~1,100 lines, actual is 2,184
- ✅ DOC: Fix README Chart.js version — says 4.4.7, actual import is 4.4.1
- ✅ DOC: Add sql.js to README tech stack table
- ✅ DOC: Update README localStorage claim — says "no localStorage by default" but theme persistence uses it immediately
- ✅ P1: Rate limit monitoring panel — collapsible panel showing request rate metrics, configurable API tier (Free/Paid/Enterprise/Custom), usage gauges, peak day analysis, top request-volume days list, tier preference persisted in localStorage. (commit cb63352)
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
- ✅ DOC: README Sample Data section claims "repository includes real June 2026 export" but ZIPs are gitignored and no sample-data/ directory exists. Prior DOC task (c545db0) only fixed SKILL.md, missed README. (commit 79ff469)
- ✅ DOC: Line count claims say ~2,200 but actual index.html is 2,426 lines. Affects README line 60 and SKILL.md line 33. (commit 79ff469)
