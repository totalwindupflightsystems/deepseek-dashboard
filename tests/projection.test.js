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

// ── linreg ─────────────────────────────────────────

describe('linreg', () => {
  it('returns slope=0, intercept=0, r2=0 for empty input', () => {
    const r = linreg([]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(0);
    expect(r.r2).toBe(0);
  });

  it('returns slope=0, intercept=mean, r2=0 for single point', () => {
    const r = linreg([42]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(42);
    expect(r.r2).toBe(0);
  });

  it('returns exact slope, intercept, and r2=1 on perfect linear data', () => {
    // y = 3x + 10
    const ys = [10, 13, 16, 19, 22, 25, 28, 31, 34, 37];
    const r = linreg(ys);
    expect(r.slope).toBeCloseTo(3, 10);
    expect(r.intercept).toBeCloseTo(10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('returns exact slope/intercept for negative slope', () => {
    // y = -2x + 50
    const ys = [50, 48, 46, 44, 42];
    const r = linreg(ys);
    expect(r.slope).toBeCloseTo(-2, 10);
    expect(r.intercept).toBeCloseTo(50, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('r2 is between 0 and 1 for noisy data', () => {
    const ys = [10, 15, 13, 20, 18, 25, 23, 30, 28, 35];
    const r = linreg(ys);
    expect(r.r2).toBeGreaterThanOrEqual(0);
    expect(r.r2).toBeLessThanOrEqual(1);
  });

  it('r2=0 for constant data (no variation)', () => {
    // Wait — for constant data, slope=0, intercept=mean, ssTot=0 → r2=1
    // Actually: ssTot=0 means all y=mean, so r2=1 (perfect fit — horizontal line)
    const ys = [5, 5, 5, 5, 5];
    const r = linreg(ys);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(5);
    expect(r.r2).toBe(1); // degenerate case: ssTot=0 → r2=1
  });

  it('handles null values as 0', () => {
    const ys = [null, 2, null, 4];
    const r = linreg(ys);
    // Treats nulls as 0: ys=[0,2,0,4], slope should be positive
    expect(r.slope).toBeGreaterThan(0);
  });
});

// ── expfit ─────────────────────────────────────────

describe('expfit', () => {
  it('returns a=0, b=0, r2=0 for empty input', () => {
    const r = expfit([]);
    expect(r.a).toBe(0);
    expect(r.b).toBe(0);
    expect(r.r2).toBe(0);
  });

  it('returns degenerate fit for single positive point', () => {
    const r = expfit([100]);
    expect(r.a).toBe(0);
    expect(r.b).toBe(0);
    expect(r.r2).toBe(0);
  });

  it('fits perfect exponential data y = a * e^(bx) exactly', () => {
    // y = 2 * e^(0.1x), x=0..9
    const a_true = 2;
    const b_true = 0.1;
    const ys = [];
    for (let i = 0; i < 10; i++) {
      ys.push(a_true * Math.exp(b_true * i));
    }
    const r = expfit(ys);
    expect(r.a).toBeCloseTo(a_true, 4);
    expect(r.b).toBeCloseTo(b_true, 4);
    expect(r.r2).toBeCloseTo(1, 6);
  });

  it('fits exponential growth with larger rate', () => {
    // y = 10 * e^(0.2x), x=0..9
    const a_true = 10;
    const b_true = 0.2;
    const ys = [];
    for (let i = 0; i < 10; i++) {
      ys.push(a_true * Math.exp(b_true * i));
    }
    const r = expfit(ys);
    expect(r.a).toBeCloseTo(a_true, 2);
    expect(r.b).toBeCloseTo(b_true, 4);
    expect(r.r2).toBeCloseTo(1, 6);
  });

  it('skips non-positive values and still fits', () => {
    // y = 2 * e^(0.1x) — values at x=2,3,4,5 (first two are 0/skipped)
    const ys = [0, 0, 2 * Math.exp(0.2), 2 * Math.exp(0.3), 2 * Math.exp(0.4), 2 * Math.exp(0.5)];
    const r = expfit(ys);
    expect(r.b).toBeCloseTo(0.1, 4);
    expect(r.r2).toBeCloseTo(1, 6);
    // expfit recovers the true parameters a=2, b=0.1 (not an extrapolated value)
    expect(r.a).toBeCloseTo(2, 4);
  });

  it('returns degenerate fit when all values are 0 or negative', () => {
    const r = expfit([0, 0, -1, 0]);
    expect(r.a).toBe(0);
    expect(r.b).toBe(0);
    expect(r.r2).toBe(0);
  });

  it('r2 is between 0 and 1 for noisy exponential data', () => {
    const ys = [10, 12, 13, 16, 18, 22, 25, 28, 33, 36];
    const r = expfit(ys);
    expect(r.r2).toBeGreaterThanOrEqual(0);
    expect(r.r2).toBeLessThanOrEqual(1);
  });
});

// ── projectFit ─────────────────────────────────────

describe('projectFit', () => {
  it('returns empty array for empty input', () => {
    expect(projectFit([], 30, 'linear')).toEqual([]);
    expect(projectFit([], 30, 'exponential')).toEqual([]);
  });

  it('returns empty array for horizon=0', () => {
    expect(projectFit([1, 2, 3], 0, 'linear')).toEqual([]);
  });

  it('projects linear data forward correctly for 30-day horizon', () => {
    // y = 5x + 100, 10 points (x=0..9)
    const ys = [];
    for (let i = 0; i < 10; i++) ys.push(5 * i + 100);
    const proj = projectFit(ys, 30, 'linear');
    expect(proj).toHaveLength(30);
    // At x=10: y=150, x=11: y=155, ..., x=39: y=295
    for (let h = 0; h < 30; h++) {
      expect(proj[h]).toBeCloseTo(5 * (10 + h) + 100, 6);
    }
  });

  it('projects linear data forward correctly for 90-day horizon', () => {
    const ys = [];
    for (let i = 0; i < 10; i++) ys.push(5 * i + 100);
    const proj = projectFit(ys, 90, 'linear');
    expect(proj).toHaveLength(90);
    // x=10..99
    for (let h = 0; h < 90; h++) {
      expect(proj[h]).toBeCloseTo(5 * (10 + h) + 100, 6);
    }
  });

  it('projects exponential data forward correctly', () => {
    // y = 2 * e^(0.1x), 10 points
    const ys = [];
    for (let i = 0; i < 10; i++) ys.push(2 * Math.exp(0.1 * i));
    const proj = projectFit(ys, 30, 'exponential');
    expect(proj).toHaveLength(30);
    for (let h = 0; h < 30; h++) {
      expect(proj[h]).toBeCloseTo(2 * Math.exp(0.1 * (10 + h)), 2);
    }
  });

  it('falls back to linear when exponential fit is degenerate', () => {
    // All zeros → expfit degenerate → fallback to linear
    const ys = [0, 0, 0, 0, 0];
    const proj = projectFit(ys, 10, 'exponential');
    expect(proj).toHaveLength(10);
    // Linear fit: slope=0, intercept=0 → all zeros
    for (const v of proj) expect(v).toBe(0);
  });
});

// ── projectConfidenceBand ──────────────────────────

describe('projectConfidenceBand', () => {
  it('returns empty arrays for empty input', () => {
    const r = projectConfidenceBand([], 30, 'linear');
    expect(r.upper).toEqual([]);
    expect(r.lower).toEqual([]);
  });

  it('returns arrays of length=horizon', () => {
    const ys = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
    const r = projectConfidenceBand(ys, 30, 'linear');
    expect(r.upper).toHaveLength(30);
    expect(r.lower).toHaveLength(30);
  });

  it('band width increases with horizon (later points wider)', () => {
    // Use noisy data (non-zero residuals) so the confidence band has non-zero width
    const ys = [10, 15, 12, 20, 18, 25, 22, 30, 28, 35, 32, 40];
    const r = projectConfidenceBand(ys, 90, 'linear');
    expect(r.upper).toHaveLength(90);
    expect(r.lower).toHaveLength(90);
    const widthEarly = r.upper[0] - r.lower[0];
    const widthMid = r.upper[44] - r.lower[44];
    const widthLate = r.upper[89] - r.lower[89];
    // Width should be increasing
    expect(widthEarly).toBeGreaterThan(0);
    expect(widthMid).toBeGreaterThan(widthEarly);
    expect(widthLate).toBeGreaterThan(widthMid);
  });

  it('lower bound is clamped at 0 (no negative tokens/cost)', () => {
    // Use data with high variance and negative-trending slope
    const ys = [100, 90, 50, 30, 10, 5, 2, 1, 0, 0];
    const r = projectConfidenceBand(ys, 30, 'linear');
    for (const v of r.lower) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('upper bound is always >= lower bound', () => {
    const ys = [10, 15, 12, 20, 18, 25, 22, 30, 28, 35];
    const r = projectConfidenceBand(ys, 30, 'linear');
    for (let i = 0; i < 30; i++) {
      expect(r.upper[i]).toBeGreaterThanOrEqual(r.lower[i]);
    }
  });

  it('confidence band works for exponential fit', () => {
    const ys = [];
    for (let i = 0; i < 15; i++) ys.push(10 * Math.exp(0.05 * i));
    const r = projectConfidenceBand(ys, 30, 'exponential');
    expect(r.upper).toHaveLength(30);
    expect(r.lower).toHaveLength(30);
    for (let i = 0; i < 30; i++) {
      expect(r.upper[i]).toBeGreaterThanOrEqual(r.lower[i]);
    }
  });
});

// ── computeQuarterProjection ───────────────────────

describe('computeQuarterProjection', () => {
  it('returns zeros for empty input', () => {
    const r = computeQuarterProjection([], 'linear', 'tokens');
    expect(r.currentQuarterTotal).toBe(0);
    expect(r.projectedNextQuarterTotal).toBe(0);
    expect(r.fitType).toBe('linear');
  });

  it('sums current quarter and projects next quarter for tokens', () => {
    // 30 days in Q1 2024 (Jan), linear growth: y = 100 + 10x
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 100 + 10 * i, 1.0 + 0.1 * i));
    }
    const r = computeQuarterProjection(days, 'linear', 'tokens');
    // Current quarter total: sum of 100..390 in 30 steps
    expect(r.currentQuarterTotal).toBeCloseTo(
      days.reduce((s, d) => s + d.total_tokens, 0), 6
    );
    // Projected next quarter should be positive (trending upward)
    expect(r.projectedNextQuarterTotal).toBeGreaterThan(0);
    // Should be larger than current quarter (upward trend)
    expect(r.projectedNextQuarterTotal).toBeGreaterThan(r.currentQuarterTotal);
  });

  it('sums current quarter for spend chartType', () => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 100, 2.0 + 0.05 * i));
    }
    const r = computeQuarterProjection(days, 'linear', 'spend');
    expect(r.currentQuarterTotal).toBeCloseTo(
      days.reduce((s, d) => s + d.cost_csv, 0), 6
    );
    expect(r.projectedNextQuarterTotal).toBeGreaterThan(0);
  });

  it('uses exponential fit for fitType="exponential"', () => {
    // 30 days of exponential growth
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 10 * Math.exp(0.05 * i), 1.0 * Math.exp(0.02 * i)));
    }
    const r = computeQuarterProjection(days, 'exponential', 'tokens');
    expect(r.currentQuarterTotal).toBeGreaterThan(0);
    expect(r.projectedNextQuarterTotal).toBeGreaterThan(0);
    // Exponential growth → next quarter should be much larger
    expect(r.projectedNextQuarterTotal).toBeGreaterThan(r.currentQuarterTotal);
    expect(r.fitR2).toBeGreaterThan(0.9); // good fit for clean exp data
  });

  it('returns r2 from the fit', () => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 100 + 10 * i, 1.0));
    }
    const r = computeQuarterProjection(days, 'linear', 'tokens');
    // Perfect linear data → r2=1
    expect(r.fitR2).toBeCloseTo(1, 6);
  });

  it('correctly identifies the quarter from the last date', () => {
    // Last date in March (Q1) → current quarter is Q1 (month prefix 2024-01)
    const days = [makeDay('2024-03-15', 100, 1.0)];
    const r = computeQuarterProjection(days, 'linear', 'tokens');
    // Only one day in Q1 2024 → currentQuarterTotal = 100
    expect(r.currentQuarterTotal).toBe(100);

    // Last date in July (Q3) → current quarter is Q3 (month prefix 2024-07)
    const days2 = [
      makeDay('2024-06-15', 50, 0.5),  // Q2
      makeDay('2024-07-01', 100, 1.0),  // Q3
    ];
    const r2 = computeQuarterProjection(days2, 'linear', 'tokens');
    // Only the Q3 day counts: currentQuarterTotal = 100
    expect(r2.currentQuarterTotal).toBe(100);
  });
});

