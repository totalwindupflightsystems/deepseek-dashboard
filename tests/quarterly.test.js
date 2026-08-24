import { describe, it, expect } from 'vitest';

// ── Fixture builders ──────────────────────────────

function makeDay(date, totalTokens, cost) {
  return {
    date,
    total_tokens: totalTokens,
    cost_csv: cost,
    cost_tokens: cost,
    cache_hit: 0,
    cache_miss: 0,
    output: 0,
    prompt: 0,
    requests: 0,
    byModel: {}
  };
}

function makeDayWithModel(date, totalTokens, cost, model, modelTokens, modelCost) {
  var d = makeDay(date, totalTokens, cost);
  d.byModel = {};
  d.byModel[model] = { tokens: modelTokens, cost: modelCost, cache_hit: 0, cache_miss: 0, output: 0, requests: 0, input_cost: modelCost * 0.6, output_cost: modelCost * 0.4 };
  return d;
}

// ── normalizeDate ──────────────────────────────────

describe('normalizeDate', () => {
  it('passes through standard YYYY-MM-DD format', () => {
    expect(normalizeDate('2025-06-15')).toBe('2025-06-15');
  });

  it('converts 8-digit YYYYMMDD format', () => {
    expect(normalizeDate('20260601')).toBe('2026-06-01');
  });

  it('handles boundary 8-digit date 20251231', () => {
    expect(normalizeDate('20251231')).toBe('2025-12-31');
  });

  it('handles boundary 8-digit date 20260101', () => {
    expect(normalizeDate('20260101')).toBe('2026-01-01');
  });

  it('returns empty string for invalid input', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate(null)).toBe('');
    expect(normalizeDate(undefined)).toBe('');
    expect(normalizeDate(12345)).toBe('');
    expect(normalizeDate('not-a-date')).toBe('');
  });

  it('trims whitespace before parsing', () => {
    expect(normalizeDate('  2025-06-15  ')).toBe('2025-06-15');
    expect(normalizeDate('  20260601  ')).toBe('2026-06-01');
  });
});

// ── quarterKey ─────────────────────────────────────

describe('quarterKey', () => {
  it('maps January dates to Q1', () => {
    expect(quarterKey('2026-01-01')).toBe('2026-Q1');
    expect(quarterKey('2026-01-15')).toBe('2026-Q1');
    expect(quarterKey('2026-03-31')).toBe('2026-Q1');
  });

  it('maps April dates to Q2', () => {
    expect(quarterKey('2025-04-01')).toBe('2025-Q2');
    expect(quarterKey('2025-06-30')).toBe('2025-Q2');
  });

  it('maps July dates to Q3', () => {
    expect(quarterKey('2025-07-01')).toBe('2025-Q3');
    expect(quarterKey('2025-09-30')).toBe('2025-Q3');
  });

  it('maps October dates to Q4', () => {
    expect(quarterKey('2025-10-01')).toBe('2025-Q4');
    expect(quarterKey('2025-12-31')).toBe('2025-Q4');
  });

  // CRITICAL: boundary dates
  it('maps Dec 31 to Q4 of ITS year (not Q1 of next year)', () => {
    expect(quarterKey('2025-12-31')).toBe('2025-Q4');
    // Not 2026-Q1
  });

  it('maps Jan 1 to Q1 of ITS year (not Q4 of previous year)', () => {
    expect(quarterKey('2026-01-01')).toBe('2026-Q1');
    // Not 2025-Q4
  });

  it('handles year boundary: Dec 31 2025 -> 2025-Q4, Jan 1 2026 -> 2026-Q1', () => {
    expect(quarterKey('2025-12-31')).toBe('2025-Q4');
    expect(quarterKey('2026-01-01')).toBe('2026-Q1');
    // These must NOT be the same quarter
    expect(quarterKey('2025-12-31')).not.toBe(quarterKey('2026-01-01'));
  });

  // 8-digit YYYYMMDD format (DeepSeek CSV exports)
  it('handles 8-digit date 20260601 -> 2026-Q2', () => {
    expect(quarterKey('20260601')).toBe('2026-Q2');
  });

  it('handles 8-digit boundary: 20251231 -> 2025-Q4', () => {
    expect(quarterKey('20251231')).toBe('2025-Q4');
  });

  it('handles 8-digit boundary: 20260101 -> 2026-Q1', () => {
    expect(quarterKey('20260101')).toBe('2026-Q1');
  });

  it('returns empty string for invalid dates', () => {
    expect(quarterKey('')).toBe('');
    expect(quarterKey(null)).toBe('');
    expect(quarterKey('invalid')).toBe('');
    expect(quarterKey('2025-13-01')).toBe(''); // month 13 invalid
    expect(quarterKey('2025-00-01')).toBe(''); // month 0 invalid
  });

  it('covers all 12 months correctly', () => {
    for (var m = 1; m <= 12; m++) {
      var mm = String(m).padStart(2, '0');
      var qk = quarterKey('2025-' + mm + '-15');
      var expectedQ = Math.floor((m - 1) / 3) + 1;
      expect(qk).toBe('2025-Q' + expectedQ);
    }
  });
});

