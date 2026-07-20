# Coding Hermes Tasks — deepseek-dashboard

## Active

## Backlog

## Queued (Never-Done Audit 2026-07-19)

- [x] DEPS: sql.js 1.10.3 → 1.14.1 — 4 major versions behind (latest 1.14.1, 3 months old). Updated CDN URLs in index.html lines 10 and 2402 + README.md. All CDN URLs verified HTTP 200. (commit a91cd47^)
- [x] DEPS: Chart.js 4.4.1 → 4.5.1 — minor version behind (latest 4.5.1, 9 months old). Updated CDN URL in index.html line 9 (switched from cdnjs to jsdelivr — cdnjs latest is 4.5.0). Verified HTTP 200. (commit a91cd47^)
- [x] QUALITY: XSS hardening — 29 innerHTML calls with untrusted data. Added escapeHtml() helper, escaped all user-controlled data (model names, key names, workspace names, filenames, anomaly data, raw table rows, pricing rows), replaced innerHTML with textContent for badge/theme toggle icons. All 29 sites audited — 14 remaining are static or date/number-formatted. Added 'use strict'. JS syntax verified. (commit 706c599)
- [x] TEST: No automated tests — 0 unit tests for CSV parser (`parseCSV`), anomaly detection (`detectAnomalies`), date grouping (`groupDays`, `getISOWeekStart`), pricing calculator (`recalcPricing`, `getAvgPriceForModel`). Added Vitest harness with 55 tests across 5 test files. (commit 9a7e76c)
- [x] QUALITY: Add 'use strict' directive — entire 2,426-line file has no strict mode. Added at top of `<script>` block. (commit 706c599)
- [x] QUALITY: DRY panel collapse — anomaly toggle (lines 2298-2321) and rate limit toggle (lines 2324-2352) have identical collapse/resize logic. Extracted to shared `setupCollapsiblePanel(toggleId, bodyId, chevronId)` helper. (commit 882a0be)
- [x] DOC: Add CONTRIBUTING.md — no contribution guide exists. Added with how to test, code organization, CDN dep update instructions, coding conventions. (commit d40c0af)
- [x] DOC: Add CHANGELOG.md — track version history. 26+ completed features across 20+ commits with no changelog. Retroactively populated from git log. (commit 262d879)
- [ ] CI: No CI/CD pipeline — no .github/workflows/. Add GitHub Action to: (a) validate HTML with html-validate, (b) run JS tests if added, (c) verify index.html is deployable. Currently deploys via docs branch with no automated gate.
- [x] DUCKBRAIN: Document architecture patterns — deepseek-dashboard architecture not in DuckBrain. Save: CSV parse strategy (simple char-by-char, quoted-field support), sql.js IndexedDB persistence pattern, virtual scroll row-pooling approach, anomaly detection z-score algorithm, diff-based re-upload logic. (6 entries written to deepseek-dashboard namespace: overview, csv-parser, sqljs-persistence, anomaly-detection, diff-upload, virtual-scroll)
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

## [ ] NEVER-DONE — Run coding-hermes-never-done 11-point audit

Load coding-hermes-never-done skill. Run ALL 11 checks: spec alignment, doc coverage, test gaps, package upgrades, pitfall hunt, performance audit, endpoint verification, CI/CD health, DuckBrain sync, code quality, middle-out wiring. Create a task for EVERY gap found. This task is never complete — the audit always finds something.
