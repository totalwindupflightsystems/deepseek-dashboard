import { describe, it, expect } from 'vitest';

// ── DSD-GAP-047: Implicit-Insights Gallery ──
// Covers: tokenVsCostShareDivergence (delta sign/change), weekdayShape
// (normalization to 100), cpmDrift (per-million math), cacheHitRatio
// (0-100, hit/miss math), projectionCrossings (crossing detected at expected
// date, no false crossing when lines never cross).

// ── Fixture builders ──────────────────────────────

function makeDay(date, opts) {
  return {
    date,
    label: date,
    total_tokens: 0,
    cost_tokens: 0,
    cost_csv: 0,
    cache_hit: 0,
    cache_miss: 0,
    output: 0,
    prompt: 0,
    requests: 0,
    byModel: {},
    ...opts,
  };
}

function makeSeries(name, days) {
  return { id: 'ws-' + name.toLowerCase(), name, days };
}

// ── tokenVsCostShareDivergence ───────────────────

describe('tokenVsCostShareDivergence', () => {
  it('returns empty for empty days and no series', () => {
    expect(tokenVsCostShareDivergence([], null)).toEqual({ labels: [], rows: [] });
    expect(tokenVsCostShareDivergence(null, null)).toEqual({ labels: [], rows: [] });
  });

  it('returns 100/100 with zero delta for a single workspace (no overlay)', () => {
    const days = [
      makeDay('2026-01-01', { total_tokens: 100, cost_csv: 1.0 }),
      makeDay('2026-01-02', { total_tokens: 200, cost_csv: 2.0 }),
    ];
    const result = tokenVsCostShareDivergence(days, null);
    expect(result.labels).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tokenShare).toEqual([100, 100]);
    expect(result.rows[0].costShare).toEqual([100, 100]);
    expect(result.rows[0].delta).toEqual([0, 0]);
  });

  it('computes correct shares and delta for two workspaces', () => {
    // WS Alpha: 100 tokens, $1 on day 1; 100 tokens, $1 on day 2
    // WS Beta:  100 tokens, $3 on day 1; 300 tokens, $3 on day 2
    // Day 1: Alpha tokenShare=50, costShare=25, delta=-25
    //        Beta  tokenShare=50, costShare=75, delta=+25
    // Day 2: Alpha tokenShare=25, costShare=25, delta=0
    //        Beta  tokenShare=75, costShare=75, delta=0
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { total_tokens: 100, cost_csv: 1.0 }),
        makeDay('2026-01-02', { total_tokens: 100, cost_csv: 1.0 }),
      ]),
      makeSeries('Beta', [
        makeDay('2026-01-01', { total_tokens: 100, cost_csv: 3.0 }),
        makeDay('2026-01-02', { total_tokens: 300, cost_csv: 3.0 }),
      ]),
    ];
    const result = tokenVsCostShareDivergence(series[0].days, series);
    expect(result.labels).toHaveLength(2);
    expect(result.rows).toHaveLength(2);

    // Alpha
    expect(result.rows[0].wsName).toBe('Alpha');
    expect(result.rows[0].tokenShare[0]).toBeCloseTo(50, 1);
    expect(result.rows[0].costShare[0]).toBeCloseTo(25, 1);
    expect(result.rows[0].delta[0]).toBeCloseTo(-25, 1);
    expect(result.rows[0].tokenShare[1]).toBeCloseTo(25, 1);
    expect(result.rows[0].costShare[1]).toBeCloseTo(25, 1);
    expect(result.rows[0].delta[1]).toBeCloseTo(0, 1);

    // Beta
    expect(result.rows[1].wsName).toBe('Beta');
    expect(result.rows[1].tokenShare[0]).toBeCloseTo(50, 1);
    expect(result.rows[1].costShare[0]).toBeCloseTo(75, 1);
    expect(result.rows[1].delta[0]).toBeCloseTo(25, 1);
    expect(result.rows[1].tokenShare[1]).toBeCloseTo(75, 1);
    expect(result.rows[1].costShare[1]).toBeCloseTo(75, 1);
    expect(result.rows[1].delta[1]).toBeCloseTo(0, 1);
  });

  it('delta sign: positive when costShare > tokenShare (getting more expensive)', () => {
    const series = [
      makeSeries('Cheap', [
        makeDay('2026-01-01', { total_tokens: 100, cost_csv: 0.5 }),
      ]),
      makeSeries('Pricey', [
        makeDay('2026-01-01', { total_tokens: 100, cost_csv: 4.5 }),
      ]),
    ];
    const result = tokenVsCostShareDivergence(series[0].days, series);
    // Pricey: tokenShare=50, costShare=90, delta=+40
    const pricey = result.rows.find(r => r.wsName === 'Pricey');
    expect(pricey.delta[0]).toBeGreaterThan(0);
    expect(pricey.delta[0]).toBeCloseTo(40, 1);
    // Cheap: delta=-40
    const cheap = result.rows.find(r => r.wsName === 'Cheap');
    expect(cheap.delta[0]).toBeLessThan(0);
    expect(cheap.delta[0]).toBeCloseTo(-40, 1);
  });

  it('handles zero total tokens/cost gracefully (no division by zero)', () => {
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { total_tokens: 0, cost_csv: 0 }),
      ]),
      makeSeries('Beta', [
        makeDay('2026-01-01', { total_tokens: 0, cost_csv: 0 }),
      ]),
    ];
    const result = tokenVsCostShareDivergence(series[0].days, series);
    expect(result.rows[0].tokenShare[0]).toBe(0);
    expect(result.rows[0].costShare[0]).toBe(0);
    expect(result.rows[0].delta[0]).toBe(0);
  });
});

