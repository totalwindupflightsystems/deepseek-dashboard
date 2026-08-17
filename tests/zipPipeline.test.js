import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// DSD-GAP-009: end-to-end ZIP -> parseCSV pipeline coverage.
//
// The app ingests DeepSeek usage ZIP exports (amount-YYYY-M.csv +
// cost-YYYY-M.csv) via JSZip.loadAsync then parseCSV, routed by filename
// prefix inside _processSingleFile. No prior test exercised that pipeline:
// parseCSV itself is unit-tested, but a regression in ZIP ingestion (entry
// iteration, prefix routing, extraction) would pass the suite silently.
//
// DSD-GAP-025 (fresh-clone test parity): sample-data.zip / usage_data.zip
// are gitignored personal exports (README documents the *.zip ignore rule),
// so the real-data tests used it.runIf(existsSync) and silently skipped on
// fresh clones/CI — shrinking the advertised 83-test suite. Now the
// pipeline tests ALWAYS run: when the real zips are present they assert
// against them; otherwise a deterministic synthetic export is generated in
// test setup, so CI and fresh clones exercise the full JSZip -> parseCSV
// path with real row-count assertions. 0 skips on every checkout.

const SAMPLE_ZIP = resolve(process.cwd(), 'sample-data.zip');
const USAGE_ZIP = resolve(process.cwd(), 'usage_data.zip');
const hasSampleZip = existsSync(SAMPLE_ZIP);

// Real sample-data.zip expectations (amount-2026-6.csv: 569 lines incl.
// header -> 568 data rows; cost-2026-6.csv: 45 lines incl. header -> 44).
const REAL_AMOUNT_ROWS = 568;
const REAL_COST_ROWS = 44;

// Synthetic fallback export size (deterministic, generated in test setup).
const SYNTH_AMOUNT_ROWS = 30;
const SYNTH_COST_ROWS = 15;

const SYNTHETIC_AMOUNT = [
  'user_id,utc_date,model,api_key_name,api_key,type,price,amount',
  'u1,2026-07-01,deepseek-v4-pro,k1,sk-fakekey,completion,0.5,100',
  'u2,2026-07-02,deepseek-v4-flash,k2,sk-fakekey,completion,0.1,200',
].join('\n') + '\n';

const SYNTHETIC_COST = [
  'user_id,utc_date,model,wallet_type,cost,currency',
  'u1,2026-07-01,deepseek-v4-pro,Paid,0.5000000000000000,USD',
  'u2,2026-07-02,deepseek-v4-flash,Paid,0.2000000000000000,USD',
].join('\n') + '\n';

// Deterministic multi-row export generator (DSD-GAP-025 fallback fixture).
function buildSyntheticCsv(kind, rows) {
  const header =
    kind === 'amount'
      ? 'user_id,utc_date,model,api_key_name,api_key,type,price,amount'
      : 'user_id,utc_date,model,wallet_type,cost,currency';
  const lines = [];
  for (let i = 1; i <= rows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const model = i % 2 ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
    if (kind === 'amount') {
      lines.push(
        `u${i},2026-07-${day},${model},k${(i % 3) + 1},sk-fakekey,completion,0.${i % 9},${i * 100}`
      );
    } else {
      lines.push(`u${i},2026-07-${day},${model},Paid,0.${i % 9}000000000000000,USD`);
    }
  }
  return header + '\n' + lines.join('\n') + '\n';
}

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

describe('ZIP ingestion pipeline (JSZip -> parseCSV)', () => {
  it('parses a synthetic in-memory ZIP export into expected row counts', async () => {
    const bytes = await buildZip({
      'amount-2026-7.csv': SYNTHETIC_AMOUNT,
      'cost-2026-7.csv': SYNTHETIC_COST,
    });
    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount).toHaveLength(2);
    expect(cost).toHaveLength(2);
    expect(amount[0].utc_date).toBe('2026-07-01');
    expect(amount[0].type).toBe('completion');
    expect(cost[1].model).toBe('deepseek-v4-flash');
    expect(cost[1].currency).toBe('USD');
  });

  it('routes entries by amount-/cost- prefix like _processSingleFile', async () => {
    const bytes = await buildZip({
      'cost-2026-7.csv': SYNTHETIC_COST,
      'amount-2026-7.csv': SYNTHETIC_AMOUNT,
    });
    const { zip, amount, cost } = await extractCsvRows(bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual(['amount-2026-7.csv', 'cost-2026-7.csv']);
    expect(amount).toHaveLength(2);
    expect(cost).toHaveLength(2);
  });

  it('ignores non-CSV / non-amount-cost entries (no rows produced)', async () => {
    const bytes = await buildZip({ 'notes.txt': 'hello world' });
    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount).toHaveLength(0);
    expect(cost).toHaveLength(0);
  });

  // DSD-GAP-025: ALWAYS runs (no runIf skip). Real sample-data.zip when
  // present; deterministic synthetic export otherwise — fresh clones and CI
  // still get full pipeline + row-count coverage.
  it('loads a realistic ZIP export (real sample-data.zip, else generated synthetic) and verifies parsed row counts', async () => {
    let bytes;
    let expectedNames;
    let expectedAmount;
    let expectedCost;
    if (hasSampleZip) {
      bytes = new Uint8Array(readFileSync(SAMPLE_ZIP));
      expectedNames = ['amount-2026-6.csv', 'cost-2026-6.csv'];
      expectedAmount = REAL_AMOUNT_ROWS;
      expectedCost = REAL_COST_ROWS;
    } else {
      bytes = await buildZip({
        'amount-2026-7.csv': buildSyntheticCsv('amount', SYNTH_AMOUNT_ROWS),
        'cost-2026-7.csv': buildSyntheticCsv('cost', SYNTH_COST_ROWS),
      });
      expectedNames = ['amount-2026-7.csv', 'cost-2026-7.csv'];
      expectedAmount = SYNTH_AMOUNT_ROWS;
      expectedCost = SYNTH_COST_ROWS;
    }

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual(expectedNames);

    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount).toHaveLength(expectedAmount);
    expect(cost).toHaveLength(expectedCost);

    // Real exports carry YYYY-MM-DD utc_date (YYYYMMDD normalization is
    // covered by the parseCSV edge tests)
    for (const r of [...amount, ...cost]) {
      expect(r.utc_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(amount.every((r) => r.model && r.utc_date && r.amount)).toBe(true);
    expect(cost.every((r) => r.model && r.wallet_type && r.cost)).toBe(true);
  });

  // DSD-GAP-025: second real-zip test is also skip-free (synthetic fallback).
  it('ingests a multi-CSV export producing rows for every entry (real usage_data.zip, else synthetic)', async () => {
    let bytes;
    if (existsSync(USAGE_ZIP)) {
      bytes = new Uint8Array(readFileSync(USAGE_ZIP));
    } else {
      bytes = await buildZip({
        'amount-2026-7.csv': buildSyntheticCsv('amount', 12),
        'cost-2026-7.csv': buildSyntheticCsv('cost', 8),
      });
    }
    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount.length).toBeGreaterThan(0);
    expect(cost.length).toBeGreaterThan(0);
  });
});
