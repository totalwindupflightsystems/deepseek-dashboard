<!--
  BOARD FORMAT NOTE — the live board is v2.1 JSONL at .coding-hermes/board/tasks.jsonl
  (this file is a human-readable mirror; tasks.md.bak is the archived v1.3 matrix).
  New tasks MUST be appended to .coding-hermes/board/tasks.jsonl (see the rows added
  by dogfood runs below) — the foreman reads the JSONL.
-->

# DeepSeek Dashboard — Task Overview

**Core purpose:** Client-side analytics dashboard for DeepSeek API usage ZIP
exports — zero server, zero telemetry, GitHub Pages. Vanilla JS + Chart.js +
JSZip + sql.js, 90 vitest tests (11 files), deployed from `main`.

## Dogfood Findings (2026-08-18)

Run 2 (real-use browser sessions, local + live site). Verdict: ✅ SHIPPABLE.
All 2026-08-09 findings verified fixed; 4 new gaps filed as board tasks
(JSONL rows appended to `.coding-hermes/board/tasks.jsonl`):

- [ ] **DSD-GAP-032 (P2)** — Key filter leaves TOTAL COST / AVG DAILY COST
  KPIs frozen ($380.08 / $17.28 unchanged) while token/request KPIs and charts
  filter. Root cause: cost KPI reads `cost_daily` (no api_key column); per-key
  chart (price×amount) sums to exactly $380.08, so key-attributed cost exists
  and the KPI contradicts it. Fix: key-filtered cost KPI from token_usage, or
  annotate "billed cost — not split by key".
- [ ] **DSD-GAP-033 (P2)** — README:42 claims the raw table is "Searchable";
  zero search UI in index.html/js/dashboard.js. Filterable only.
- [ ] **DSD-GAP-034 (P3)** — Upload time super-linear: 612 rows → 228 ms,
  14,240 rows → 31 s, drop zone stuck on "Processing..." with no progress.
- [ ] **DSD-GAP-035 (P3)** — Malformed-date rows silently dropped at parse
  (defense-in-depth works — no XSS — but toast reports only kept rows).

Evidence: `/tmp/dogfood-dsd/run2/*.jsonl`; full report:
`docs/dogfood/2026-08-18-integration.md`.

## Dogfood Findings (2026-08-09)

Run 1 verdict: 🟡 PROMISING-BUT-ROUGH — 6 findings (DSD-GAP-013..018), all
closed and re-verified fixed on 2026-08-18. See
`docs/dogfood/2026-08-09-integration.md` and the JSONL board for history.

## Standing Tasks

- [ ] **NEVER-DONE — 12-point audit sweep** (perpetual, runs every tick)
- [ ] **E2E-001 — E2E Testing Tick** (self-improving loop, every 5-10 ticks)

## Dogfood Findings (2026-09-01)
Verdict: SHIPPABLE
Promise: {"entry_point":"Static single-page web app: open index.html in a browser (no CLI binary, no HTTP server required); live demo at https://totalwindupflightsystems.github.io/deepseek-dashboard/; optional local serve via python3 -m http.server","promise":"This project claims a user can turn DeepSeek's r

- [P2] README test count understated — '60+' vs 332 actual — npm test runs 332/332 vitest/jsdom tests; README says '60+'. Docs drift, but in the conservative direction (suite is larger than advertised, not smaller), so no trust impact on the deliverable itself.
- [P2] Dropped-rows toast lacks row/file-level detail — Upload toast '2 dropped — invalid utc_date' reports only a count; with real (not fixture) data the user cannot tell which file or rows were skipped and why, which is alarming when failures are intenti
- [P2] Row accounting mismatch between toast and upload history — Same ZIP shows 'Added 21 rows' in the toast but '42 rows' in upload history for one drag — appears to be added-vs-updated semantics (21 new + 21 diff-managed updates) but is never explained in the UI
- [P2] 'Load sample data' buttons render invisible and are undocumented — Buttons exist in the DOM but measure 0x0 once a workspace has data, and the README never mentions the feature at all — new users can't discover it, and users who do see it flash cannot understand why
- [P2] Two cosmetic/UX noise items: Vite configLoader warning and favicon 404 — Every npm test run emits a Vite 'configLoader native / ESM-in-CJS' warning that reads like an error to a new contributor; local serve logs a favicon.ico 404. Neither affects functionality, but both er

## Dogfood Findings (2026-09-07 — run 3, evening)

Real-use browser sessions (Playwright/Chrome) on local serve, plus fresh-install
leg on an ephemeral bunker agent. Untouched-surface focus: PNG export, pricing
calculator, rate-limit tiers, anomaly panel, granularity, theme, search,
mobile, offline CDN failure, file:// entry. Verdict: ✅ SHIPPABLE (3rd
consecutive). Live site byte-identical to HEAD (20,966 B index.html).
Evidence: `/tmp/dogfood-dsd/run3/evidence-{a,b,c}.jsonl` + `evidence-file.txt`,
screenshots `/tmp/dogfood-dsd/run3/shots/`, full report
`docs/dogfood/2026-09-07-integration.md`.

