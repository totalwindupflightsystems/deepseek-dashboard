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

## Run 2 (2026-08-18) — what changed, and the new failure modes

Run 2 was a full regression re-check + new probes (see
`2026-08-18-integration.md`). All run-1 findings are fixed and verified on the
**live deployed site** (now byte-identical to local HEAD after the GAP-027
reconciliation push). The engineering lessons below are the ones that are new
or that run 1 got wrong.

### 7. Cost attribution has two sources, and they must not visually conflict (DSD-GAP-032)
The dashboard has **two cost numbers that are both correct but sourced
differently**:
- `TOTAL COST` KPI / `AVG DAILY COST` ← `cost_daily` (billed per-model daily
  cost from `cost-*.csv`; **no api_key column** — DeepSeek doesn't export cost
  per key).
- Per-key chart (`cKey`) and spend chart ← `token_usage` `price*amount`
  (computed attribution). Unfiltered, both totals agree to the cent ($380.08).
When the key filter is active, the token/request paths filter but the
`cost_daily`-backed KPI cannot — it stays at the full billed total. A user sees
"$380.08 total cost" next to "3,270 requests" and the per-key chart showing one
key. **Right way:** when `keyFilter != all`, switch the cost KPI to the
computed key-attributed value (it exists and matches in aggregate), or label
the card "billed cost — not split by key". Never let two adjacent numbers that
claim to be the same metric disagree.

### 8. Security hardening created a silent data-integrity hole (DSD-GAP-035)
The GAP-030 fix added parse-time date validation (drop rows whose `utc_date`
isn't `YYYY-MM-DD` after `YYYYMMDD` normalization, dashboard.js:432-441) —
good for XSS, but the drop is **silent**: the toast reports only kept rows
("Added 4 rows" from a 6-row ZIP). Defense-in-depth is verified working
(`window.__xss` never fires; `escapeHtml` also guards the render path), but
users with a date-format quirk lose rows unknowingly. **Right way:** count
dropped rows per file and surface them ("4 added, 2 dropped: invalid
utc_date"). Silent drops and security are not in tension; silent *anything* is
the enemy.

### 9. Upload cost is super-linear; sql.js row-at-a-time inserts + full-DB persist (DSD-GAP-034)
Measured: 612 rows → 228 ms; 14,240 rows → 31 s. The insert loop uses one
prepared statement per row (fine) but there is no transaction batching, and
`saveDB()` serializes the **entire** DB to IndexedDB after the batch; then
`refreshAll()` re-aggregates and re-renders everything. The drop zone is stuck
on "Processing..." the whole time with no progress. The README's own known
limitation ("6+ months of heavy usage") is exactly where this bites. **Right
way:** wrap inserts in `db.run('BEGIN')/COMMIT`, persist incrementally or
debounce, and give the drop zone a progress state for large uploads.

### 10. "Searchable table" is a doc ghost (DSD-GAP-033)
README feature table says the raw data table is "Searchable, filterable".
Zero occurrences of "search" in `index.html`/`js/dashboard.js`. The table is
filterable via period/model/key selects and virtual-scrolls 14k rows fine, but
there is no search box. Docs-vs-reality again — the same failure class as
run 1's GAP-002/003/011/021/023/026 (stale claims in prose). **Right way:**
grep the README feature table against the code before claiming features, or
add the search (the virtual-scroll pool is already in memory — a filter input
over it is ~20 lines).

### 11. What run 1 got wrong (corrections)
- **Key filter**: run 1 called it fully dead; it's now fixed for
  tokens/charts but still freezes cost KPIs (see #7) — the fix was
  partial, and its own pass criterion ("Total Cost changes") is unmet.
- **Confirm dialogs**: Clear/Delete use `window.confirm`. Automated drivers
  that don't accept dialogs will conclude these buttons are broken. They
  aren't. Always register a dialog handler in the harness.
- **Live demo**: run 1's "stale live build" (GAP-015/027) was resolved by the
  2026-08-16 reconciliation push; the live site now matches local HEAD and
  must be re-checked by MD5 comparison, not assumed stale.

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