// ── quarterLabel ───────────────────────────────────

describe('quarterLabel', () => {
  it('produces human-readable labels', () => {
    expect(quarterLabel('2025-Q1')).toBe('Q1 2025');
    expect(quarterLabel('2025-Q2')).toBe('Q2 2025');
    expect(quarterLabel('2025-Q3')).toBe('Q3 2025');
    expect(quarterLabel('2025-Q4')).toBe('Q4 2025');
    expect(quarterLabel('2026-Q1')).toBe('Q1 2026');
  });

  it('returns empty string for invalid keys', () => {
    expect(quarterLabel('')).toBe('');
    expect(quarterLabel(null)).toBe('');
    expect(quarterLabel('invalid')).toBe('');
    expect(quarterLabel('2025-Q5')).toBe(''); // Q5 doesn't exist
    expect(quarterLabel('2025-Q0')).toBe('');
  });
});

// ── aggregateByQuarter ─────────────────────────────

describe('aggregateByQuarter', () => {
  it('returns empty array for empty/null input', () => {
    expect(aggregateByQuarter([])).toEqual([]);
    expect(aggregateByQuarter(null)).toEqual([]);
    expect(aggregateByQuarter(undefined)).toEqual([]);
  });

  it('groups days into the correct quarters', () => {
    const days = [
      makeDay('2025-01-15', 100, 1.0),  // Q1
      makeDay('2025-04-15', 200, 2.0),  // Q2
      makeDay('2025-07-15', 300, 3.0),  // Q3
      makeDay('2025-10-15', 400, 4.0),  // Q4
    ];
    const r = aggregateByQuarter(days);
    expect(r).toHaveLength(4);
    expect(r[0].key).toBe('2025-Q1');
    expect(r[1].key).toBe('2025-Q2');
    expect(r[2].key).toBe('2025-Q3');
    expect(r[3].key).toBe('2025-Q4');
  });

  it('sums tokens and cost per quarter', () => {
    const days = [
      makeDay('2025-01-10', 100, 1.0),
      makeDay('2025-01-20', 200, 2.0),
      makeDay('2025-02-15', 300, 3.0),
    ];
    const r = aggregateByQuarter(days);
    expect(r).toHaveLength(1);
    expect(r[0].key).toBe('2025-Q1');
    expect(r[0].totalTokens).toBe(600);
    expect(r[0].totalCost).toBe(6.0);
  });

  it('computes daily averages', () => {
    const days = [
      makeDay('2025-01-10', 100, 1.0),
      makeDay('2025-01-20', 200, 2.0),
      makeDay('2025-01-30', 300, 3.0),
    ];
    const r = aggregateByQuarter(days);
    expect(r[0].dayCount).toBe(3);
    expect(r[0].avgDailyTokens).toBeCloseTo(200, 6);  // 600/3
    expect(r[0].avgDailyCost).toBeCloseTo(2.0, 6);     // 6.0/3
  });

  it('handles days spanning multiple quarters and years', () => {
    const days = [
      makeDay('2025-12-30', 100, 1.0),  // Q4 2025
      makeDay('2025-12-31', 100, 1.0),  // Q4 2025
      makeDay('2026-01-01', 200, 2.0),  // Q1 2026
      makeDay('2026-01-15', 200, 2.0),  // Q1 2026
    ];
    const r = aggregateByQuarter(days);
    expect(r).toHaveLength(2);
    expect(r[0].key).toBe('2025-Q4');
    expect(r[0].totalTokens).toBe(200);
    expect(r[1].key).toBe('2026-Q1');
    expect(r[1].totalTokens).toBe(400);
  });

  it('aggregates per-model shares', () => {
    const days = [
      makeDayWithModel('2025-01-15', 300, 3.0, 'deepseek-chat', 200, 2.0),
      makeDayWithModel('2025-01-20', 300, 3.0, 'deepseek-reasoner', 100, 1.0),
    ];
    const r = aggregateByQuarter(days);
    expect(r[0].byModel['deepseek-chat']).toBeDefined();
    expect(r[0].byModel['deepseek-chat'].tokens).toBe(200);
    expect(r[0].byModel['deepseek-chat'].cost).toBe(2.0);
    expect(r[0].byModel['deepseek-reasoner']).toBeDefined();
    expect(r[0].byModel['deepseek-reasoner'].tokens).toBe(100);
    expect(r[0].byModel['deepseek-reasoner'].cost).toBe(1.0);
  });

  it('handles 8-digit date strings from DeepSeek CSV exports', () => {
    const days = [
      makeDay('20260101', 100, 1.0),  // Q1 2026
      makeDay('20260331', 200, 2.0),  // Q1 2026
      makeDay('20260401', 300, 3.0),  // Q2 2026
    ];
    const r = aggregateByQuarter(days);
    expect(r).toHaveLength(2);
    expect(r[0].key).toBe('2026-Q1');
    expect(r[0].totalTokens).toBe(300);
    expect(r[1].key).toBe('2026-Q2');
    expect(r[1].totalTokens).toBe(300);
  });

  it('uses cost_csv || cost_tokens convention', () => {
    // Day with only cost_tokens (no cost_csv)
    const day = makeDay('2025-01-15', 100, 5.0);
    day.cost_csv = null;
    day.cost_tokens = 7.0;
    const r = aggregateByQuarter([day]);
    // Should use cost_csv first, fall back to cost_tokens when null
    expect(r[0].totalCost).toBe(7.0);
  });

  it('sorts quarters ascending', () => {
    const days = [
      makeDay('2025-10-15', 100, 1.0),  // Q4
      makeDay('2025-01-15', 200, 2.0),  // Q1
      makeDay('2025-07-15', 300, 3.0),  // Q3
    ];
    const r = aggregateByQuarter(days);
    expect(r[0].key).toBe('2025-Q1');
    expect(r[1].key).toBe('2025-Q3');
    expect(r[2].key).toBe('2025-Q4');
  });
});

