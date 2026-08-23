import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// DSD-GAP-009: end-to-end ZIP -> parseCSV pipeline coverage.
// DSD-GAP-025: ALWAYS runs (no runIf, no existsSync) — committed fixtures.
// DSD-GAP-040/041: deterministic, format-faithful synthetic export committed
// in tests/fixtures/ so the real-format path (YYYYMMDD normalization,
// malformed-date dropping, amount-/cost- prefix routing) runs identically
// on fresh clones and CI with zero personal zips and zero skips.

// --- Committed fixture data (tests/fixtures/) ---
const FIXTURES_DIR = resolve(process.cwd(), 'tests', 'fixtures');
const AMOUNT_CSV = readFileSync(resolve(FIXTURES_DIR, 'amount-2026-06.csv'), 'utf-8');
const COST_CSV = readFileSync(resolve(FIXTURES_DIR, 'cost-2026-06.csv'), 'utf-8');

// Fixture row counts (deterministic — hardcoded).
// Each CSV has 22 data rows, including 1 malformed-date row (not-a-date)
// that _processSingleFile drops. So parseCSV returns 22, but the
// ingestion path keeps 21. The YYYYMMDD rows (20260615, 20260620) are
// normalized to YYYY-MM-DD and kept.
const FIXTURE_AMOUNT_ROWS = 22; // before drop
const FIXTURE_COST_ROWS = 22;   // before drop
const FIXTURE_AMOUNT_KEPT = 21;  // after malformed-date drop
const FIXTURE_COST_KEPT = 21;    // after malformed-date drop
const FIXTURE_DROPPED = 2;       // 1 amount + 1 cost malformed-date row

async function buildZip(entries) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({ type: 'uint8array' });
}

// Mirrors _processSingleFile's entry iteration + prefix routing (js/dashboard.js)
async function extractCsvRows(zipBytes) {
  const zip = await JSZip.loadAsync(zipBytes);
  let amount = [];
  let cost = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const text = await entry.async('text');
    if (name.startsWith('amount-')) amount = amount.concat(parseCSV(text));
    else if (name.startsWith('cost-')) cost = cost.concat(parseCSV(text));
  }
  return { zip, amount, cost };
}

// Build the fixture ZIP once for all tests in this file.
let fixtureZip;
beforeEach(async () => {
  if (!fixtureZip) {
    fixtureZip = await buildZip({
      'amount-2026-06.csv': AMOUNT_CSV,
      'cost-2026-06.csv': COST_CSV,
    });
  }
});