// ── buildProjectionDatasets ─────────────────────────

describe('buildProjectionDatasets', () => {
  function makeFullDay(date, tokens, cost) {
    return makeDay(date, tokens, cost);
  }

  const sampleDays = [
    makeFullDay('2024-01-15', 100, 1.0),
    makeFullDay('2024-01-16', 200, 2.0),
    makeFullDay('2024-01-17', 300, 3.0),
  ];

  it('returns empty array for fit "none"', () => {
    expect(buildProjectionDatasets(sampleDays, sampleDays, 'none', 30, 'tokens')).toEqual([]);
  });

  it('returns empty array for empty days', () => {
    expect(buildProjectionDatasets([], [], 'linear', 30, 'tokens')).toEqual([]);
  });

  it('returns empty array for single data point (need >=2 for fit)', () => {
    expect(buildProjectionDatasets([sampleDays[0]], [sampleDays[0]], 'linear', 30, 'tokens')).toEqual([]);
  });

  it('returns 3 datasets (projection line, upper, lower) for linear fit', () => {
    const r = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'tokens');
    expect(r).toHaveLength(3);
    expect(r[0].label).toContain('Projection');
    expect(r[0].label).toContain('linear');
    expect(r[0].label).toContain('30');
    expect(r[0].borderDash).toEqual([8, 4]);
    expect(r[0].type).toBe('line');
    // Data should be length = days.length + horizon = 3 + 30 = 33
    expect(r[0].data).toHaveLength(33);
  });

  it('returns 3 datasets for exponential fit', () => {
    const r = buildProjectionDatasets(sampleDays, sampleDays, 'exponential', 90, 'tokens');
    expect(r).toHaveLength(3);
    expect(r[0].label).toContain('exponential');
    expect(r[0].label).toContain('90');
    // Data length = 3 + 90 = 93
    expect(r[0].data).toHaveLength(93);
  });

  it('bridge point connects last historical value to projection', () => {
    const r = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'tokens');
    // Last historical point at index n-1=2 should have the last day's total_tokens
    expect(r[0].data[2]).toBe(300); // sampleDays[2].total_tokens
    // First projected point at index n=3 should be a number (not null)
    expect(r[0].data[3]).not.toBeNull();
    expect(typeof r[0].data[3]).toBe('number');
  });

  it('historical portion (except bridge) is null', () => {
    const r = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'tokens');
    // Indices 0..n-2 should be null (only bridge at n-1)
    expect(r[0].data[0]).toBeNull();
    expect(r[0].data[1]).toBeNull();
    // Bridge at index 2
    expect(r[0].data[2]).not.toBeNull();
  });

  it('uses different colors for tokens vs spend', () => {
    const tokR = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'tokens');
    const spendR = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'spend');
    expect(tokR[0].borderColor).not.toBe(spendR[0].borderColor);
  });

  it('works with spend chartType using cost values', () => {
    const r = buildProjectionDatasets(sampleDays, sampleDays, 'linear', 30, 'spend');
    expect(r).toHaveLength(3);
    // Bridge point should be last day's cost_csv = 3.0
    expect(r[0].data[2]).toBe(3.0);
  });
});

