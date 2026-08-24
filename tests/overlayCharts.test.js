import { describe, it, expect, beforeEach } from 'vitest';

// ── DSD-GAP-046: Multi-workspace overlay charts ──
// Covers: 2+ workspace series assembly, index=100 normalization math,
// single-workspace assembly parity, workspace-name labels (legend source),
// and the per-workspace getDailyData path.

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

// ── normalizeIndex ────────────────────────────────

describe('normalizeIndex', () => {
  it('maps the first non-zero value to 100 and scales everything else', () => {
    // Base = 50 (first non-zero) → scale = 2
    expect(normalizeIndex([0, 0, 50, 100, 200])).toEqual([0, 0, 100, 200, 400]);
  });

  it('is shape-preserving: ratio between points is unchanged', () => {
    const series = [10, 15, 20, 30];
    const idx = normalizeIndex(series);
    expect(idx[0]).toBe(100);
    expect(idx[1]).toBe(150);
    expect(idx[2]).toBe(200);
    expect(idx[3]).toBe(300);
    // relative growth (50%) identical in both scales
    expect((idx[2] - idx[1]) / idx[1]).toBeCloseTo((series[2] - series[1]) / series[1]);
  });

  it('skips leading zeros when finding the base', () => {
    expect(normalizeIndex([0, 0, 0, 25, 50])).toEqual([0, 0, 0, 100, 200]);
  });

  it('handles a negative base consistently', () => {
    expect(normalizeIndex([-25, -50])).toEqual([100, 200]);
  });

  it('returns an all-zero series unchanged (no meaningful base)', () => {
    expect(normalizeIndex([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('returns empty/null input unchanged', () => {
    expect(normalizeIndex([])).toEqual([]);
    expect(normalizeIndex(null)).toEqual([]);
    expect(normalizeIndex(undefined)).toEqual([]);
  });

  it('preserves null gaps (projection-style holes) untouched', () => {
    expect(normalizeIndex([null, 50, null, 25])).toEqual([null, 100, null, 50]);
  });
});

// ── buildOverlayTokenDatasets ─────────────────────

describe('buildOverlayTokenDatasets', () => {
  it('produces one Input/Output dataset pair per workspace (2+ series assembly)', () => {
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { cache_hit: 100, cache_miss: 50, output: 30 }),
        makeDay('2026-01-02', { cache_hit: 0, cache_miss: 200, output: 60 }),
      ]),
      makeSeries('Beta', [
        makeDay('2026-01-01', { cache_hit: 1000, cache_miss: 500, output: 300 }),
      ]),
    ];
    const datasets = buildOverlayTokenDatasets(series, false);
    expect(datasets).toHaveLength(4);
    expect(datasets.map(d => d.label)).toEqual([
      'Alpha — Input Tokens',
      'Alpha — Output Tokens',
      'Beta — Input Tokens',
      'Beta — Output Tokens',
    ]);
    // Input = cache_hit + cache_miss per day
    expect(datasets[0].data).toEqual([150, 200]);
    expect(datasets[1].data).toEqual([30, 60]);
    expect(datasets[2].data).toEqual([1500]);
    expect(datasets[3].data).toEqual([300]);
  });

  it('uses distinct colors per workspace and dashes the output series', () => {
    const series = [
      makeSeries('Alpha', [makeDay('2026-01-01')]),
      makeSeries('Beta', [makeDay('2026-01-01')]),
      makeSeries('Gamma', [makeDay('2026-01-01')]),
    ];
    const datasets = buildOverlayTokenDatasets(series, false);
    const wsColors = [datasets[0].borderColor, datasets[2].borderColor, datasets[4].borderColor];
    expect(new Set(wsColors).size).toBe(3);
    // output series is visually distinct within its workspace
    expect(datasets[1].borderDash).toEqual([4, 4]);
    expect(datasets[0].borderDash).toBeUndefined();
  });

  it('applies index=100 normalization to dataset values while keeping raw values on _raw', () => {
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { cache_hit: 0, cache_miss: 0, output: 0 }),
        makeDay('2026-01-02', { cache_hit: 25, cache_miss: 25, output: 50 }),
        makeDay('2026-01-03', { cache_hit: 50, cache_miss: 50, output: 100 }),
      ]),
    ];
    const datasets = buildOverlayTokenDatasets(series, true);
    // input series: base 50 → 100; day3 100 → 200
    expect(datasets[0].data).toEqual([0, 100, 200]);
    expect(datasets[0]._raw).toEqual([0, 50, 100]);
    // output series: base 50 → 100; day3 100 → 200
    expect(datasets[1].data).toEqual([0, 100, 200]);
    expect(datasets[1]._raw).toEqual([0, 50, 100]);
  });

  it('single-workspace assembly is exactly one input/output pair (unchanged path)', () => {
    const series = [
      makeSeries('Solo', [
        makeDay('2026-01-01', { cache_hit: 10, cache_miss: 20, output: 5 }),
        makeDay('2026-01-02', { cache_hit: 30, cache_miss: 0, output: 15 }),
      ]),
    ];
    const datasets = buildOverlayTokenDatasets(series, false);
    expect(datasets).toHaveLength(2);
    expect(datasets[0].label).toBe('Solo — Input Tokens');
    expect(datasets[1].label).toBe('Solo — Output Tokens');
    // same values the single-workspace chart computes (cache_hit+cache_miss, output)
    expect(datasets[0].data).toEqual([30, 30]);
    expect(datasets[1].data).toEqual([5, 15]);
  });

  it('returns [] for empty or null series', () => {
    expect(buildOverlayTokenDatasets([], false)).toEqual([]);
    expect(buildOverlayTokenDatasets(null, false)).toEqual([]);
  });
});

