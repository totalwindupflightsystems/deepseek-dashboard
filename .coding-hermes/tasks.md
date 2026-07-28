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

**Assumptions:** Vanilla JS project — no framework, no build step. npm audit: 0 vulns. 0 TODOs/FIXMEs. 2,511 total lines (dashboard.js 1,965 + CSS 321 + HTML 225). 60/60 vitest tests, 6 test files, 1.06s. GitHub Pages live (HTTP 200, totalwindupflightsystems.github.io). GitReins guard: all pass (secrets clean). Hilo: 10 edges, 8 files (useful). DuckBrain: 9 keys across 5 prefixes (list_keys verified). ESLint/Prettier: no config (lint+format not enforced — known gap, non-blocking for vanilla JS). [Verified T26: DuckBrain 9 keys, GitHub Pages correct URL, all gates clean.]

**Routing Notes:** Tick #26 — 26th consecutive idle tick. Board has 0 real tasks — project stable. 60/60 tests pass (1.06s). npm audit: 0 vulns. GitHub Pages live (HTTP 200, totalwindupflightsystems.github.io). GitReins guard: all pass. Hilo: 10 edges, 8 files (useful). DuckBrain: 9 keys across 5 prefixes (list_keys verified; prior T25 "1 key" was a DuckBrain recall flake, not a write failure). Known gap: ESLint/Prettier not configured (26+ ticks, non-blocking). No code changes needed.

**Execution Order:** NEVER-DONE only.

**Escalation Conditions:** Tick #26 idle. At cooldown cap (24h). Project stable with zero code issues. 26th consecutive idle tick. ESLint/Prettier remains the only known gap (non-blocking). No escalation needed unless Bane requests new features.

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
| 24 | 2026-07-27 08:23 | Idle+Fix | deepseek-v4-pro @ deepseek | 14-pt audit: all gates pass (60/60 tests ✓, 0 vulns, CI green, Hilo 10e/8f, GitHub Pages live). Fix applied: Hilo .gitignore narrowed from blanket `.vfs/` to cache files only — edges.jsonl now tracked in git (commit 423885b). DuckBrain writes succeeded + recall confirmed. Known gap: ESLint/Prettier not configured (non-blocking for vanilla JS). |
| 23 | 2026-07-26 20:21 | Idle | deepseek-v4-flash @ deepseek-foreman | 12-pt audit: all gates pass. 60/60 tests ✓ (1.66s). CI green (5/5 recent). npm audit 0 vulns. Hilo 10e/8f (warm). 2,723 JS + 546 HTML/CSS. Git clean. DuckBrain writes succeeded (state + audit-log/tick-23). MCP recall intermittent (known issue). 23rd consecutive idle tick — project stable, no gaps. |
| 20 | 2026-07-25 04:33 | Idle | deepseek-v4-pro @ deepseek | 14-pt audit: all gates pass. Security hygiene: CODEOWNERS created, .gitignore .env* added. 60/60 tests ✓. Hilo 10e/8f. DuckBrain 14k. CI green. Deps current. |
| 19 | 2026-07-24 | Idle | deepseek-v4-pro @ deepseek | 12-pt audit: SECURITY.md + LICENSE created (foreman-direct). 60/60 tests pass. ESLint notice only. |

| 25 | 2026-07-27 20:45 | Idle | deepseek-v4-pro @ deepseek | 12-pt audit: all gates pass (60/60 tests 1.60s, 0 vulns, GitReins clean, Hilo 10e/8f, GitHub Pages live). DuckBrain: state written + recall confirmed (was empty on arrival — prior ticks'' write claims unverified). Known gap: ESLint/Prettier not configured (25+ ticks, non-blocking). Git clean. VERDICT: idle — maintenance mode. |
| 26 | 2026-07-28 21:14 | Idle | deepseek-v4-pro @ deepseek | 11-gate universal audit: all gates pass. Git clean. GitReins guard PASS (secrets clean). Hilo 10e/8f (useful, stable). 60/60 tests 1.06s (vitest 4.1.10). npm audit 0 vulns. gitleaks clean. 0 TODOs/FIXMEs. GitHub Pages live (HTTP 200, totalwindupflightsystems.github.io). GitReins 0 tasks — board matches. DuckBrain: 9 keys across 5 prefixes (list_keys verified; prior T25 recall of "1 key" was a semantic-recall flake — keys were there all along). Deps: jsdom 29.1.1→30.0.0 available (minor, non-blocking). ESLint/Prettier gap: 26+ ticks (non-blocking for vanilla JS). VERDICT: idle — maintenance mode. |