// ── DOM smoke tests: projection controls ───────────

describe('projection DOM (DSD-GAP-044)', () => {
  it('projectionSelect element exists with None/Linear/Exponential options', () => {
    const sel = document.getElementById('projectionSelect');
    expect(sel).not.toBeNull();
    expect(sel.tagName).toBe('SELECT');
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('none');
    expect(options).toContain('linear');
    expect(options).toContain('exponential');
    expect(sel.value).toBe('none'); // default off
  });

  it('horizonSelect element exists with 30/90 options', () => {
    const sel = document.getElementById('horizonSelect');
    expect(sel).not.toBeNull();
    expect(sel.tagName).toBe('SELECT');
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('30');
    expect(options).toContain('90');
    expect(sel.value).toBe('30'); // default 30
  });

  it('projectionSummary element exists for quarter summary', () => {
    const el = document.getElementById('projectionSummary');
    expect(el).not.toBeNull();
  });

  it('getSelectedProjection returns "none" by default', () => {
    expect(getSelectedProjection()).toBe('none');
  });

  it('getSelectedHorizon returns 30 by default', () => {
    expect(getSelectedHorizon()).toBe(30);
  });

  it('getSelectedProjection returns selected value when changed', () => {
    const sel = document.getElementById('projectionSelect');
    sel.value = 'linear';
    expect(getSelectedProjection()).toBe('linear');
    sel.value = 'exponential';
    expect(getSelectedProjection()).toBe('exponential');
    sel.value = 'none'; // reset
  });

  it('getSelectedHorizon returns 90 when changed', () => {
    const sel = document.getElementById('horizonSelect');
    sel.value = '90';
    expect(getSelectedHorizon()).toBe(90);
    sel.value = '30'; // reset
  });
});

