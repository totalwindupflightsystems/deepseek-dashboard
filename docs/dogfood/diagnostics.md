# Diagnostics Trail — DeepSeek Usage Dashboard

How this thing is built, why, what breaks, and the right way to do things.
Written 2026-08-09 from a real-use dogfood run (evidence: `2026-08-09-integration.md`).

## What It Is and How It's Built

A **zero-backend static site**: one `index.html` shell, one ~1,960-line
`js/dashboard.js`, one `css/dashboard.css`. Three CDN libraries, all
version-pinned with SRI hashes: JSZip 3.10.1 (ZIP parsing), Chart.js 4.5.1
(charts), sql.js 1.14.1 (SQLite **in the browser**). Deployed via GitHub Pages.

### The data path (the part that matters)

1. **Ingest:** `_processSingleFile()` → `JSZip.loadAsync(file)` → walk entries,
   route by filename prefix: `amount-*.csv` (per-key token rows) and
   `cost-*.csv` (per-model daily cost) → `parseCSV()`.
2. **Source CSV shape** (DeepSeek export): `amount-YYYY-M.csv` columns
   `user_id, utc_date, model, api_key_name, api_key, type, price, amount` —
   note **price BEFORE amount**; types are `input_cache_hit_tokens`,
   `input_cache_miss_tokens`, `output_tokens`, `request_count` (no price).
   `cost-YYYY-M.csv`: `user_id, utc_date, model, wallet_type, cost, currency`.
3. **Storage:** sql.js `token_usage`, `cost_daily`, `uploads`, `workspaces`
   tables. `token_usage` schema order is `id, workspace_id, utc_date, model,
   api_key_name, type, price, amount, upload_id` — **price before amount again**.
4. **Persistence:** the whole SQLite DB is serialized and stored in IndexedDB
   (DB `deepseek-dashboard`, store `sqlite-db`, one blob); reloaded on startup
   (`initDb`). The storage indicator ("ready"/"saved") reflects this.
5. **Diff management:** on upload, overlapping date ranges (per workspace) are
   deleted and replaced; `uploads` table records mode `insert`/`update` with
   `rows_replaced`/`rows_added` (this drives the "Updated 568 rows" toast).
6. **Rendering:** `refreshAll()` reads period + model filters → `getDailyData()`
   aggregates by day → `groupDays()` regroups to weekly/monthly → chart
   renderers. Anomaly detection is z-score over daily cost/tokens/requests.

### Why it works well (verified in real use)

- Privacy claim is real: page + 3 pinned CDN libs + local css/js = the *entire*
  request set. CSP blocks everything else (`connect-src 'self' + jsdelivr`).
  `'unsafe-eval'` is required for sql.js wasm — documented in AGENTS.md.
- Numbers are honest: KPI totals exactly match the README sample figures and
  cross-check across views (flash $23.21 + pro $356.87 = $380.08).

## Errors Hit on This Run (and the correct understanding)

### 1. Key filter is dead UI (DSD-GAP-013) — how to recognize it
`refreshAll()` reads `periodSelect.value` and `modelSelect.value` but *never*
`keySelect.value`. The select is bound to `_debouncedRefresh`, so picking a key
re-renders everything **identically**. The per-key chart (`renderKeyChart`)
also ignores filters. Detection: select a key in a browser and diff the KPI
text / `Chart.getChart('cKey')` datasets before/after — byte-identical.
**Right way:** thread the key through `getDailyData()` as a `WHERE
api_key_name = ?` and through the KPI/render paths, then test it.

### 2. Raw export transposes amount/price (DSD-GAP-014) — the classic index bug
The export handler builds rows from `SELECT *` positional indices
(`r[2]..r[7]`) instead of named columns. The schema happens to put `price`
before `amount`, so the header "amount,price" receives price,amount. Detection
is instant: exported row `input_cache_hit_tokens,3.625e-9,397074944` — a price
in the amount column (3.625e-9 is $/token; 397,074,944 is tokens; their
product = cost ✓). **Right way:** always `SELECT` explicit columns when the
column order matters for output; never rely on `SELECT *` positional mapping.

### 3. Live demo drift (DSD-GAP-015) — premature completion on the deployed surface
The repo has a deliberate NO-PUSH policy (board/audit commits stay local; only
"real code" gets pushed). The side effect: `main` here has 199 unpushed commits
and the live Pages site is a build from July — it still shows the GAP-001 bug
("daily JSON files") that the board closed on 08-05. The 12-gate audit treats
"MD5 divergence expected under NO-PUSH" as green, which *normalizes* the
divergence instead of surfacing it. **Right way:** the audit should compare the
live index.html against local HEAD and report "live stale by N commits" as an
actionable signal, and a human should authorize the pending push.

### 4. Wall-clock period filters (DSD-GAP-016)
`queryPeriod('7d')` computes `new Date() - 7` — a fixed window around *today*,
not around the data. For usage data (always in the past), "Last 7 Days" is
usually empty, and the empty state then says "drag in a DeepSeek usage ZIP",
which is wrong advice when data exists. **Right way:** anchor relative windows
to `MAX(utc_date)` of the workspace, or differentiate the empty-state message.

### 5. README vs reality on persistence (DSD-GAP-017)
README's privacy section says usage data "evaporates when you close the tab".
The code persists the DB to IndexedDB. Both privacy *intent* (nothing leaves
the browser) and the persistence *mechanism* are fine — the doc just lies about
evaporation. **Right way:** document "stored in your browser (IndexedDB);
Clear wipes it".

### 6. Vague upload failure (DSD-GAP-018)
`handleMultipleUpload` aggregates per-file outcomes into "Done: X succeeded,
Y failed" without per-file reasons. A ZIP with no `amount-*`/`cost-*` entries
fails indistinguishably from a corrupt ZIP. **Right way:** carry the failure
reason per file (no CSVs found / invalid archive) into the toast and history.

## Historical context (from the board)

- DSD-GAP-001..004 (2026-08-05): docs-vs-reality sweep — drop-help text, FAQ
  column names, phantom FileSaver.js dependency, SRI hash claims. Fixed in
  commit 91444c9, **unpushed** (see #3).
- DSD-GAP-005/006/008: regressions detected because fixes weren't on the live
  site; closed as "already fixed in repo" — the lesson is that board state and
  deployed state are two different things.
- DSD-GAP-009/010 (2026-08-08): ZIP pipeline integration test + AGENTS.md.
- DSD-GAP-011/012 (2026-08-09): stale README test-count stat; gitleaks
  false-positive on the `sk-a1b2...` test fixture — allowlist now covers
  `tests/` and `.coding-hermes/`.

## The Right Way (one-paragraph summary)

The app is a clean, fast, honest client-side tool. The failure modes are all
in the *edges*: positional column mapping (export), filters that aren't wired
through (key), wall-clock date semantics (periods), and the repo-vs-deployed
gap (NO-PUSH policy vs README live link). When touching it: name your SQL
columns explicitly, thread filter state through one `refreshAll()` path and
test each filter actually changes output, anchor date windows to the data, and
treat "live ≠ main" as a first-class audit signal, not an accepted constant.
