import { describe, it, expect } from 'vitest';

function makeDay(date, overrides = {}) {
  return {
    date,
    cost_tokens: 0,
    cost_csv: 0,
    total_tokens: 0,
    cache_hit: 0,
    cache_miss: 0,
    output: 0,
    prompt: 0,
    requests: 0,
    byModel: {},
    ...overrides,
  };
}

describe('groupDays', () => {
  it('returns same array for daily granularity', () => {
    const days = [makeDay('2024-01-15'), makeDay('2024-01-16')];
    const result = groupDays(days, 'daily');
    expect(result).toEqual(days);
  });

  it('returns input unchanged for empty array', () => {
    expect(groupDays([], 'weekly')).toEqual([]);
    expect(groupDays(null, 'weekly')).toBe(null);
  });

  it('returns input unchanged for null/undefined days', () => {
    expect(groupDays(null, 'monthly')).toBe(null);
    expect(groupDays(undefined, 'monthly')).toBe(undefined);
  });

  it('groups days by ISO week', () => {
    // Jan 15-21, 2024: all same ISO week (Mon Jan 15 - Sun Jan 21)
    const days = [
      makeDay('2024-01-15', { total_tokens: 100, requests: 10, cost_tokens: 0.5 }),
      makeDay('2024-01-16', { total_tokens: 200, requests: 20, cost_tokens: 1.0 }),
      makeDay('2024-01-17', { total_tokens: 300, requests: 30, cost_tokens: 1.5 }),
    ];
    const result = groupDays(days, 'weekly');
    expect(result).toHaveLength(1);
    expect(result[0].total_tokens).toBe(600);
    expect(result[0].requests).toBe(60);
    expect(result[0].cost_tokens).toBe(3.0);
  });

  it('preserves sort order by earliest date in group', () => {
    const days = [
      makeDay('2024-01-22', { total_tokens: 100 }), // week 2 (starts Jan 22)
      makeDay('2024-01-15', { total_tokens: 200 }), // week 1 (starts Jan 15)
    ];
    const result = groupDays(days, 'weekly');
    expect(result).toHaveLength(2);
    // Sorted by date ascending
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].date).toBe('2024-01-22');
  });

  it('groups days by month', () => {
    const days = [
      makeDay('2024-01-15', { total_tokens: 100 }),
      makeDay('2024-01-28', { total_tokens: 200 }),
      makeDay('2024-02-05', { total_tokens: 50 }),
    ];
    const result = groupDays(days, 'monthly');
    expect(result).toHaveLength(2);
    // Jan group
    expect(result[0].total_tokens).toBe(300);
    expect(result[0].label).toBe('Jan 2024');
    // Feb group
    expect(result[1].total_tokens).toBe(50);
    expect(result[1].label).toBe('Feb 2024');
  });

  it('aggregates all numeric fields correctly', () => {
    const days = [
      makeDay('2024-01-15', { cost_tokens: 1.5, cost_csv: 0.3, total_tokens: 100, cache_hit: 40, cache_miss: 30, output: 50, prompt: 70, requests: 5 }),
      makeDay('2024-01-16', { cost_tokens: 2.5, cost_csv: 0.7, total_tokens: 200, cache_hit: 80, cache_miss: 60, output: 100, prompt: 140, requests: 10 }),
    ];
    const result = groupDays(days, 'weekly');
    expect(result).toHaveLength(1);
    expect(result[0].cost_tokens).toBe(4.0);
    expect(result[0].cost_csv).toBe(1.0);
    expect(result[0].total_tokens).toBe(300);
    expect(result[0].cache_hit).toBe(120);
    expect(result[0].cache_miss).toBe(90);
    expect(result[0].output).toBe(150);
    expect(result[0].prompt).toBe(210);
    expect(result[0].requests).toBe(15);
  });

  it('aggregates byModel data correctly', () => {
    const days = [
      makeDay('2024-01-15', {
        byModel: {
          'deepseek-chat': { cost: 1.0, tokens: 100, cache_hit: 40, cache_miss: 20, output: 50, requests: 3, input_cost: 0.5, output_cost: 0.5 },
        },
      }),
      makeDay('2024-01-16', {
        byModel: {
          'deepseek-chat': { cost: 2.0, tokens: 200, cache_hit: 80, cache_miss: 40, output: 100, requests: 6, input_cost: 1.0, output_cost: 1.0 },
          'deepseek-coder': { cost: 0.5, tokens: 50, cache_hit: 0, cache_miss: 10, output: 25, requests: 1 },
        },
      }),
    ];
    const result = groupDays(days, 'weekly');
    expect(result).toHaveLength(1);
    const dm = result[0].byModel['deepseek-chat'];
    expect(dm.cost).toBe(3.0);
    expect(dm.tokens).toBe(300);
    expect(dm.cache_hit).toBe(120);
    expect(dm.requests).toBe(9);
    expect(dm.input_cost).toBe(1.5);
    expect(dm.output_cost).toBe(1.5);

    const dc = result[0].byModel['deepseek-coder'];
    expect(dc.cost).toBe(0.5);
    expect(dc.tokens).toBe(50);
  });

  it('creates weekly labels for same-month weeks', () => {
    const days = [
      makeDay('2024-01-15'), // Mon Jan 15, in Jan
    ];
    const result = groupDays(days, 'weekly');
    expect(result[0].label).toBe('Jan 15-21');
  });

  it('creates weekly labels spanning months', () => {
    // Jan 29, 2024 (Monday) through Feb 4 (Sunday)
    const days = [makeDay('2024-01-29')];
    const result = groupDays(days, 'weekly');
    expect(result[0].label).toBe('Jan 29 - Feb 4');
  });
});