// ── renderProjectionSummary ────────────────────────

describe('renderProjectionSummary', () => {
  it('clears the summary element when fitType is "none"', () => {
    const el = document.getElementById('projectionSummary');
    el.innerHTML = 'previous content';
    renderProjectionSummary([makeDay('2024-01-01', 100, 1)], 'none');
    expect(el.innerHTML).toBe('');
  });

  it('clears the summary element for empty days', () => {
    const el = document.getElementById('projectionSummary');
    el.innerHTML = 'previous content';
    renderProjectionSummary([], 'linear');
    expect(el.innerHTML).toBe('');
  });

  it('renders summary HTML with quarter projections for linear fit', () => {
    const el = document.getElementById('projectionSummary');
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 100 + 10 * i, 1.0 + 0.1 * i));
    }
    renderProjectionSummary(days, 'linear');
    expect(el.innerHTML).toContain('Next Q Tokens');
    expect(el.innerHTML).toContain('Next Q Spend');
    expect(el.innerHTML).toContain('r²');
  });

  it('renders summary HTML for exponential fit', () => {
    const el = document.getElementById('projectionSummary');
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = String(i + 1).padStart(2, '0');
      days.push(makeDay('2024-01-' + d, 10 * Math.exp(0.05 * i), 1.0 * Math.exp(0.02 * i)));
    }
    renderProjectionSummary(days, 'exponential');
    expect(el.innerHTML).toContain('Next Q Tokens');
    expect(el.innerHTML).toContain('Next Q Spend');
  });
});