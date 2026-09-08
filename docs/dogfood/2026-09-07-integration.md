# Dogfood Integration Report — 2026-09-07 (Run 3, Evening)

**Project:** DeepSeek Usage Dashboard (`deepseek-dashboard`)
**Verdict:** ✅ SHIPPABLE (third consecutive run: 08-18, 09-01, 09-07 morning,
09-07 evening)
**Time-to-first-success:** 4.8 s (open page → ZIP dropped → KPIs rendered)
**Frictions:** 5 (see below; none blocking)

## Promise (null hypothesis)

> "A user can drag a DeepSeek Platform usage ZIP export into a browser page
> (or open the live GitHub Pages demo) and get charts, trends, KPIs, anomaly
> alerts, rate-limit gauges, a pricing calculator, PNG/CSV exports — all
> client-side, nothing leaving the browser."

## Reality

The promise holds on **every surface we exercised this run**, including five
that no prior dogfood had touched. The run focused on the untested feature
surface rather than re-proving the happy path.

## What was exercised for real (all local serve `http://127.0.0.1:8099`,
Chrome via Playwright, real drag-equivalent upload through the drop-zone
path — `handleMultipleUpload` via a dynamically-attached file input)

### Session A — untouched feature surface
| Step | Result | Evidence |
|---|---|---|
| Upload `sample-data.zip` | "Added 568 rows · 2026-06-01 → 2026-06-22"; KPIs $380.08 / 16.2B / 92.5M / 174,766 req — exact match to known-good values | `evidence-a.jsonl` S1/S2 |
| Raw-table search (GAP-033 fix re-verify) | **Works.** `v4-pro` → "(283 of 568 rows)", 283 `tbody` rows; no-match term → clean "No data" + "(0 of 568 rows)" | S3/S3b |
| Granularity weekly/monthly | KPIs render, no errors | S4 |
| Rate-limit panel, tier switch | Free → gauge 55.2%; Paid → 1.1%; Custom → `#rateCustomInputs` displays (flex). Math self-consistent: gauge = avg req/day (7,944) ÷ tier daily cap (14,400 / 720,000) | S5 |
| Anomaly detection + threshold slider | 4 alerts @ 2.0σ default; slider to 1.0σ re-runs detection live → 20 items | S6 |
| **PNG chart export** (3 charts) | Real PNG files verified by magic bytes (`89504e47`): tokens 65,731 B, spend 33,916 B, per-key 20,447 B | S7 |
| Pricing calculator | Opens, 6 model price inputs, recalcs: baseline +$1.18 (+0.1%) | S8 |
| Theme toggle + persistence | light set → survives `location.reload()` (localStorage) | S9 |
| Privacy request count | 10 external requests, hosts exactly `cdn.jsdelivr.net` + `cdnjs.cloudflare.com` (3 pinned libs + wasm mirror fetches); zero outbound data hosts | S10 |

### Session B — edge paths & real pricing workflow
| Step | Result |
|---|---|
| Hostile ZIP (garbage row, wrong-column CSV, non-CSV member) | "Added 2 rows · 2026-08-01 → 2026-08-02 (1 dropped — invalid utc_date)" — graceful, no breakage, toast explains the drop |
| New workspace + sample data | Workspace create + "Load sample data" work end-to-end (42 rows, same 4-drop accounting as prior runs) |
| **Pricing calculator, real change** | Original $1726.34 (auto-computed on open); set 2× output price → New $2147.51, diff +$421.18 (+24.4%), `diff-positive` class, per-model breakdown correct (v4-flash +$420.00, v4-pro +$1.18) |
| CSV export (aggregated) | Real download, clean header `date,model,cache_hit_tokens,cache_miss_tokens,output_tokens,requests` |
| Model filter | v4-pro → TOTAL COST $91.55 (filters correctly) |
| Period month options | Auto-populated (`month-2026-08/07/06`); June filter → $68.84 |
| Workspace Clear | Confirm-guarded; after confirm → "No data yet" empty state |