// ── weekdayShape ─────────────────────────────────

describe('weekdayShape', () => {
  it('returns 7 labels (Sun..Sat) even with no data', () => {
    const result = weekdayShape([], null);
    expect(result.labels).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(result.rows).toEqual([]);
  });

  it('normalizes the peak weekday to 100 for a single workspace', () => {
    // 2026-01-05 is Monday, 2026-01-06 is Tuesday, 2026-01-07 is Wednesday
    // Monday: 100 tokens, Tuesday: 50 tokens, Wednesday: 200 tokens
    // Peak = Wednesday (200), so Mon=50, Tue=25, Wed=100
    const days = [
      makeDay('2026-01-05', { total_tokens: 100 }), // Mon
      makeDay('2026-01-06', { total_tokens: 50 }),  // Tue
      makeDay('2026-01-07', { total_tokens: 200 }), // Wed
    ];
    const result = weekdayShape(days, null);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data).toHaveLength(7);
    // Sunday (index 0) = 0 (no data)
    expect(result.rows[0].data[0]).toBe(0);
    // Monday (index 1) = 50
    expect(result.rows[0].data[1]).toBeCloseTo(50, 1);
    // Tuesday (index 2) = 25
    expect(result.rows[0].data[2]).toBeCloseTo(25, 1);
    // Wednesday (index 3) = 100 (peak)
    expect(result.rows[0].data[3]).toBeCloseTo(100, 1);
  });

  it('averages multiple data points on the same weekday before normalizing', () => {
    // Two Mondays: 100 + 200 = avg 150; One Tuesday: 300
    // Peak = Tuesday (300), Mon = 50, Tue = 100
    const days = [
      makeDay('2026-01-05', { total_tokens: 100 }), // Mon
      makeDay('2026-01-12', { total_tokens: 200 }), // Mon
      makeDay('2026-01-06', { total_tokens: 300 }), // Tue
    ];
    const result = weekdayShape(days, null);
    // Monday avg = 150, Tuesday = 300 → Monday = 50, Tuesday = 100
    expect(result.rows[0].data[1]).toBeCloseTo(50, 1);
    expect(result.rows[0].data[2]).toBeCloseTo(100, 1);
  });

  it('normalizes each workspace independently when overlay series is provided', () => {
    // Alpha: Mon=100, Tue=200 → Mon=50, Tue=100
    // Beta:  Mon=10,  Tue=20  → Mon=50, Tue=100
    // Both should have the same shape despite different absolute values
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-05', { total_tokens: 100 }), // Mon
        makeDay('2026-01-06', { total_tokens: 200 }), // Tue
      ]),
      makeSeries('Beta', [
        makeDay('2026-01-05', { total_tokens: 10 }),  // Mon
        makeDay('2026-01-06', { total_tokens: 20 }),  // Tue
      ]),
    ];
    const result = weekdayShape(series[0].days, series);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data[1]).toBeCloseTo(50, 1);
    expect(result.rows[0].data[2]).toBeCloseTo(100, 1);
    expect(result.rows[1].data[1]).toBeCloseTo(50, 1);
    expect(result.rows[1].data[2]).toBeCloseTo(100, 1);
  });

  it('returns all zeros when all days have zero tokens', () => {
    const days = [
      makeDay('2026-01-05', { total_tokens: 0 }), // Mon
      makeDay('2026-01-06', { total_tokens: 0 }), // Tue
    ];
    const result = weekdayShape(days, null);
    expect(result.rows[0].data.every(v => v === 0)).toBe(true);
  });
});

// ── cpmDrift ──────────────────────────────────────

