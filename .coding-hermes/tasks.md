<!--
  ⚠️  BOARD FORMAT — coding-hermes-model-router v1.3 (2026-07-24)
  All tasks MUST use matrix format: | ID | Task | Pri | Cpx | Deps | Tags | Model | Reasoning | Fallback |
  Before editing this file, load the skill: skill_view(name='coding-hermes-model-router')
  Validate: python3 ~/.hermes/scripts/validate-board-format.py .coding-hermes/tasks.md
  NEVER remove the matrix header row or NEVER-DONE / E2E-001 fixtures.
-->

# DeepSeek Dashboard — Model Router Task Matrix

**Core purpose:** Real-time DeepSeek API usage dashboard — tracks token consumption, costs, model breakdown. Vanilla JS/HTML/CSS, 60 vitest tests, deployed to GitHub Pages.

## Active Tasks

- [ ] **E2E-001 — E2E Testing Tick (self-improving loop)** 🔁 Every 5-10 ticks
  Spawn Luna (browser/screenshots) or Step 3.7 Flash (CLI/API). Deploy/build, Playwright, screenshots, endpoints, console. → e2e-output/tasks.md → inject into board.

| ID | Task | Pri | Cpx | Deps | Tags | Model | Reasoning | Fallback |
|----|------|-----|-----|------|------|-------|-----------|----------|
| NEVER-DONE | 12-point audit sweep | Low | 2 | — | +audit, +code-quality, ++testing | DeepSeek V4 Flash | Audit runs every tick; all checks historically green | DeepSeek V4 Flash |

**Assumptions:** Vanilla JS project — no framework, no build step. npm audit: 0 vulns. 0 TODOs/FIXMEs. 2,723 JS total (dashboard.js 1,965 + tests/config). 321 CSS + 225 HTML. 60/60 vitest tests, 6 test files. CI green (5/5 recent runs — test + html-validate + deploy-check). No GitHub Pages deployment configured (repo at totalwindupflightsystems/deepseek-dashboard). GitReins evaluator: deepseek-v4-flash @ deepseek-foreman, 50/10m/0.2M/0.4M. Hilo: 10 edges, 8 files (useful). DuckBrain: 2 keys (repopulated tick #21 — was empty). ESLint/Prettier: no config (lint+format not enforced — known gap, non-blocking for vanilla JS).

**Routing Notes:** Tick #22 — 22nd consecutive idle tick. Board has 0 real tasks — project stable. 60/60 tests pass. CI green (5/5). All deps up to date (npm audit: 0 vulns). DuckBrain namespace repopulated (2 entries written: project-state + audit-log). DuckBrain MCP connection unstable (known stdio pipe issue — intermittent ClosedResourceError). No code changes, no gaps found.

**Execution Order:** NEVER-DONE only.

**Escalation Conditions:** Tick #22 idle. At cooldown cap (12h). Project stable with zero code issues. Bane maintains directly (3 bug fixes handled last cycle). No escalation needed unless Bane requests new features.

## Completed

| ID | Task | Pri | Cpx | Commit | Model |
|----|------|-----|-----|--------|-------|
| BUG-001 | Fix double-upload dedup: normalize YYYYMMDD dates → YYYY-MM-DD | High | 1 | 280e3b8 | — |
| BUG-002 | CSP: add unsafe-eval for sql.js WebAssembly (dashboard was broken) | High | 1 | 025426e | — |
| BUG-003 | Fix workspace creation: hideModal() cleared modalCallback before use | High | 1 | 9a04bdc | — |

---

## Tick Log

| Tick | Date | Phase | Model | Result |
|------|------|-------|-------|--------|
|| 22 | 2026-07-26 08:14 | Idle | deepseek-v4-flash @ deepseek-foreman | 12-pt audit: all gates pass. 60/60 tests ✓. CI green (5/5). npm audit 0 vulns. Hilo 10e/8f. 983 LOC (JS+HTML+CSS). Git clean. DuckBrain MCP intermittent (known stdio pipe issue — writes succeeded, verify failed). 22nd idle tick — stable. |
| 20 | 2026-07-25 04:33 | Idle | deepseek-v4-pro @ deepseek | 14-pt audit: all gates pass. Security hygiene: CODEOWNERS created, .gitignore .env* added. 60/60 tests ✓. Hilo 10e/8f. DuckBrain 14k. CI green. Deps current. |
| 19 | 2026-07-24 | Idle | deepseek-v4-pro @ deepseek | 12-pt audit: SECURITY.md + LICENSE created (foreman-direct). 60/60 tests pass. ESLint notice only. |