### Session C — mobile & offline (README claims never tested before)
| Step | Result |
|---|---|
| Mobile 375×812, iPhone UA | Upload works; **no horizontal overflow** (scrollW 375 = clientW); "☰ Filters" → bottom sheet opens (`.bottom-sheet-overlay.show`); rate/anomaly panels start collapsed ≤768 px; KPI grid fits viewport |
| **Offline CDN failure (GAP-055 fix)** | Both CDNs route-aborted → visible error banner: **"Failed to initialize — Libraries failed to load: JSZip (tried https://cdnjs.cloudflare.com/…, https://cdn.jsdelivr.net/…)"** — names the failed library and both hosts. Not a silent blank. Claimed fix verified live. |

### `file://` entry path (README "download/clone and open index.html")
Works: dashboard loads, upload via click-path succeeds (568 rows), **zero
console errors**. The README's no-server claim is literally true.

## Fresh-install leg (ephemeral bunker — installability proof)

- **Host deviation, recorded:** `bunker-las-03` (skill's standard) is
  **unreachable** (ssh timeout to 100.69.3.13) and was dropped from the
  bunker registry — matching pending board rows `QA-DEEPSEEK-DASHBOARD-1/2`.
  Used the verified-working local bunkerd **`karahermes-mde-7840hs-2`**
  (ONLINE, 0/20 agents) instead. Same contract: ephemeral, destroyed after.
- Agent `a9dafa8f` (TTL 2h): bare Debian forky/sid, uid 1030, git/node v22.23.2/npm
  preinstalled (agent image; a truly bare-Debian zero-bootstrap remains
  untested — noted, matches prior QA harness notes).
- **Clone from public GitHub** (`https://github.com/totalwindupflightsystems/deepseek-dashboard.git`)
  → OK, HEAD `0e79c4c` = local HEAD.
- **Documented install** `npm ci` → rc=0, **1 s**.
- **Documented smoke** `npm test` → **332/332 passed, 22 files, 6.1 s**.
- AGENTS.md command `npx html-validate index.html` → rc=0.
- `npm audit` (AGENTS.md "must stay 0") → **0 vulnerabilities**.
- `bunker destroy a9dafa8f` → done; 0 agents left behind.

## Findings → board

| ID | Priority | Finding |
|---|---|---|
| DSD-GAP-059 | P2 | Search silently caps at the 50,000-row fetch window (`TABLE_ROW_LIMIT`, `js/dashboard.js:15`); label reads "(0 of 97,312 rows)" without saying only 50k were searched. Source-found; 568-row fixture can't trigger it. |
| DSD-GAP-060 | P2 | No documented programmatic surface (`window.handleMultipleUpload`, `parseCSV`, `detectAnomalies` — stable, verified working, undocumented). |
| DSD-GAP-061 | P3 | `rawSearch` has no placeholder/label; match semantics (substring, case-insensitive) undiscoverable without source. |
| DSD-GAP-062 | P2 | Doc-drift process gap: usage SKILL.md went stale in a day (test count 90→332; GAP-032/033 open→complete). Process fix needed, not just instance fix. |

Re-verified fixed, no new tasks: GAP-033 (search), GAP-055 (offline banner),
GAP-032 (cost-KPI freeze closed on board; consistent with per-key chart being
the documented attribution path). Still known-open cosmetic: favicon 404
(DSD-GAP-057), vitest configLoader warning (DSD-GAP-058), "Load sample data"
doc note (from 09-01 run).

## Trust checks

- Data survived workspace switching, month filtering, theme reload; Clear is
  confirm-guarded; hostile input did not corrupt state (toast accounting
  correct: 2 added + 1 dropped).
- Privacy: request hosts remain exactly the two pinned CDN hosts; no new
  external hosts appeared vs the 08-18 baseline.
- Live GitHub Pages deploy is byte-identical to local HEAD (20,966 B
  index.html) — the 08-09-era "stale demo" problem has not regressed.

## What a new user needs that the docs don't say

1. That the table search only covers the fetched window (past 50k rows) —
   GAP-059.
2. That they can script uploads (`window.handleMultipleUpload(FileList)`) —
   GAP-060.
3. That the local server port is arbitrary and `file://` works too — GAP-060.

## Verdict rationale

Same evidence bar as the previous SHIPPABLE runs, extended to five surfaces
nobody had exercised: the app does what it promises everywhere we poked,
fails gracefully everywhere we attacked it, and installs+verifies from a
public clone on a bare agent. The four new findings are polish/docs/process,
not promise-breakers.