describe('cpmDrift', () => {
  it('returns empty for empty days', () => {
    expect(cpmDrift([], 'all')).toEqual({ labels: [], rows: [] });
    expect(cpmDrift(null, 'all')).toEqual({ labels: [], rows: [] });
  });

  it('computes cost-per-million-tokens correctly per model per week', () => {
    // One week, one model: cost=10, tokens=50000 → CPM = 10*1e6/50000 = 200
    const days = [
      makeDay('2026-01-05', {
        byModel: {
          'deepseek-chat': { cost: 5, tokens: 25000, cache_hit: 10000, cache_miss: 10000, output: 5000 },
        },
      }),
      makeDay('2026-01-06', {
        byModel: {
          'deepseek-chat': { cost: 5, tokens: 25000, cache_hit: 10000, cache_miss: 10000, output: 5000 },
        },
      }),
    ];
    const result = cpmDrift(days, 'all');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].model).toBe('deepseek-chat');
    expect(result.rows[0].data).toHaveLength(1);
    // CPM = 10 * 1e6 / 50000 = 200
    expect(result.rows[0].data[0]).toBeCloseTo(200, 2);
  });

  it('produces one series per model when modelFilter is all', () => {
    const days = [
      makeDay('2026-01-05', {
        byModel: {
          'chat': { cost: 1, tokens: 1000, cache_hit: 400, cache_miss: 400, output: 200 },
          'reasoner': { cost: 2, tokens: 500, cache_hit: 200, cache_miss: 200, output: 100 },
        },
      }),
    ];
    const result = cpmDrift(days, 'all');
    expect(result.rows).toHaveLength(2);
    const models = result.rows.map(r => r.model).sort();
    expect(models).toEqual(['chat', 'reasoner']);
  });

  it('filters to a single model when modelFilter is specified', () => {
    const days = [
      makeDay('2026-01-05', {
        byModel: {
          'chat': { cost: 1, tokens: 1000, cache_hit: 400, cache_miss: 400, output: 200 },
          'reasoner': { cost: 2, tokens: 500, cache_hit: 200, cache_miss: 200, output: 100 },
        },
      }),
    ];
    const result = cpmDrift(days, 'chat');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].model).toBe('chat');
  });

  it('returns null for weeks with zero tokens (no division by zero)', () => {
    const days = [
      makeDay('2026-01-05', {
        byModel: {
          'chat': { cost: 0, tokens: 0, cache_hit: 0, cache_miss: 0, output: 0 },
        },
      }),
    ];
    const result = cpmDrift(days, 'all');
    expect(result.rows[0].data[0]).toBeNull();
  });

  it('CPM math: cost * 1e6 / (cache_hit + cache_miss + output)', () => {
    // cost=5, cache_hit=100, cache_miss=200, output=200 → tokens=500
    // CPM = 5 * 1e6 / 500 = 10000
    const days = [
      makeDay('2026-01-05', {
        byModel: {
          'chat': { cost: 5, tokens: 500, cache_hit: 100, cache_miss: 200, output: 200 },
        },
      }),
    ];
    const result = cpmDrift(days, 'all');
    expect(result.rows[0].data[0]).toBeCloseTo(10000, 2);
  });
});

// ── cacheHitRatio ─────────────────────────────────

describe('cacheHitRatio', () => {
  it('returns empty for empty days', () => {
    expect(cacheHitRatio([])).toEqual({ labels: [], data: [] });
    expect(cacheHitRatio(null)).toEqual({ labels: [], data: [] });
  });

  it('computes hit/(hit+miss) as a percentage (0-100)', () => {
    const days = [
      makeDay('2026-01-01', { cache_hit: 80, cache_miss: 20 }),
      makeDay('2026-01-02', { cache_hit: 0, cache_miss: 100 }),
      makeDay('2026-01-03', { cache_hit: 50, cache_miss: 50 }),
    ];
    const result = cacheHitRatio(days);
    expect(result.labels).toHaveLength(3);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toBeCloseTo(80, 1); // 80/(80+20)*100 = 80
    expect(result.data[1]).toBeCloseTo(0, 1);  // 0/(0+100)*100 = 0
    expect(result.data[2]).toBeCloseTo(50, 1); // 50/(50+50)*100 = 50
  });

  it('returns null for days with zero hit+miss (no division by zero)', () => {
    const days = [
      makeDay('2026-01-01', { cache_hit: 0, cache_miss: 0 }),
    ];
    const result = cacheHitRatio(days);
    expect(result.data[0]).toBeNull();
  });

  it('stays within 0-100 range', () => {
    const days = [
      makeDay('2026-01-01', { cache_hit: 1000, cache_miss: 0 }),
      makeDay('2026-01-02', { cache_hit: 0, cache_miss: 1000 }),
    ];
    const result = cacheHitRatio(days);
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(0);
  });

  it('handles missing cache_hit/cache_miss as zero', () => {
    const days = [
      makeDay('2026-01-01', {}), // no cache fields
    ];
    const result = cacheHitRatio(days);
    expect(result.data[0]).toBeNull();
  });
});