// ── buildOverlaySpendDatasets ─────────────────────

describe('buildOverlaySpendDatasets', () => {
  it('produces one Daily Cost line per workspace', () => {
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { cost_csv: 1.5 }),
        makeDay('2026-01-02', { cost_csv: 2.5 }),
      ]),
      makeSeries('Beta', [
        makeDay('2026-01-01', { cost_csv: 150.0 }),
      ]),
    ];
    const datasets = buildOverlaySpendDatasets(series, false);
    expect(datasets).toHaveLength(2);
    expect(datasets.map(d => d.label)).toEqual(['Alpha — Daily Cost', 'Beta — Daily Cost']);
    expect(datasets[0].data).toEqual([1.5, 2.5]);
    expect(datasets[1].data).toEqual([150.0]);
    expect(datasets[0].type).toBe('line');
  });

  it('falls back to cost_tokens when cost_csv is absent', () => {
    const series = [
      makeSeries('Alpha', [
        makeDay('2026-01-01', { cost_csv: null, cost_tokens: 7.0 }),
      ]),
    ];
    const datasets = buildOverlaySpendDatasets(series, false);
    expect(datasets[0].data).toEqual([7.0]);
  });

  it('normalizes each workspace to index=100 independently (shape comparison)', () => {
    const series = [
      makeSeries('Big', [
        makeDay('2026-01-01', { cost_csv: 100 }),
        makeDay('2026-01-02', { cost_csv: 200 }),
      ]),
      makeSeries('Small', [
        makeDay('2026-01-01', { cost_csv: 1 }),
        makeDay('2026-01-02', { cost_csv: 2 }),
      ]),
    ];
    const datasets = buildOverlaySpendDatasets(series, true);
    // both start at index 100 despite vastly different absolute scale
    expect(datasets[0].data).toEqual([100, 200]);
    expect(datasets[1].data).toEqual([100, 200]);
    // raw values still available for tooltips
    expect(datasets[0]._raw).toEqual([100, 200]);
    expect(datasets[1]._raw).toEqual([1, 2]);
  });
});

// ── overlayTooltipLabel ───────────────────────────

describe('overlayTooltipLabel', () => {
  it('shows real values (not the index) when the dataset is normalized', () => {
    const ctx = { dataset: { label: 'Alpha — Input Tokens', _raw: [0, 500, 1000] }, dataIndex: 1, parsed: { y: 100 } };
    expect(overlayTooltipLabel(ctx, 'tokens')).toBe('Alpha — Input Tokens: 500 tokens');
  });

  it('formats spend values as USD', () => {
    const ctx = { dataset: { label: 'Beta — Daily Cost', _raw: [12.5] }, dataIndex: 0, parsed: { y: 100 } };
    expect(overlayTooltipLabel(ctx, 'spend')).toBe('Beta — Daily Cost: $12.50');
  });

  it('falls back to the plotted value when _raw is missing', () => {
    const ctx = { dataset: { label: 'Alpha — Input Tokens' }, dataIndex: 0, parsed: { y: 42 } };
    expect(overlayTooltipLabel(ctx, 'tokens')).toBe('Alpha — Input Tokens: 42 tokens');
  });
});

