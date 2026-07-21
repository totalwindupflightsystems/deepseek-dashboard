# DeepSeek Dashboard — Model Router Task Matrix

> **Core purpose:** Client-side analytics dashboard for DeepSeek API usage data — CSV upload, SQL.js persistence, Chart.js visualization, anomaly detection, rate-limit monitoring.

```
ID | Task | Priority | Complexity | Deps | Tags | Model | Reasoning | Fallback
```

## Active Tasks

| ID | Task | Pri | Cpx | Deps | Tags | Model | Lvl | Fallback |
|----|------|-----|-----|------|------|-------|-----|----------|
| — | (none) | — | — | — | — | — | — | — |

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
1. DOC-001 (README accuracy)
2. NEVER-DONE (periodic audit — runs when board empty)

## Escalation Conditions
- CDN dependency breaks → escalate to DEPS task, route to V4 Pro
- NEVER-DONE audit finds >5 gaps → split into per-gap tasks, reroute individually

---

## Completed Tasks (2026-07)

| ID | Description |
|----|-------------|
| DOC-001 | Update README + SKILL.md stale file structure / line count claims (commit 2f8d82c) |
| SEC-001 | Add Content-Security-Policy meta tag (commit cbe2644) |
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
|| PRIOR-* | 30+ prior completions: rate limits, anomaly detection, model distribution, pricing, PNG export, virtual scrolling, multi-workspace, granularity, theme toggle, mobile, OpenRouter comparison, CSV export, KPI cards, sql.js persistence, diff management |

---

## Idle Tick Tracking (2026-07-21)

**Idle tick #1** — Board empty, 11-point audit ran. Findings: stale README line counts fixed (f705112). No actionable gaps. All deps current, 60/60 tests pass, CI green, GH Pages deployed, DuckBrain synced. Cooldown: unchanged (idle tick <3, no action).

**Idle tick #2** — Board empty, discovery sweep clean. 60/60 tests pass, CI green, GH Pages deployed (HTTP 200, MD5 matched). 0 vulns, 0 outdated deps. No TODOs in source. Hilo 10 edges/8 files (all external imports — expected for flat JS). Cooldown: unchanged (idle tick <3, no action).

**Idle tick #3** — Board empty, 11-point adapted audit for single-file client project ran. All 11 checks pass with zero findings:

| Check | Result |
|-------|--------|
| 1. Spec Alignment | SKILL.md line counts (225/1933/321/749) match actual files; CDN versions match; all claims verified ✓ |
| 2. Doc Coverage | README accurate (~2,480 lines); CONTRIBUTING.md + CHANGELOG.md exist; feature table complete ✓ |
| 3. Test Gaps | 60/60 vitest tests pass across 6 test files + setup; critical functions covered (CSV parser, anomaly detection, pricing, grouping) ✓ |
| 4. Package Upgrades | JSZip 3.10.1, Chart.js 4.5.1, sql.js 1.14.1 — all current per npm registry ✓ |
| 5. Pitfall Hunt | 25 innerHTML countered by 45 escapeHtml/sanitize refs; all localStorage in try/catch; CSP meta present; 'use strict' ✓ |
| 6. Performance | 8 debounce/timeout references; virtual scrolling at 50K cap ✓ |
| 7. Endpoint Verification | N/A (client-only, no backend/server) |
| 8. CI/CD | CI green (vitest + html-validate); GH Pages HTTP 200 deployed ✓ |
| 9. DuckBrain Sync | 3 entries under /project/deepseek-dashboard/ (patterns, status, ticks) — sparse but functional ✓ |
| 10. Code Quality | File split complete (HTML/CSS/JS); 0 TODOs; no monolithic smell ✓ |
| 11. Middle-Out Wiring | N/A (single-file self-contained, deployment covered by check 8) |

**Actions:** Cooldown → 14400s (4h) per graduated slowdown protocol (idle tick ≥3). No new tasks created. Project is genuinely complete with zero actionable gaps.
