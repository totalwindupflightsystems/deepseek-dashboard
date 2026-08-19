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

  it('does not issue the cost_daily merge query when a key filter is active', () => {
    let costDailyIssued = false;
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('FROM token_usage')) {
          return makeDbResult([
            ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],
          ]);
        }
        if (sql.includes('FROM cost_daily')) {
          costDailyIssued = true;
        }
        return [];
      },
    };
    getDailyData('all', 'all', 'keyA');
    expect(costDailyIssued).toBe(false);
  });

  it('still issues the cost_daily merge query when key filter is "all"', () => {
    let costDailyIssued = false;
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('FROM token_usage')) {
          return makeDbResult([
            ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],
          ]);
        }
        if (sql.includes('FROM cost_daily')) {
          costDailyIssued = true;
          return makeDbResult([
            ['2026-01-01', 'deepseek-chat', 99.9],
          ]);
        }
        return [];
      },
    };
    getDailyData('all', 'all', 'all');
    expect(costDailyIssued).toBe(true);
  });

  it('cost KPI derives from token_usage price*amount when a key is selected (cost_csv does not pollute)', () => {
    // Simulate: token_usage has keyA cost 0.7, but cost_daily has a global
    // cost of 380.08 (the dogfood scenario). With a key filter, cost_daily
    // is skipped so the KPI must reflect token_usage cost, not the csv cost.
    const tuRows = [
      ['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5],
      ['2026-01-01', 'deepseek-chat', 'input_tokens', 200, 0.2],
    ];
    const cdRows = [
      ['2026-01-01', 'deepseek-chat', 380.08],
    ];
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('FROM token_usage')) return makeDbResult(tuRows);
        if (sql.includes('FROM cost_daily')) return makeDbResult(cdRows);
        return [];
      },
    };

    // key='all': cost_daily contributes → cost_csv (380.08) takes precedence
    const daysAll = getDailyData('all', 'all', 'all');
    const totalCostAll = daysAll.reduce((s, d) => s + (d.cost_csv || d.cost_tokens), 0);
    expect(totalCostAll).toBeCloseTo(380.08);

    // key='keyA': cost_daily merge is skipped → cost_csv stays 0, cost_tokens = 0.7
    const daysKey = getDailyData('all', 'all', 'keyA');
    const totalCostKey = daysKey.reduce((s, d) => s + (d.cost_csv || d.cost_tokens), 0);
    expect(totalCostKey).toBeCloseTo(0.7);
    // Verify the frozen-KPI bug is gone: cost changes when key changes
    expect(totalCostKey).not.toBeCloseTo(totalCostAll);

    // Also verify avg daily cost follows the same source
    const avgDailyKey = daysKey.length > 0 ? totalCostKey / daysKey.length : 0;
    expect(avgDailyKey).toBeCloseTo(0.7);
  });
});