// ── getDailyData per-workspace path ───────────────

describe('getDailyData with explicit workspaceId', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-primary';
  });

  function makeDbMock() {
    const calls = [];
    return {
      exec: (sql, params) => {
        calls.push({ sql, params: params || [] });
        if (sql.includes('FROM token_usage')) {
          return [{ values: [['2026-01-01', 'deepseek-chat', 'output_tokens', 100, 0.5]] }];
        }
        return []; // cost_daily merge — empty
      },
      calls,
    };
  }

  it('queries the given workspace id instead of the active one', () => {
    const mock = makeDbMock();
    globalThis.db = mock;
    const days = getDailyData('all', 'all', 'all', 'ws-other');
    expect(days).toHaveLength(1);
    const tokenCall = mock.calls.find(c => c.sql.includes('FROM token_usage'));
    expect(tokenCall.params[0]).toBe('ws-other');
  });

  it('omitting the workspace id keeps the active-workspace behavior', () => {
    const mock = makeDbMock();
    globalThis.db = mock;
    getDailyData('all', 'all', 'all');
    const tokenCall = mock.calls.find(c => c.sql.includes('FROM token_usage'));
    expect(tokenCall.params[0]).toBe('ws-primary');
  });

  it('applies model/key filters per workspace', () => {
    const mock = makeDbMock();
    globalThis.db = mock;
    getDailyData('all', 'deepseek-reasoner', 'keyA', 'ws-other');
    const tokenCall = mock.calls.find(c => c.sql.includes('FROM token_usage'));
    expect(tokenCall.sql).toContain('AND model = ?');
    expect(tokenCall.sql).toContain('AND api_key_name = ?');
    expect(tokenCall.params).toEqual(['ws-other', '2000-01-01', '2099-12-31', 'deepseek-reasoner', 'keyA']);
  });
});

// ── DOM integration: switcher + normalize toggle ──

describe('multi-select workspace switcher', () => {
  beforeEach(() => {
    const sel = document.getElementById('wsSelect');
    // Real index.html declares the switcher with the `multiple` attribute
    sel.innerHTML = '<option value="ws-1">Alpha</option><option value="ws-2">Beta</option><option value="ws-3">Gamma</option>';
    Array.from(sel.options).forEach(o => { o.selected = false; });
  });

  it('declares the switcher as multi-select', () => {
    expect(document.getElementById('wsSelect').multiple).toBe(true);
  });

  it('returns a single id for a single selection (backward compatible)', () => {
    const sel = document.getElementById('wsSelect');
    sel.options[0].selected = true;
    expect(getSelectedWorkspaceIds()).toEqual(['ws-1']);
  });

  it('returns 2+ ids for a multi-selection (overlay mode)', () => {
    const sel = document.getElementById('wsSelect');
    sel.options[0].selected = true;
    sel.options[2].selected = true;
    expect(getSelectedWorkspaceIds()).toEqual(['ws-1', 'ws-3']);
  });

  it('excludes the empty placeholder option', () => {
    const sel = document.getElementById('wsSelect');
    sel.innerHTML = '<option value="">No Workspace</option><option value="ws-1">Alpha</option>';
    sel.options[1].selected = true;
    expect(getSelectedWorkspaceIds()).toEqual(['ws-1']);
    sel.options[0].selected = true;
    expect(getSelectedWorkspaceIds()).toEqual(['ws-1']); // '' filtered out
  });

  it('returns [] when nothing is selected', () => {
    expect(getSelectedWorkspaceIds()).toEqual([]);
  });

  it('getOverlayNormalized reflects the checkbox state', () => {
    const cb = document.getElementById('overlayToggle');
    cb.checked = false;
    expect(getOverlayNormalized()).toBe(false);
    cb.checked = true;
    expect(getOverlayNormalized()).toBe(true);
  });
});

// ── getWorkspaceName ──────────────────────────────

describe('getWorkspaceName', () => {
  it('resolves the display name from the workspaces table', () => {
    globalThis.db = {
      each: (sql, params, cb) => {
        cb({ id: 'ws-1', name: 'Alpha' });
      },
    };
    expect(getWorkspaceName('ws-1')).toBe('Alpha');
  });

  it('falls back to the id for an unknown workspace', () => {
    globalThis.db = {
      each: (sql, params, cb) => { /* no rows */ },
    };
    expect(getWorkspaceName('ws-ghost')).toBe('ws-ghost');
  });
});
