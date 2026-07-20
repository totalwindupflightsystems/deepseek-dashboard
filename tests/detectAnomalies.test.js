import { describe, it, expect } from 'vitest';

describe('detectAnomalies', () => {
  it('returns empty for empty array', () => {
    const result = detectAnomalies([], 2.0, { cost: true, tokens: true, requests: true });
    expect(result.items).toEqual([]);
    expect(result.dates.size).toBe(0);
  });

  it('returns empty for null/undefined', () => {
    const r1 = detectAnomalies(null, 2.0, { cost: true });
    expect(r1.items).toEqual([]);
    expect(r1.dates.size).toBe(0);

    const r2 = detectAnomalies(undefined, 2.0, { cost: true });
    expect(r2.items).toEqual([]);
    expect(r2.dates.size).toBe(0);
  });

  it('detects no anomalies in normal distribution (all values same)', () => {
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-16', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-17', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
    ];
    const result = detectAnomalies(days, 2.0, { cost: true, tokens: true, requests: true });
    // std = 0 < 1e-12 → no z-scores computed
    expect(result.items).toEqual([]);
  });

  it('detects clear outlier with high z-score', () => {
    // 9 baseline values of ~100, 1 extreme outlier — z-score should exceed 2.0
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-16', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-17', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-18', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-19', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-20', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-21', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-22', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-23', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-24', total_tokens: 50000, requests: 500, cost_tokens: 500.0 }, // massive outlier
    ];
    const result = detectAnomalies(days, 2.0, { cost: true, tokens: true, requests: true });

    // The outlier should be detected — verify length > 0
    expect(result.items.length).toBeGreaterThan(0);

    // The spike is on 2024-01-24
    const outlierDates = [...result.dates];
    expect(outlierDates).toContain('2024-01-24');

    // Every item should have the expected shape
    for (const item of result.items) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('metric');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('zScore');
      expect(item.zScore).toBeGreaterThan(0);
    }
  });

  it('respects threshold sensitivity', () => {
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-16', total_tokens: 102, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-17', total_tokens: 98, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-18', total_tokens: 101, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-19', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
    ];

    // threshold 3.0: no values exceed 3 standard deviations in tight data
    const resultHigh = detectAnomalies(days, 3.0, { tokens: true });
    expect(resultHigh.items).toEqual([]);
  });

  it('only checks requested metrics', () => {
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-16', total_tokens: 10000, requests: 10, cost_tokens: 1.0 }, // token spike
    ];

    // Only check cost and requests (not tokens) — same values, so no anomaly
    const result = detectAnomalies(days, 2.0, { cost: true, requests: true, tokens: false });
    expect(result.items).toEqual([]);
  });

  it('handles std < 1e-12 guard (near-zero variance)', () => {
    const days = [
      { date: '2024-01-15', total_tokens: 100.0000000001, requests: 10, cost_tokens: 1 },
      { date: '2024-01-16', total_tokens: 100.0000000002, requests: 10, cost_tokens: 1 },
    ];
    const result = detectAnomalies(days, 2.0, { tokens: true });
    // std should be tiny — the guard prevents division by ~0
    expect(result.items).toEqual([]);
  });

  it('sorts results by date then metric', () => {
    // 5 baseline + 2 anomalous values on different dates
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 500.0 },
      { date: '2024-01-16', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-17', total_tokens: 50000, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-18', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
      { date: '2024-01-19', total_tokens: 100, requests: 10, cost_tokens: 1.0 },
    ];
    const result = detectAnomalies(days, 0.5, { cost: true, tokens: true });
    // Should be sorted by date, then metric within same date
    expect(result.items.length).toBeGreaterThan(0);
    for (let i = 1; i < result.items.length; i++) {
      const prev = result.items[i - 1];
      const curr = result.items[i];
      const cmp = prev.date.localeCompare(curr.date);
      expect(cmp).toBeLessThanOrEqual(0);
      if (cmp === 0) {
        expect(prev.metric.localeCompare(curr.metric)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('uses cost_csv when available, falls back to cost_tokens', () => {
    // 9 baseline values at cost_csv=1, 1 extreme outlier at 10000
    const days = [
      { date: '2024-01-15', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 10000.0 },
      { date: '2024-01-16', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-17', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-18', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-19', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-20', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-21', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-22', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-23', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
      { date: '2024-01-24', total_tokens: 100, requests: 10, cost_tokens: 1.0, cost_csv: 1.0 },
    ];
    const result = detectAnomalies(days, 2.0, { cost: true });
    // The cost_csv=10000 on Jan 15 should be detected as outlier
    expect(result.items.length).toBeGreaterThan(0);
    expect([...result.dates]).toContain('2024-01-15');
  });
});
