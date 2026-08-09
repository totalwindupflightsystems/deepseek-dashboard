import { describe, it, expect, beforeEach } from 'vitest';

// Mock db.exec: returns SQL.js-style results [{ columns: [...], values: [[...], ...] }]
function makeDbResult(values, columns) {
  return values.length ? [{ values, columns: columns || [] }] : [];
}

describe('getDailyData key filter', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
  });

  it('filters token_usage rows by the selected api key', () => {
    // Canned token_usage aggregation rows for two keys on one date.
    // Columns: utc_date, model, type, total_amount, total_cost
    const allRows = [
      ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],          // keyA
      ['2026-01-01', 'deepseek-chat', 'input_tokens', 200, 0.2],          // keyA
      ['2026-01-02', 'deepseek-chat', 'output_tokens', 300, 0.9],          // keyB
    ];
    let lastSql = '';
    let lastParams = [];
    globalThis.db = {
      exec: (sql, params) => {
        lastSql = sql;
        lastParams = params || [];
        if (sql.includes('FROM token_usage')) {
          return makeDbResult(allRows);
        }
        // cost_daily merge — return empty (no csv cost data)
        return [];
      },
    };

    // 'all' → both keys' rows aggregate together
    const daysAll = getDailyData('all', 'all', 'all');
    expect(daysAll.length).toBe(2); // two distinct dates
    const totalCostAll = daysAll.reduce((s, d) => s + (d.cost_csv || d.cost_tokens), 0);
    const totalTokensAll = daysAll.reduce((s, d) => s + d.total_tokens, 0);
    // 0.5 + 0.2 + 0.9 = 1.6 cost; 100 + 200 + 300 = 600 tokens
    expect(totalCostAll).toBeCloseTo(1.6);
    expect(totalTokensAll).toBe(600);
    // Should NOT have an api_key_name filter in the SQL
    expect(lastSql).not.toContain('api_key_name = ?');
  });

  it('returns different totals when a single key is selected', () => {
    const rowsByKey = {
      keyA: [
        ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],
        ['2026-01-01', 'deepseek-chat', 'input_tokens', 200, 0.2],
      ],
      keyB: [
        ['2026-01-02', 'deepseek-chat', 'output_tokens', 300, 0.9],
      ],
    };
    let lastSql = '';
    let lastParams = [];
    globalThis.db = {
      exec: (sql, params) => {
        lastSql = sql;
        lastParams = params || [];
        if (sql.includes('FROM token_usage')) {
          // Inspect params to return only the selected key's rows.
          const keyParam = params.find(p => p === 'keyA' || p === 'keyB');
          return makeDbResult(rowsByKey[keyParam] || []);
        }
        return [];
      },
    };

    const daysKeyA = getDailyData('all', 'all', 'keyA');
    const daysKeyB = getDailyData('all', 'all', 'keyB');

    // keyA: one date, cost 0.7, tokens 300
    expect(daysKeyA.length).toBe(1);
    const costA = daysKeyA.reduce((s, d) => s + (d.cost_csv || d.cost_tokens), 0);
    const tokensA = daysKeyA.reduce((s, d) => s + d.total_tokens, 0);
    expect(costA).toBeCloseTo(0.7);
    expect(tokensA).toBe(300);

    // keyB: one date, cost 0.9, tokens 300
    expect(daysKeyB.length).toBe(1);
    const costB = daysKeyB.reduce((s, d) => s + (d.cost_csv || d.cost_tokens), 0);
    const tokensB = daysKeyB.reduce((s, d) => s + d.total_tokens, 0);
    expect(costB).toBeCloseTo(0.9);
    expect(tokensB).toBe(300);

    // KPI-relevant fields differ between key selections (proving Total Cost would change)
    expect(costA).not.toBeCloseTo(costB);

    // The token_usage query MUST carry the api_key_name filter for a key selection
    // Reset and run once more to inspect the token_usage SQL for keyA
    let tuSql = '';
    let tuParams = [];
    globalThis.db.exec = (sql, params) => {
      if (sql.includes('FROM token_usage')) {
        tuSql = sql;
        tuParams = params || [];
        return makeDbResult(rowsByKey.keyA);
      }
      return [];
    };
    getDailyData('all', 'all', 'keyA');
    expect(tuSql).toContain('api_key_name = ?');
    expect(tuParams).toContain('keyA');
  });

  it('does not apply api_key_name filter to the cost_daily merge query', () => {
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('FROM token_usage')) {
          return makeDbResult([
            ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],
          ]);
        }
        // cost_daily query — if key filter leaked here, the column doesn't exist
        // and SQL would error. Assert the SQL does NOT reference api_key_name.
        expect(sql).not.toContain('api_key_name');
        return [];
      },
    };
    // Should not throw even with a key selected (cost_daily lacks the column)
    expect(() => getDailyData('all', 'all', 'keyA')).not.toThrow();
  });
});