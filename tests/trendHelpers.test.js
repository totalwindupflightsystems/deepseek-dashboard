import { describe, it, expect } from 'vitest';

// ── Fixture builders ──────────────────────────────
// Helpers only need date + total_tokens + cost fields (per task spec).
// We add cost_csv since growthRate checks it as a fallback.

function makeDay(date, totalTokens, cost) {
  return { date, total_tokens: totalTokens, cost_csv: cost };
}

// ── groupByWeek ────────────────────────────────────

describe('groupByWeek', () => {
  it('returns empty array for empty/null input', () => {
    expect(groupByWeek([])).toEqual([]);
    expect(groupByWeek(null)).toEqual([]);
    expect(groupByWeek(undefined)).toEqual([]);
  });

  it('sums total_tokens and cost per ISO week, sorted ascending', () => {
    // Jan 15-21, 2024: all same ISO week (Mon Jan 15 - Sun Jan 21)
    const days = [
      makeDay('2024-01-15', 100, 1.0),
      makeDay('2024-01-17', 200, 2.0),
      makeDay('2024-01-21', 300, 3.0),
    ];
    const result = groupByWeek(days);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].total_tokens).toBe(600);
    expect(result[0].cost).toBe(6.0);
  });

  it('splits days across a Sunday/Monday week boundary', () => {
    // Jan 21 (Sun, week of Jan 15) and Jan 22 (Mon, week of Jan 22)
    const days = [
      makeDay('2024-01-21', 50, 0.5),  // Sun → week starting Jan 15
      makeDay('2024-01-22', 70, 0.7),  // Mon → week starting Jan 22
    ];
    const result = groupByWeek(days);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15'); // earlier week first
    expect(result[0].total_tokens).toBe(50);
    expect(result[1].date).toBe('2024-01-22');
    expect(result[1].total_tokens).toBe(70);
  });

  it('falls back to cost_tokens when cost_csv is absent', () => {
    const days = [
      { date: '2024-01-15', total_tokens: 100, cost_tokens: 5.0 },
    ];
    const result = groupByWeek(days);
    expect(result[0].cost).toBe(5.0);
  });

  it('produces label equal to ISO week start date', () => {
    const days = [makeDay('2024-03-01', 10, 1)]; // Friday Mar 1 → week of Feb 26
    const result = groupByWeek(days);
    expect(result[0].label).toBe('2024-02-26');
  });
});

// ── rollingMean ────────────────────────────────────

describe('rollingMean', () => {
  it('returns empty array for empty input', () => {
    expect(rollingMean([], 7)).toEqual([]);
    expect(rollingMean(null, 7)).toEqual([]);
  });

  it('window=1 is identity (each value is its own mean)', () => {
    const vals = [10, 20, 30, 40, 50];
    expect(rollingMean(vals, 1)).toEqual([10, 20, 30, 40, 50]);
  });

  it('partial window at start: first point is just values[0]', () => {
    const vals = [10, 20, 30];
    const result = rollingMean(vals, 7);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(10);         // avg of [10]
    expect(result[1]).toBe(15);         // avg of [10, 20]
    expect(result[2]).toBe(20);         // avg of [10, 20, 30]
  });

  it('full window mid-series: 7-day rolling average', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = rollingMean(vals, 7);
    expect(result).toHaveLength(10);
    // Index 6 (7th element): full window of [1..7] → mean = 4
    expect(result[6]).toBe(4);
    // Index 7: window [2..8] → mean = 5
    expect(result[7]).toBe(5);
    // Index 9: window [4..10] → mean = 7
    expect(result[9]).toBe(7);
  });

  it('handles undefined/null as 0 in the average', () => {
    const vals = [10, null, 30];
    const result = rollingMean(vals, 7);
    // null → 0, counted as finite
    expect(result[0]).toBe(10);    // avg(10)
    expect(result[1]).toBe(5);     // avg(10, 0)
    expect(result[2]).toBeCloseTo(40 / 3, 5); // avg(10, 0, 30)
  });

  it('defaults to window=7 when no window argument provided', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = rollingMean(vals);
    expect(result[6]).toBe(4);  // avg(1..7)
    expect(result[7]).toBe(5);  // avg(2..8)
  });
});

// ── growthRate ─────────────────────────────────────

describe('growthRate', () => {
  it('returns empty array for empty input', () => {
    expect(growthRate([])).toEqual([]);
    expect(growthRate(null)).toEqual([]);
  });

  it('first point is null (no previous day)', () => {
    const days = [makeDay('2024-01-01', 100, 1.0)];
    const result = growthRate(days);
    expect(result).toEqual([null]);
  });

  it('computes normal percentage growth', () => {
    const days = [
      makeDay('2024-01-01', 100, 1.0),
      makeDay('2024-01-02', 150, 1.5),
      makeDay('2024-01-03', 120, 1.2),
    ];
    const result = growthRate(days);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(50.0, 5);      // (150-100)/100 * 100 = 50%
    expect(result[2]).toBeCloseTo(-20.0, 5);     // (120-150)/150 * 100 = -20%
  });

  it('returns null when yesterday is 0 (division by zero guard)', () => {
    const days = [
      makeDay('2024-01-01', 0, 0),
      makeDay('2024-01-02', 100, 1.0),
    ];
    const result = growthRate(days);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull(); // prev=0 → null
  });

  it('handles negative growth (decline)', () => {
    const days = [
      makeDay('2024-01-01', 200, 2.0),
      makeDay('2024-01-02', 100, 1.0),
    ];
    const result = growthRate(days);
    expect(result[1]).toBe(-50.0);
  });

  it('uses cost_csv when field="cost_csv"', () => {
    const days = [
      makeDay('2024-01-01', 999, 1.0),
      makeDay('2024-01-02', 999, 2.0),
    ];
    const result = growthRate(days, 'cost_csv');
    expect(result[1]).toBeCloseTo(100.0, 5); // (2-1)/1 * 100 = 100%
  });

  it('falls back to cost_tokens when cost_csv is absent', () => {
    const days = [
      { date: '2024-01-01', total_tokens: 100, cost_tokens: 1.0 },
      { date: '2024-01-02', total_tokens: 100, cost_tokens: 3.0 },
    ];
    const result = growthRate(days, 'cost_csv');
    // cost_csv absent → falls to cost_tokens: (3-1)/1 * 100 = 200
    expect(result[1]).toBeCloseTo(200.0, 5);
  });
});