- [P2] **DSD-GAP-059** — Raw-table search caps at the 50,000-row fetch window
  silently: `renderTable()` fetches LIMIT 50,000 then searches that window;
  past 50k rows a needle outside the window yields "(0 of 97,312 rows)" —
  label doesn't say only a window was searched. Found in source (fixture too
  small to trigger); suite can't catch it.
- [P2] **DSD-GAP-060** — No documented programmatic surface:
  `window.handleMultipleUpload(FileList)`, `parseCSV`, `detectAnomalies` are
  stable and verified working (file:// + scripted upload, 0 console errors)
  but undocumented — batch users and agents must read source.
- [P3] **DSD-GAP-061** — rawSearch has no placeholder/label naming what it
  searches (date/model/key/type); match semantics (substring,
  case-insensitive) undiscoverable without source.
- [P2] **DSD-GAP-062** — Doc-drift process gap: usage SKILL.md went stale in
  a day (90 tests→332 actual; GAP-032/033 listed open→both complete). Fix the
  process: refresh docs citing a GAP id when that row completes.

Run-3 verifications (no task needed): GAP-033 search fix verified live
(`(283 of 568 rows)` filtered count, clean no-match state); GAP-055 offline
surface verified live (both CDNs blocked → visible "Failed to initialize —
Libraries failed to load: JSZip (tried cdnjs…, jsdelivr…)" banner, not a
blank page); favicon 404 still present (DSD-GAP-057, known); rate-limit
gauge math self-consistent (avg req/day ÷ tier daily cap: Free 7,944÷14,400
= 55.2%, Paid ÷720,000 = 1.1%); pricing calculator mathematically consistent
(2× output price → +$421.18 (+24.4%), per-model breakdown matches); theme
persists reload; mobile 375px: no horizontal overflow, filters bottom-sheet
works, panels collapse ≤768px; hostile ZIP (garbage row + wrong-column CSV +
non-CSV member) → "Added 2 rows … (1 dropped — invalid utc_date)", no
breakage. Fresh-install leg (bunker agent a9dafa8f on karahermes-mde-7840hs-2
— las-bunker-03 unreachable, matches pending QA rows): clone from public
GitHub → npm ci rc=0 (1s) → npm test 332/332 (6.1s) → npx html-validate
rc=0 → npm audit 0 vulnerabilities. Install_seconds=1 (deps) — agent had
node 22.23.2 preinstalled, so zero-bootstrap is untested on truly bare
Debian (prior QA note: agents lack node by default → count as known
harness provision step, not a project gap).

## Dogfood Findings (2026-09-07)
Verdict: SHIPPABLE
Promise: {"entry_point":"Static web page: open index.html in a browser (or the live GitHub Pages demo); no CLI binary, no server, no library/MCP/cron — the app is index.html + css/dashboard.css + js/dashboard.js with three version-pinned CDN libraries.","promise":"This project claims a user can turn DeepSeek

- [P2] Last 7 Days on sparse data shows cost without request counts — Reproduced live: period=7d on the June fixture renders 9.08 cost / '0 requests · ~0/day' / 100% input tokens with no partial-data indicator. Window 06-19..06-25 (anchored to dataset max 06-25) has c
- [P2] favicon.ico 404 on live site — curl https://totalwindupflightsystems.github.io/deepseek-dashboard/favicon.ico → HTTP 404; no favicon link in index.html, no favicon file in repo. Cosmetic console noise only.
- [P2] vitest configLoader 'native' ESM-in-CJS warning every test run — npm test prints 'ESM syntax in a file loaded as CommonJS (vitest.config.js:1:1)' — vitest.config.js uses import/export without type:module or .mjs. Cosmetic; 332/332 tests still pass in 2.61s.
- [P2] 'Load sample data' button undocumented in README How to Use — Button verified working (fresh workspace → 42 rows, dedup toast 'Added 42 rows · 2026-06-01 → 2026-08-15 (4 dropped — invalid utc_date)', 9 charts, 13.49 KPI). README Sample Data section documents b
- [P2] No programmatic upload path or port-conflict guidance documented — window.handleMultipleUpload exists (verified: notes.txt → 'No .zip files found') but README documents drag-drop only; run command is hardcoded to 8099 with no alternate-port note. Both are discoverabi
