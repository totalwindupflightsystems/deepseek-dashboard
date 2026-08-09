import { describe, it, expect, beforeEach } from 'vitest';

// queryPeriod lives in dashboard.js's lexical scope, exposed on window via
// tests/setup.js. getDailyData is also copied to globalThis by setup.js.
const queryPeriod = (p) => window.queryPeriod(p);
const emptyStateMessage = (hasData, period) => window.emptyStateMessage(hasData, period);

// SQL.js-style result helper (mirrors keyFilter.test.js)
function makeDbResult(values, columns) {
  return values.length ? [{ values, columns: columns || [] }] : [];
}

describe('queryPeriod — dataset-anchored relative windows', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
  });

  it('7d: end = dataset MAX(utc_date), start = 6 days earlier (7 calendar days)', () => {
    // dataset max date = 2026-06-30 → end 2026-06-30, start 2026-06-24
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('MAX(utc_date)') && sql.includes('token_usage')) {
          return makeDbResult([['2026-06-30']], ['MAX(utc_date)']);
        }
        return [];
      },
    };
    const [start, end] = queryPeriod('7d');
    expect(end).toBe('2026-06-30');
    expect(start).toBe('2026-06-24');
  });

  it('30d: end = dataset MAX(utc_date), start = 29 days earlier (30 calendar days)', () => {
    // dataset max date = 2026-06-30 → end 2026-06-30, start 2026-06-01
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('MAX(utc_date)') && sql.includes('token_usage')) {
          return makeDbResult([['2026-06-30']], ['MAX(utc_date)']);
        }
        return [];
      },
    };
    const [start, end] = queryPeriod('30d');
    expect(end).toBe('2026-06-30');
    expect(start).toBe('2026-06-01');
  });

  it('7d falls back to cost_daily MAX when token_usage is empty', () => {
    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('MAX(utc_date)') && sql.includes('token_usage')) return [];
        if (sql.includes('MAX(utc_date)') && sql.includes('cost_daily')) {
          return makeDbResult([['2026-05-15']], ['MAX(utc_date)']);
        }
        return [];
      },
    };
    const [start, end] = queryPeriod('7d');
    expect(end).toBe('2026-05-15');
    expect(start).toBe('2026-05-09');
  });

  it('7d falls back to wall-clock today when workspace has no data', () => {
    globalThis.db = { exec: () => [] };
    const [start, end] = queryPeriod('7d');
    // end must be a valid YYYY-MM-DD and start 6 days before end
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dEnd = new Date(end);
    const dStart = new Date(start);
    expect(Math.round((dEnd - dStart) / 86400000)).toBe(6);
  });

  it('all and month- branches are unchanged', () => {
    globalThis.db = { exec: () => [] };
    expect(queryPeriod('all')).toEqual(['2000-01-01', '2099-12-31']);
    expect(queryPeriod('month-2026-06')).toEqual(['2026-06-01', '2026-06-30']);
  });
});

describe('getDailyData — Last 7 Days shows the last 7 days of June', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
  });

  it('returns non-empty days for June data even when today is August', () => {
    // Canned aggregation rows within 2026-06-24..2026-06-30 (the anchored 7-day
    // window when dataset max = 2026-06-30). Columns: utc_date, model, type,
    // total_amount, total_cost.
    const juneRows = [
      ['2026-06-24', 'deepseek-chat', 'output_tokens', 100, 0.5],
      ['2026-06-25', 'deepseek-chat', 'output_tokens', 200, 1.0],
      ['2026-06-30', 'deepseek-chat', 'output_tokens', 300, 1.5],
    ];
    globalThis.db = {
      exec: (sql, params) => {
        // The MAX query is issued first by getDatasetMaxDate (contains
        // 'MAX(utc_date)' AND 'FROM token_usage'); dispatch on MAX first so it
        // does not collide with the aggregation query (which also has
        // 'FROM token_usage').
        if (sql.includes('MAX(utc_date)') && sql.includes('token_usage')) {
          return makeDbResult([['2026-06-30']], ['MAX(utc_date)']);
        }
        if (sql.includes('FROM token_usage')) {
          return makeDbResult(juneRows);
        }
        // cost_daily merge — return empty
        return [];
      },
    };

    const days = getDailyData('7d', 'all', 'all');
    // NON-EMPTY — this is the dogfood PASS criterion: Last 7 Days on June data
    // must show the last 7 days of June, not the wall-clock empty state.
    expect(days.length).toBe(3);
    const totalTokens = days.reduce((s, d) => s + d.total_tokens, 0);
    expect(totalTokens).toBe(600);
    // Dates must all fall within the anchored window 2026-06-24..2026-06-30
    for (const d of days) {
      expect(d.date >= '2026-06-24').toBe(true);
      expect(d.date <= '2026-06-30').toBe(true);
    }
  });
});

describe('emptyStateMessage — accurate empty-state messaging', () => {
  it('workspace has data + relative period selected → period-specific message', () => {
    expect(emptyStateMessage(true, '7d')).toBe(
      'No data in the selected period — try All Time or a month',
    );
    expect(emptyStateMessage(true, '30d')).toBe(
      'No data in the selected period — try All Time or a month',
    );
    expect(emptyStateMessage(true, 'month-2026-06')).toBe(
      'No data in the selected period — try All Time or a month',
    );
  });

  it('workspace has NO data → original drag-in message', () => {
    expect(emptyStateMessage(false, '7d')).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
    expect(emptyStateMessage(false, '30d')).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
  });

  it('period = all → always drag-in message (All Time matching nothing means no data at all)', () => {
    expect(emptyStateMessage(true, 'all')).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
    expect(emptyStateMessage(false, 'all')).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
  });

  it('null/undefined period → drag-in message (defensive)', () => {
    expect(emptyStateMessage(true, null)).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
    expect(emptyStateMessage(true, undefined)).toBe(
      'No data yet — drag in a DeepSeek usage ZIP',
    );
  });
});