// ── projectionCrossings ───────────────────────────

describe('projectionCrossings', () => {
  it('returns empty for fewer than 2 series', () => {
    expect(projectionCrossings(null, 30)).toEqual({ labels: [], projections: [], crossings: [] });
    expect(projectionCrossings([], 30)).toEqual({ labels: [], projections: [], crossings: [] });
    expect(projectionCrossings([makeSeries('Solo', [makeDay('2026-01-01', { cost_csv: 1 })])], 30)).toEqual({ labels: [], projections: [], crossings: [] });
  });

  it('detects a crossing when B overtakes A in the projected future', () => {
    // Alpha: flat at 20/day → projected stays ~20
    // Beta: starts at 5/day, increases by 1/day → at day 10, Beta=14, projected:
    //   linreg slope=1, intercept=5 → at projected index 10 (future day 1):
    //   Beta = 1*(10+0)+5 = 15, at future day 6: Beta = 1*15+5 = 20
    //   Beta overtakes Alpha (20) at future index ~10 (day 10+10=20, val=25 > 20)
    const alphaDays = [];
    const betaDays = [];
    for (var i = 0; i < 10; i++) {
      var d = '2026-01-' + String(i + 1).padStart(2, '0');
      alphaDays.push(makeDay(d, { cost_csv: 20 }));
      betaDays.push(makeDay(d, { cost_csv: 5 + i })); // 5..14 — all below Alpha
    }
    const series = [
      makeSeries('Alpha', alphaDays),
      makeSeries('Beta', betaDays),
    ];
    const result = projectionCrossings(series, 30);
    expect(result.projections).toHaveLength(2);
    expect(result.crossings.length).toBeGreaterThanOrEqual(1);
    // The crossing should happen in the projected portion (index >= histLen)
    var histLen = 10;
    expect(result.crossings[0].crossIndex).toBeGreaterThanOrEqual(histLen);
    // B (the overtaker) should be Beta
    expect(result.crossings[0].bName).toBe('Beta');
    expect(result.crossings[0].aName).toBe('Alpha');
  });

  it('does NOT detect a crossing when lines never cross', () => {
    // Both flat at 10/day → projections never cross
    const alphaDays = [];
    const betaDays = [];
    for (var i = 0; i < 10; i++) {
      var d = '2026-01-' + String(i + 1).padStart(2, '0');
      alphaDays.push(makeDay(d, { cost_csv: 10 }));
      betaDays.push(makeDay(d, { cost_csv: 5 })); // always below Alpha
    }
    const series = [
      makeSeries('Alpha', alphaDays),
      makeSeries('Beta', betaDays),
    ];
    const result = projectionCrossings(series, 30);
    expect(result.crossings).toHaveLength(0);
  });

  it('produces projection data arrays with history (null) + projected values', () => {
    const alphaDays = [makeDay('2026-01-01', { cost_csv: 10 })];
    const betaDays = [makeDay('2026-01-01', { cost_csv: 5 })];
    const series = [makeSeries('Alpha', alphaDays), makeSeries('Beta', betaDays)];
    const result = projectionCrossings(series, 10);
    // Each projection: histLen=1 + horizon=10 = 11 data points
    expect(result.projections[0].data).toHaveLength(11);
    expect(result.projections[1].data).toHaveLength(11);
    // History portion is null except bridge at last historical point
    expect(result.projections[0].data[0]).toBe(10); // bridge
    // Projected portion should have values
    expect(result.projections[0].data[1]).not.toBeNull();
  });

  it('extends labels by the projection horizon', () => {
    const days = [makeDay('2026-01-01', { cost_csv: 10 })];
    const series = [makeSeries('A', days), makeSeries('B', days)];
    const result = projectionCrossings(series, 30);
    // histLen=1 + 30 = 31 labels
    expect(result.labels).toHaveLength(31);
  });
});

// ── DOM integration: gallery controls exist ──────

describe('Insights Gallery DOM (DSD-GAP-047)', () => {
  it('canvas #cInsight exists', () => {
    expect(document.getElementById('cInsight')).not.toBeNull();
  });

  it('insight toggle buttons exist with correct data-insight values', () => {
    const btns = document.querySelectorAll('#insightsControls button[data-insight]');
    expect(btns.length).toBe(5);
    const ids = Array.from(btns).map(b => b.dataset.insight);
    expect(ids).toContain('shareDivergence');
    expect(ids).toContain('weekdayShape');
    expect(ids).toContain('cpmDrift');
    expect(ids).toContain('cacheRatio');
    expect(ids).toContain('crossingMarkers');
  });
});