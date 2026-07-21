# DeepSeek Dashboard — Model Router Task Matrix

> **Core purpose:** Client-side analytics dashboard for DeepSeek API usage data — CSV upload, SQL.js persistence, Chart.js visualization, anomaly detection, rate-limit monitoring.

```
ID | Task | Priority | Complexity | Deps | Tags | Model | Reasoning | Fallback
```

## Active Tasks

| ID | Task | Pri | Cpx | Deps | Tags | Model | Lvl | Fallback |
|----|------|-----|-----|------|------|-------|-----|----------|
| DOC-001 | Update README + SKILL.md stale file structure / line count claims | Low | 1 | — | ++documentation, +file-editing, -architecture | DeepSeek V4 Flash | Minimal | Hy3 |
| SEC-001 | Add Content-Security-Policy meta tag | High | 2 | — | ++security, ++file-editing, +frontend | DeepSeek V4 Flash | Low | Step 3.7 Flash |

## Never-Done Audit (Standing)

| ID | Task | Pri | Cpx | Deps | Tags | Model | Lvl | Fallback |
|----|------|-----|-----|------|------|-------|-----|----------|
| NEVER-DONE | 11-point audit: spec alignment, doc coverage, test gaps, package upgrades, pitfall hunt, performance, endpoint verification, CI/CD, DuckBrain sync, code quality, middle-out wiring | Low | 3 | — | ++terminal, ++file-editing, ++code-review, +testing | DeepSeek V4 Pro | Medium | GLM-5.2 |

## Assumptions
- All production bugs addressed in prior ticks; remaining tasks are documentation/security hygiene
- No runtime dependencies (pure HTML/CSS/JS); no server needed
- CDN deps (Chart.js, JSZip, sql.js) are externally maintained

## Routing Notes
- DOC/SEC tasks are mechanical: single-file edits, copy changes → V4 Flash @ Minimal/Low
- NEVER-DONE audit needs multi-package scan + DuckBrain CRUD → V4 Pro @ Medium
- No vision or architecture tasks; all tools available in browser sandbox

## Execution Order
1. SEC-001 (CSP — security first)
2. DOC-001 (README accuracy)
3. NEVER-DONE (periodic audit — runs when board empty)

## Escalation Conditions
- CDN dependency breaks → escalate to DEPS task, route to V4 Pro
- CSP breaks functionality → escalate to V4 Pro for debugging
- NEVER-DONE audit finds >5 gaps → split into per-gap tasks, reroute individually

---

## Completed Tasks (2026-07)

| ID | Description |
|----|-------------|
| DEPS-001 | sql.js 1.10.3 → 1.14.1 |
| DEPS-002 | Chart.js 4.4.1 → 4.5.1 |
| QUALITY-001 | XSS hardening — 29 innerHTML sites audited + escapeHtml |
| TEST-001 | 55 Vitest tests across 5 test files |
| QUALITY-002 | 'use strict' directive |
| QUALITY-003 | DRY panel collapse — extract setupCollapsiblePanel |
| DOC-002 | CONTRIBUTING.md |
| DOC-003 | CHANGELOG.md |
| CI-001 | GitHub Actions CI: vitest + html-validate + deploy-check |
| DUCKBRAIN-001 | Architecture patterns documented (6 entries) |
| PITFALL-001 | CSV parser edge cases fixed (state machine rewrite) |
| QUALITY-004 | Monolithic file split: index.html → 3 files (HTML/CSS/JS) |
| PERF-001 | Debounce on filter changes (300ms) |
| PERF-002 | TABLE_ROW_LIMIT=50K cap |
| DEPS-003 | vitest 2.1.9 → 4.1.10 |
| DEPS-004 | jsdom 25.0.1 → 29.1.1 |
| DOC-004 | README feature table + sample data fixes |
| PRIOR-* | 30+ prior completions: rate limits, anomaly detection, model distribution, pricing, PNG export, virtual scrolling, multi-workspace, granularity, theme toggle, mobile, OpenRouter comparison, CSV export, KPI cards, sql.js persistence, diff management |
