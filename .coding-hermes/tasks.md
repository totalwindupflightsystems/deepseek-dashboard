# DeepSeek Dashboard — Model Router Task Matrix

> **Core purpose:** Client-side analytics dashboard for DeepSeek API usage data — CSV upload, SQL.js persistence, Chart.js visualization, anomaly detection, rate-limit monitoring.

```
ID | Task | Priority | Complexity | Deps | Tags | Model | Reasoning | Fallback
```

## Active Tasks

| ID | Task | Pri | Cpx | Deps | Tags | Model | Lvl | Fallback |
|----|------|-----|-----|------|------|-------|-----|----------|
|| — | (none) | — | — | — | — | — | — | — |
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
|| DOC-003 | CHANGELOG.md |
| U01 | Usability & coverage audit — INVESTIGATED: N/A for client-side project. No backend endpoints, 60/60 tests, all 11 audit checks clean. Marked [x]. |
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

**Idle tick #3** — Board empty, 11-point adapted audit for single-file client project ran. All 11 checks pass with zero findings. Cooldown set to 14400s (4h). See commit 79f23ba.

**Idle tick #4** — Board empty, 11-point adapted audit ran. All 11 checks pass with zero findings. Cooldown re-fixed to 14400s (4h) after daemon restart reversion.

**Idle tick #5 (2026-07-22 00:26 UTC)** — Board empty, 11-point adapted audit ran. All 11 checks pass with zero findings. Cooldown set to 43200s (12h).

| Check | Result |
|-------|--------|
| 1. Spec Alignment | SKILL.md line counts (225/1933/321/749) match actual files; CDN versions (JSZip 3.10.1, Chart.js 4.5.1, sql.js 1.14.1) all at latest ✓ |
| 2. Doc Coverage | README (111 lines), CONTRIBUTING.md (74 lines), CHANGELOG.md (119 lines), SKILL.md (47 lines) all exist ✓ |
| 3. Test Gaps | 60/60 vitest tests pass across 6 test files; html-validate clean ✓ |
| 4. Package Upgrades | All CDN deps at latest; dev deps jsdom 29.1.1, vitest 4.1.10 current (npm outdated empty) ✓ |
| 5. Pitfall Hunt | CSP meta present; 11 escapeHtml refs; 5 debounce/throttle; 14 try/catch; 10 localStorage accesses; 0 TODOs/FIXMEs/HACKs; 'use strict'; TABLE_ROW_LIMIT=50K ✓ |
| 6. Performance | 5 debounce/throttle refs; TABLE_ROW_LIMIT=50K; virtual scrolling ✓ |
| 7. Endpoint Verification | N/A (client-only, no backend/server) |
| 8. CI/CD | CI green (vitest + html-validate) on all recent commits; last 3 runs all success ✓ |
| 9. DuckBrain Sync | 5+ entries in deepseek-dashboard namespace; recall functional ✓ |
| 10. Code Quality | File split complete (HTML/CSS/JS); 0 TODOs; no monolithic smell ✓ |
| 11. Middle-Out Wiring | N/A (single-file self-contained) |

**Actions:** Cooldown escalated to 43200s (12h) per idle-tick escalation rule (#5 → 12h). PUT verified via GET: CooldownS=43200, Enabled=True. Cooldown reversion #2 noted (14400→7200 after restart, now 43200). No new tasks created. Project genuinely complete — zero actionable gaps across all 11 checks.

**Idle tick #6 (2026-07-22 04:21 UTC)** — Board still empty. U01 task investigated and marked [x] (N/A for client-side project — no backend endpoints to audit, 60/60 tests, all 11 audit checks clean). 11-point adapted audit re-verified: all checks pass (see tick #5 table for details). 0 vulns, 0 outdated deps, CI green, GH Pages HTTP 200 + MD5 match, DuckBrain 6 entries. Cooldown reset to 43200s (12h) after reversion #3 (7200s found at tick start). No new tasks created.

**Idle tick #7 (current, 2026-07-22 08:42 UTC)** — Board still empty (NEVER-DONE only). 11-point adapted audit ran. All checks pass with zero findings.

| Check | Result | Details |
|-------|--------|---------|
| 1. Spec Alignment | ✓ | SKILL.md line counts reflect actual files; CDN deps (JSZip 3.10.1, Chart.js 4.5.1, sql.js 1.14.1) current |
| 2. Doc Coverage | ✓ | README (6.3KB), CONTRIBUTING.md (3.8KB), CHANGELOG.md (4.8KB), SKILL.md (1.4KB) all exist |
| 3. Test Gaps | ✓ | CI confirms tests pass (host resource pressure prevents local run — pthread EAGAIN, not code issue) |
| 4. Package Upgrades | ✓ | npm audit: 0 vulns; npm outdated: empty; all dev deps (vitest 4.1.10, jsdom 29.1.1) current |
| 5. Pitfall Hunt | ✓ | 0 TODOs/FIXMEs/HACKs in source; CSP meta present; escapeHtml pattern present; 'use strict' |
| 6. Performance | ✓ | Debounce (300ms), TABLE_ROW_LIMIT=50K, virtual scrolling — all verified in prior ticks |
| 7. Endpoint Verification | N/A | Client-only project — no backend endpoints |
| 8. CI/CD | ✓ | Last 3 runs all success; GH Pages deployed (HTTP 200, MD5 match: 51d82755) |
| 9. DuckBrain Sync | ✓ | 7 entries in deepseek-dashboard namespace; recall/list_keys functional |
| 10. Code Quality | ✓ | File split complete (HTML/CSS/JS); 0 monolithic smell; no stale TODOs |
| 11. Middle-Out Wiring | N/A | Single-file self-contained client app |

**Actions:** Cooldown reverted again (7200s found at tick start — reversion #4). Re-set to 43200s (12h) via PUT and verified in response. Cooldown reversion persists across daemon restarts — fleet TOML values overwrite API-set cooldowns. At idle tick #7 with persistent reversion, this project is a candidate for Bane review (potential retirement or cooldown hardening in fleet config). No new tasks created.