// ── buildTrendDatasets ─────────────────────────────

describe('buildTrendDatasets', () => {
  function makeFullDay(date, models) {
    const byModel = {};
    for (const [m, tokens, cost] of models) {
      byModel[m] = { tokens, cost, input_cost: cost / 2, output_cost: cost / 2 };
    }
    return {
      date, label: date, cost_tokens: models.reduce((s, m) => s + m[2], 0),
      cost_csv: models.reduce((s, m) => s + m[2], 0),
      total_tokens: models.reduce((s, m) => s + m[1], 0),
      cache_hit: 0, cache_miss: 0, output: 0, prompt: 0, requests: 0, byModel,
    };
  }

  const sampleDays = [
    makeFullDay('2024-01-15', [['chat', 100, 1.0]]),
    makeFullDay('2024-01-16', [['chat', 200, 2.0]]),
    makeFullDay('2024-01-17', [['chat', 300, 3.0]]),
  ];

  it('returns empty array for trend "none"', () => {
    expect(buildTrendDatasets(sampleDays, sampleDays, 'none', 'tokens')).toEqual([]);
  });

  it('returns empty array for empty days', () => {
    expect(buildTrendDatasets([], [], 'rolling7', 'tokens')).toEqual([]);
  });

  it('rolling7 produces a single line dataset with correct length', () => {
    const result = buildTrendDatasets(sampleDays, sampleDays, 'rolling7', 'tokens');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('line');
    expect(result[0].label).toBe('7-Day Rolling Avg');
    expect(result[0].data).toHaveLength(3);
    expect(result[0].borderDash).toEqual([6, 4]);
    expect(result[0].order).toBe(1);
  });

  it('weeklySum produces a single dataset aligned to days', () => {
    const result = buildTrendDatasets(sampleDays, sampleDays, 'weeklySum', 'tokens');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Weekly Sum');
    expect(result[0].data).toHaveLength(3);
    // All 3 days fall in the same ISO week (Jan 15-21), so weekly sum = 600
    expect(result[0].data.every(v => v === 600)).toBe(true);
  });

  it('weeklyAvg produces a single dataset with per-day average', () => {
    const result = buildTrendDatasets(sampleDays, sampleDays, 'weeklyAvg', 'tokens');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Weekly Avg');
    // 3 days in same week → avg = 600/3 = 200 per day
    expect(result[0].data.every(v => v === 200)).toBe(true);
  });

  it('perModel produces one dataset per model', () => {
    const multiModelDays = [
      makeFullDay('2024-01-15', [['chat', 100, 1.0], ['reasoner', 50, 0.5]]),
      makeFullDay('2024-01-16', [['chat', 200, 2.0], ['reasoner', 100, 1.0]]),
    ];
    const result = buildTrendDatasets(multiModelDays, multiModelDays, 'perModel', 'tokens');
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('chat Trend');
    expect(result[1].label).toBe('reasoner Trend');
    expect(result[0].data).toEqual([100, 200]);
    expect(result[1].data).toEqual([50, 100]);
  });

  it('growth produces a dataset with null at first index', () => {
    const result = buildTrendDatasets(sampleDays, sampleDays, 'growth', 'tokens');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Day-over-Day Growth %');
    expect(result[0].data[0]).toBeNull();
    expect(result[0].data[1]).toBeCloseTo(100.0, 5);  // (200-100)/100*100
    expect(result[0].data[2]).toBeCloseTo(50.0, 5);   // (300-200)/200*100
  });

  it('spend chart uses cost values for rolling7', () => {
    const result = buildTrendDatasets(sampleDays, sampleDays, 'rolling7', 'spend');
    expect(result).toHaveLength(1);
    // rolling mean of [1, 2, 3] with window 7 = [1, 1.5, 2]
    expect(result[0].data[0]).toBe(1);
    expect(result[0].data[1]).toBeCloseTo(1.5, 5);
    expect(result[0].data[2]).toBeCloseTo(2, 5);
  });
});

// ── DOM smoke test: trendSelect exists and renders ──

describe('trendSelect DOM (DSD-GAP-043)', () => {
  it('trendSelect element exists in the document', () => {
    const sel = document.getElementById('trendSelect');
    expect(sel).not.toBeNull();
    expect(sel.tagName).toBe('SELECT');
  });

  it('has all 6 trend options including None default', () => {
    const sel = document.getElementById('trendSelect');
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('none');
    expect(options).toContain('rolling7');
    expect(options).toContain('weeklySum');
    expect(options).toContain('weeklyAvg');
    expect(options).toContain('perModel');
    expect(options).toContain('growth');
    expect(sel.value).toBe('none'); // default
  });
});