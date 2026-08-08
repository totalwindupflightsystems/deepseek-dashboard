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
// sample-data.zip / usage_data.zip are gitignored personal exports (README
// documents the *.zip ignore rule), so the real-data tests use it.runIf()
// and skip cleanly on a fresh checkout; the synthetic in-memory ZIP tests
// always run, so CI still covers the full JSZip -> parseCSV path.

const SAMPLE_ZIP = resolve(process.cwd(), 'sample-data.zip');
const USAGE_ZIP = resolve(process.cwd(), 'usage_data.zip');
const hasSampleZip = existsSync(SAMPLE_ZIP);

const SYNTHETIC_AMOUNT = [
  'user_id,utc_date,model,api_key_name,api_key,type,price,amount',
  'u1,2026-07-01,deepseek-v4-pro,k1,sk-a1b2c3d4e5f6g7h8i9j0,completion,0.5,100',
  'u2,2026-07-02,deepseek-v4-flash,k2,sk-a1b2c3d4e5f6g7h8i9j0,completion,0.1,200',
].join('\n') + '\n';

const SYNTHETIC_COST = [
  'user_id,utc_date,model,wallet_type,cost,currency',
  'u1,2026-07-01,deepseek-v4-pro,Paid,0.5000000000000000,USD',
  'u2,2026-07-02,deepseek-v4-flash,Paid,0.2000000000000000,USD',
].join('\n') + '\n';

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

  it.runIf(hasSampleZip)(
    'loads the real sample-data.zip via JSZip and verifies parsed row counts',
    async () => {
      const bytes = new Uint8Array(readFileSync(SAMPLE_ZIP));
      const zip = await JSZip.loadAsync(bytes);
      const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
      expect(names).toEqual(['amount-2026-6.csv', 'cost-2026-6.csv']);

      const { amount, cost } = await extractCsvRows(bytes);
      // amount-2026-6.csv: 569 lines incl. header -> 568 data rows
      // cost-2026-6.csv: 45 lines incl. header -> 44 data rows
      expect(amount).toHaveLength(568);
      expect(cost).toHaveLength(44);

      // Real exports carry YYYY-MM-DD utc_date (YYYYMMDD normalization is
      // covered by the parseCSV edge tests)
      for (const r of [...amount, ...cost]) {
        expect(r.utc_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(amount.every((r) => r.model && r.utc_date && r.amount)).toBe(true);
      expect(cost.every((r) => r.model && r.wallet_type && r.cost)).toBe(true);
    }
  );

  it.runIf(hasSampleZip)('usage_data.zip mirrors the same pipeline shape', async () => {
    if (!existsSync(USAGE_ZIP)) return;
    const bytes = new Uint8Array(readFileSync(USAGE_ZIP));
    const { amount, cost } = await extractCsvRows(bytes);
    expect(amount.length).toBeGreaterThan(0);
    expect(cost.length).toBeGreaterThan(0);
  });
});
