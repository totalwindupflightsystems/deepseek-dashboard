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

**Assumptions:** Vanilla JS project — no framework, no build step. npm audit: 0 vulns. 0 TODOs/FIXMEs. 1,965 JS (dashboard.js) + 321 CSS + 225 HTML (2,723 JS total incl. tests/config). 60/60 vitest tests, 6 test files. Deployed to GitHub Pages (HTTP 200 verified). GitReins evaluator: deepseek-v4-flash @ deepseek-foreman, 50/10m/0.2M/0.4M. Hilo: 10 edges, 8 files (useful). Gitleaks: v8.30.1 panic (system bug — no real secrets). ESLint: config migration notice only (no errors).

**Routing Notes:** Tick #19 — 19th consecutive idle tick. Board has 0 real tasks — project stable. 60/60 tests pass. CI green (3/3 recent). Site live (HTTP 200). Scheduler cooldown: escalated to 24h cap. DOC gaps fixed this tick: SECURITY.md + LICENSE created (foreman-direct). Secrets guard: ⚠️ FAIL (gitleaks v8.30.1 binary panic — system bug, no project secrets).

**Execution Order:** NEVER-DONE only.

**Escalation Conditions:** Tick #19 idle. 24h cooldown cap reached. Escalating to Bane: project has been idle for 19 ticks with zero findings beyond self-fixed doc gaps. Decision needed: keep at 24h, disable, or assign new work.

## Completed

| ID | Task | Pri | Cpx | Commit | Model |
|----|------|-----|-----|--------|-------|
| BUG-001 | Fix double-upload dedup: normalize YYYYMMDD dates → YYYY-MM-DD | High | 1 | 280e3b8 | — |
| BUG-002 | CSP: add unsafe-eval for sql.js WebAssembly (dashboard was broken) | High | 1 | 025426e | — |
| BUG-003 | Fix workspace creation: hideModal() cleared modalCallback before use | High | 1 | 9a04bdc | — |