// ── computeQoQ ──────────────────────────────────────

describe('computeQoQ', () => {
  it('returns empty array for empty input', () => {
    expect(computeQoQ([])).toEqual([]);
    expect(computeQoQ(null)).toEqual([]);
  });

  it('sets null deltas for the first quarter', () => {
    const quarters = aggregateByQuarter([makeDay('2025-01-15', 100, 1.0)]);
    const r = computeQoQ(quarters);
    expect(r[0].qoqTokenDelta).toBeNull();
    expect(r[0].qoqTokenPct).toBeNull();
    expect(r[0].qoqCostDelta).toBeNull();
    expect(r[0].qoqCostPct).toBeNull();
  });

  it('computes absolute token delta correctly', () => {
    const days = [
      makeDay('2025-01-15', 1000, 10.0),  // Q1
      makeDay('2025-04-15', 1500, 12.0),  // Q2
    ];
    const quarters = aggregateByQuarter(days);
    const r = computeQoQ(quarters);
    expect(r[1].qoqTokenDelta).toBe(1500 - 1000);  // +500
    expect(r[1].qoqCostDelta).toBeCloseTo(12.0 - 10.0, 6);  // +2.0
  });

  it('computes percentage delta correctly', () => {
    const days = [
      makeDay('2025-01-15', 1000, 10.0),  // Q1
      makeDay('2025-04-15', 1500, 12.0),  // Q2 (+50% tokens, +20% cost)
    ];
    const quarters = aggregateByQuarter(days);
    const r = computeQoQ(quarters);
    expect(r[1].qoqTokenPct).toBeCloseTo(50.0, 6);  // (1500-1000)/1000 * 100 = 50%
    expect(r[1].qoqCostPct).toBeCloseTo(20.0, 6);   // (12-10)/10 * 100 = 20%
  });

  it('handles negative deltas (quarter decreased)', () => {
    const days = [
      makeDay('2025-01-15', 1000, 10.0),  // Q1
      makeDay('2025-04-15', 500, 5.0),    // Q2 (-50%)
    ];
    const quarters = aggregateByQuarter(days);
    const r = computeQoQ(quarters);
    expect(r[1].qoqTokenDelta).toBe(-500);
    expect(r[1].qoqTokenPct).toBeCloseTo(-50.0, 6);
    expect(r[1].qoqCostDelta).toBeCloseTo(-5.0, 6);
    expect(r[1].qoqCostPct).toBeCloseTo(-50.0, 6);
  });

  it('returns null percent when previous quarter has zero tokens', () => {
    const days = [
      makeDay('2025-01-15', 0, 0.0),      // Q1: zero
      makeDay('2025-04-15', 500, 5.0),   // Q2
    ];
    const quarters = aggregateByQuarter(days);
    const r = computeQoQ(quarters);
    expect(r[1].qoqTokenDelta).toBe(500);    // absolute still computed
    expect(r[1].qoqTokenPct).toBeNull();     // pct null (div by zero guard)
    expect(r[1].qoqCostPct).toBeNull();      // cost also zero in Q1
  });

  it('handles 3+ quarters with chained QoQ', () => {
    const days = [
      makeDay('2025-01-15', 100, 1.0),   // Q1
      makeDay('2025-04-15', 200, 2.0),   // Q2: +100% tokens
      makeDay('2025-07-15', 150, 1.5),   // Q3: -25% tokens
      makeDay('2025-10-15', 300, 3.0),   // Q4: +100% tokens
    ];
    const quarters = aggregateByQuarter(days);
    const r = computeQoQ(quarters);
    expect(r).toHaveLength(4);
    expect(r[1].qoqTokenPct).toBeCloseTo(100.0, 6);  // (200-100)/100*100
    expect(r[2].qoqTokenPct).toBeCloseTo(-25.0, 6);  // (150-200)/200*100
    expect(r[3].qoqTokenPct).toBeCloseTo(100.0, 6);  // (300-150)/150*100
  });
});