describe('ZIP ingestion pipeline (JSZip -> parseCSV) — committed fixtures (DSD-GAP-040/041)', () => {
  it('parses the fixture ZIP export into expected row counts', async () => {
    const { amount, cost } = await extractCsvRows(fixtureZip);
    // parseCSV returns all rows including malformed-date ones (22 each).
    // The drop happens in _processSingleFile, not parseCSV.
    expect(amount).toHaveLength(FIXTURE_AMOUNT_ROWS);
    expect(cost).toHaveLength(FIXTURE_COST_ROWS);
  });

  it('routes entries by amount-/cost- prefix like _processSingleFile', async () => {
    const { zip, amount, cost } = await extractCsvRows(fixtureZip);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual(['amount-2026-06.csv', 'cost-2026-06.csv']);
    expect(amount).toHaveLength(FIXTURE_AMOUNT_ROWS);
    expect(cost).toHaveLength(FIXTURE_COST_ROWS);
  });

  it('ignores non-CSV / non-amount-cost entries (no rows produced)', async () => {
    const bytes = await buildZip({ 'notes.txt': 'hello world' });
    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount).toHaveLength(0);
    expect(cost).toHaveLength(0);
  });

  it('YYYYMMDD rows are normalized to YYYY-MM-DD by parseCSV + _processSingleFile logic', async () => {
    const { amount, cost } = await extractCsvRows(fixtureZip);
    // The two YYYYMMDD fixture rows survive parseCSV as-is (8-digit strings).
    const amountYYYYMMDD = amount.filter((r) => /^\d{8}$/.test(r.utc_date));
    const costYYYYMMDD = cost.filter((r) => /^\d{8}$/.test(r.utc_date));
    expect(amountYYYYMMDD).toHaveLength(2);
    expect(costYYYYMMDD).toHaveLength(2);

    // Apply the same normalization _processSingleFile does.
    const norm = (d) =>
      /^\d{8}$/.test(d) ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : d;
    const normedAmount = amountYYYYMMDD.map((r) => norm(r.utc_date));
    const normedCost = costYYYYMMDD.map((r) => norm(r.utc_date));
    expect(normedAmount).toContain('2026-06-15');
    expect(normedAmount).toContain('2026-06-20');
    expect(normedCost).toContain('2026-06-15');
    expect(normedCost).toContain('2026-06-20');

    // After normalization, all surviving rows match YYYY-MM-DD.
    const allNormed = [...amount, ...cost].map((r) => norm(r.utc_date));
    for (const d of allNormed) {
      if (d !== 'not-a-date') {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('fixture includes all four amount types (input_cache_hit/miss, output, request_count)', async () => {
    const { amount } = await extractCsvRows(fixtureZip);
    const types = new Set(amount.map((r) => r.type));
    expect(types.has('input_cache_hit_tokens')).toBe(true);
    expect(types.has('input_cache_miss_tokens')).toBe(true);
    expect(types.has('output_tokens')).toBe(true);
    expect(types.has('request_count')).toBe(true);
  });

  it('request_count rows have empty price field (matching real export format)', async () => {
    const { amount } = await extractCsvRows(fixtureZip);
    const rcRows = amount.filter((r) => r.type === 'request_count');
    expect(rcRows.length).toBeGreaterThan(0);
    // Empty price means the field is empty string after parseCSV trims.
    for (const r of rcRows) {
      expect(r.price).toBe('');
    }
  });

  it('fixture includes exactly one malformed-date row per file (exercises drop path)', async () => {
    const { amount, cost } = await extractCsvRows(fixtureZip);
    const badAmount = amount.filter((r) =>
      r.utc_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.utc_date) && !/^\d{8}$/.test(r.utc_date)
    );
    const badCost = cost.filter((r) =>
      r.utc_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.utc_date) && !/^\d{8}$/.test(r.utc_date)
    );
    expect(badAmount).toHaveLength(1);
    expect(badCost).toHaveLength(1);
    expect(badAmount[0].utc_date).toBe('not-a-date');
    expect(badCost[0].utc_date).toBe('not-a-date');
  });
});

// --- Real ingestion path via handleMultipleUpload (DSD-GAP-040/041) ---
//
// Drives the fixture ZIP through the app's actual _processSingleFile path
// (window.handleMultipleUpload) with JSZip exposed and db stubbed, mirroring
// the uploadToast.test.js pattern. Asserts the malformed-date row is dropped
// and the dropped count is surfaced in the toast — no throw.
describe('ZIP ingestion through handleMultipleUpload (DSD-GAP-040/041 real path)', () => {
  const toastEl = () => document.getElementById('toast');

  function makeFile(name, bytes) {
    return new window.File([bytes], name, { type: 'application/zip' });
  }

  beforeEach(() => {
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;
    globalThis.activeWsId = 'ws-test';

    globalThis.db = {
      exec: () => [],
      run: () => {},
      prepare: () => ({ run: () => {}, free: () => {} }),
      export: () => new Uint8Array(0),
    };

    window.saveDB = async () => {};
    globalThis.saveDB = window.saveDB;
    window.refreshAll = async () => {};
    globalThis.refreshAll = window.refreshAll;

    window.toast = function (msg, warn) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'toast show' + (warn ? ' warn' : '');
    };

    toastEl().textContent = '';
    toastEl().className = 'toast';
  });

  it('fixture ZIP through handleMultipleUpload drops malformed-date rows and surfaces count in toast', async () => {
    const file = makeFile('fixture-2026-06.zip', fixtureZip);
    await window.handleMultipleUpload([file]);

    const finalText = toastEl().textContent;
    // The dropped count (1 amount + 1 cost = 2) must be surfaced.
    expect(finalText).toMatch(/2 dropped — invalid utc_date/);
  });

  it('fixture ZIP through handleMultipleUpload processes without throwing and shows a success summary', async () => {
    const file = makeFile('fixture-2026-06.zip', fixtureZip);
    await window.handleMultipleUpload([file]);

    const finalText = toastEl().textContent;
    // Success path — not a failure toast.
    expect(finalText).not.toMatch(/^Error:/);
    // Shows row count (token rows inserted — amount rows minus the header-type
    // filter in _processSingleFile, but at minimum shows "Added N rows").
    expect(finalText).toMatch(/Added \d+ rows/);
  });

  it('fixture ZIP through handleMultipleUpload does not surface dropped count when no malformed rows', async () => {
    // Build a clean ZIP (no malformed dates) from the fixture data.
    const cleanAmount = AMOUNT_CSV.split('\n')
      .filter((line) => !line.includes('not-a-date'))
      .join('\n');
    const cleanCost = COST_CSV.split('\n')
      .filter((line) => !line.includes('not-a-date'))
      .join('\n');
    const cleanZip = await buildZip({
      'amount-2026-06.csv': cleanAmount,
      'cost-2026-06.csv': cleanCost,
    });
    const file = makeFile('clean-2026-06.zip', cleanZip);
    await window.handleMultipleUpload([file]);

    const finalText = toastEl().textContent;
    expect(finalText).not.toMatch(/dropped/);
  });
});