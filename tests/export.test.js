import { describe, it, expect } from 'vitest';

// DSD-GAP-014: regression test for the 'Export All Raw' amount/price swap.
//
// token_usage schema order is:
//   id, workspace_id, utc_date, model, api_key_name, type, price, amount, upload_id
// The old SELECT * mapped r[6]=price and r[7]=amount but the CSV header
// declared 'amount,price' — transposing the two columns. The fix uses an
// explicit SELECT (utc_date, model, api_key_name, type, amount, price) so
// r[4]=amount and r[5]=price. exportRowToCsv encodes that mapping.
//
// PASS criterion (board): for a token row with amount > 1 and price < 1,
// the emitted CSV puts amount under the 'amount' header and price under
// 'price' — NOT swapped.

const CSV_HEADER = 'utc_date,model,api_key_name,type,amount,price,cost';

describe('exportRowToCsv (DSD-GAP-014 amount/price swap)', () => {
  it('maps amount and price to the correct CSV columns (not transposed)', () => {
    // Explicit SELECT order: utc_date, model, api_key_name, type, amount, price
    const row = ['2026-06-01', 'deepseek-chat', 'key-1', 'input_cache_hit_tokens', 397074944, 0.000000003625];
    const line = exportRowToCsv(row);
    const cols = line.split(',');

    // Header positions: 0=utc_date, 1=model, 2=api_key_name, 3=type,
    // 4=amount, 5=price, 6=cost
    expect(Number(cols[4])).toBe(397074944);  // amount
    expect(Number(cols[5])).toBeCloseTo(0.000000003625);  // price

    // Board PASS criterion: amount > 1, price < 1
    expect(Number(cols[4])).toBeGreaterThan(1);
    expect(Number(cols[5])).toBeLessThan(1);
  });

  it('emits cost = amount * price in the correct column', () => {
    const row = ['2026-06-01', 'deepseek-chat', 'key-1', 'output_tokens', 1000, 0.5];
    const cols = exportRowToCsv(row).split(',');
    expect(Number(cols[6])).toBeCloseTo(500);  // 1000 * 0.5
  });

  it('produces a header + rows CSV where amount and price are not swapped', () => {
    const rows = [
      ['2026-06-01', 'deepseek-chat', 'key-1', 'input_cache_hit_tokens', 397074944, 0.000000003625],
      ['2026-06-01', 'deepseek-chat', 'key-1', 'output_tokens', 500000, 0.00000014],
    ];
    const csv = CSV_HEADER + '\n' + rows.map(exportRowToCsv).join('\n');
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADER);

    // Verify each data line: amount (col 4) > 1, price (col 5) < 1
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      expect(Number(cols[4])).toBeGreaterThan(1);
      expect(Number(cols[5])).toBeLessThan(1);
    }
  });
});