// ── filterDaysByQuarter ────────────────────────────

describe('filterDaysByQuarter', () => {
  it('returns all days when qKey is "all"', () => {
    const days = [makeDay('2025-01-15', 100, 1.0), makeDay('2025-04-15', 200, 2.0)];
    expect(filterDaysByQuarter(days, 'all')).toBe(days);
  });

  it('returns all days when qKey is empty', () => {
    const days = [makeDay('2025-01-15', 100, 1.0)];
    expect(filterDaysByQuarter(days, '')).toBe(days);
  });

  it('filters to only days in the specified quarter', () => {
    const days = [
      makeDay('2025-01-15', 100, 1.0),  // Q1
      makeDay('2025-04-15', 200, 2.0),  // Q2
      makeDay('2025-07-15', 300, 3.0),  // Q3
    ];
    const filtered = filterDaysByQuarter(days, '2025-Q2');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2025-04-15');
  });

  it('returns empty array when no days match the quarter', () => {
    const days = [makeDay('2025-01-15', 100, 1.0)];  // Q1
    const filtered = filterDaysByQuarter(days, '2025-Q4');
    expect(filtered).toHaveLength(0);
  });

  it('handles 8-digit date strings correctly', () => {
    const days = [
      makeDay('20260101', 100, 1.0),  // Q1
      makeDay('20260401', 200, 2.0),  // Q2
    ];
    const filtered = filterDaysByQuarter(days, '2026-Q1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('20260101');
  });
});

// ── DOM smoke tests: quarterly controls ─────────────

describe('quarterly DOM (DSD-GAP-045)', () => {
  it('quarterSelect element exists with All Quarters option', () => {
    const sel = document.getElementById('quarterSelect');
    expect(sel).not.toBeNull();
    expect(sel.tagName).toBe('SELECT');
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('all');
    expect(sel.value).toBe('all');  // default
  });

  it('cQuarterly canvas exists for the quarterly chart', () => {
    const el = document.getElementById('cQuarterly');
    expect(el).not.toBeNull();
    expect(el.tagName).toBe('CANVAS');
  });

  it('cQDrilldown canvas exists for the drilldown chart', () => {
    const el = document.getElementById('cQDrilldown');
    expect(el).not.toBeNull();
    expect(el.tagName).toBe('CANVAS');
  });

  it('qoqPanel element exists for QoQ comparison', () => {
    const el = document.getElementById('qoqPanel');
    expect(el).not.toBeNull();
  });

  it('getSelectedQuarter returns "all" by default', () => {
    expect(getSelectedQuarter()).toBe('all');
  });

  it('getSelectedQuarter returns selected value when changed', () => {
    const sel = document.getElementById('quarterSelect');
    sel.innerHTML = '<option value="all">All Quarters</option><option value="2025-Q1">Q1 2025</option>';
    sel.value = '2025-Q1';
    expect(getSelectedQuarter()).toBe('2025-Q1');
    sel.value = 'all';  // reset
  });
});

// ── renderQoQPanel ─────────────────────────────────

describe('renderQoQPanel', () => {
  it('clears the panel for empty days', () => {
    const el = document.getElementById('qoqPanel');
    el.innerHTML = 'previous content';
    renderQoQPanel([]);
    expect(el.innerHTML).toBe('');
  });

  it('renders QoQ comparison HTML with quarter labels', () => {
    const el = document.getElementById('qoqPanel');
    const days = [
      makeDay('2025-01-15', 1000, 10.0),  // Q1
      makeDay('2025-04-15', 1500, 12.0),  // Q2
    ];
    renderQoQPanel(days);
    expect(el.innerHTML).toContain('Q1 2025');
    expect(el.innerHTML).toContain('Q2 2025');
    expect(el.innerHTML).toContain('qoq-quarter');
  });

  it('includes delta indicators for non-first quarters', () => {
    const el = document.getElementById('qoqPanel');
    const days = [
      makeDay('2025-01-15', 1000, 10.0),  // Q1
      makeDay('2025-04-15', 1500, 12.0),  // Q2 (+50% tokens)
    ];
    renderQoQPanel(days);
    expect(el.innerHTML).toContain('▲');  // up arrow
    expect(el.innerHTML).toContain('50.0%');  // 50% increase
  });

  it('shows first quarter marker for the first quarter', () => {
    const el = document.getElementById('qoqPanel');
    renderQoQPanel([makeDay('2025-01-15', 100, 1.0)]);
    expect(el.innerHTML).toContain('first quarter');
  });
});

// ── populateQuarterSelect ─────────────────────────

describe('populateQuarterSelect', () => {
  it('populates options with available quarters', () => {
    const sel = document.getElementById('quarterSelect');
    const days = [
      makeDay('2025-01-15', 100, 1.0),  // Q1
      makeDay('2025-07-15', 200, 2.0),  // Q3
    ];
    populateQuarterSelect(days);
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('all');
    expect(options).toContain('2025-Q1');
    expect(options).toContain('2025-Q3');
  });

  it('resets to "all" when current selection is no longer valid', () => {
    const sel = document.getElementById('quarterSelect');
    sel.innerHTML = '<option value="all">All</option><option value="2025-Q4">Q4 2025</option>';
    sel.value = '2025-Q4';
    const days = [makeDay('2025-01-15', 100, 1.0)];  // only Q1
    populateQuarterSelect(days);
    expect(sel.value).toBe('all');
  });

  it('preserves selection when quarter still exists', () => {
    const sel = document.getElementById('quarterSelect');
    const days = [
      makeDay('2025-01-15', 100, 1.0),  // Q1
      makeDay('2025-04-15', 200, 2.0),  // Q2
    ];
    populateQuarterSelect(days);
    sel.value = '2025-Q2';
    populateQuarterSelect(days);  // re-populate
    expect(sel.value).toBe('2025-Q2');
  });
});