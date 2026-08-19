import { describe, it, expect } from 'vitest';

const SAMPLE_ROWS = [
  ['2026-01-15', 'deepseek-chat', 'production-key', 'output_tokens', 5000, 0.0000014, 0.007],
  ['2026-01-15', 'deepseek-chat', 'production-key', 'input_cache_hit_tokens', 3000, 0.00000014, 0.00042],
  ['2026-01-16', 'deepseek-reasoner', 'staging-key', 'output_tokens', 12000, 0.0000028, 0.0336],
  ['2026-01-17', 'deepseek-chat', 'test-key', 'request_count', 450, 0, 0],
  ['2026-02-01', 'deepseek-reasoner', 'production-key', 'input_cache_miss_tokens', 8000, 0.00000028, 0.00224],
];

describe('filterRowsBySearch', () => {
  it('returns all rows when term is empty', () => {
    expect(filterRowsBySearch(SAMPLE_ROWS, '').length).toBe(SAMPLE_ROWS.length);
  });

  it('returns all rows when term is whitespace only', () => {
    expect(filterRowsBySearch(SAMPLE_ROWS, '   ').length).toBe(SAMPLE_ROWS.length);
  });

  it('filters by date (utc_date, r[0])', () => {
    const result = filterRowsBySearch(SAMPLE_ROWS, '2026-01-15');
    expect(result.length).toBe(2);
    result.forEach(r => expect(r[0]).toBe('2026-01-15'));
  });

  it('filters by model (r[1])', () => {
    const result = filterRowsBySearch(SAMPLE_ROWS, 'deepseek-chat');
    expect(result.length).toBe(3);
    result.forEach(r => expect(r[1]).toBe('deepseek-chat'));
  });

  it('filters by api_key_name (r[2])', () => {
    const result = filterRowsBySearch(SAMPLE_ROWS, 'production-key');
    expect(result.length).toBe(3);
  });

  it('filters by raw type string (r[3])', () => {
    const result = filterRowsBySearch(SAMPLE_ROWS, 'output_tokens');
    expect(result.length).toBe(2);
  });

  it('filters by human-readable type label via formatType', () => {
    const result = filterRowsBySearch(SAMPLE_ROWS, 'cache hit');
    expect(result.length).toBe(1);
    expect(result[0][3]).toBe('input_cache_hit_tokens');
  });

  it('is case-insensitive', () => {
    const lower = filterRowsBySearch(SAMPLE_ROWS, 'deepseek-chat');
    const upper = filterRowsBySearch(SAMPLE_ROWS, 'DEEPSEEK-CHAT');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(3);
  });

  it('returns empty array when no rows match', () => {
    expect(filterRowsBySearch(SAMPLE_ROWS, 'nonexistent-xyz').length).toBe(0);
  });

  it('handles rows with null/undefined fields without throwing', () => {
    const rowsWithNulls = [
      ['2026-01-01', 'model-a', null, 'output_tokens', 100, 0.001, 0.1],
      ['2026-01-02', null, 'key-b', 'input_tokens', 200, 0.002, 0.4],
    ];
    const result = filterRowsBySearch(rowsWithNulls, 'key-b');
    expect(result.length).toBe(1);
    expect(result[0][2]).toBe('key-b');
  });

  it('does not mutate the input array', () => {
    const original = [...SAMPLE_ROWS];
    filterRowsBySearch(SAMPLE_ROWS, 'deepseek-chat');
    expect(SAMPLE_ROWS.length).toBe(original.length);
    expect(SAMPLE_ROWS).toEqual(original);
  });
});

describe('renderTable search integration', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
    const searchEl = document.getElementById('rawSearch');
    if (searchEl) searchEl.value = '';
  });

  it('updates rowCount with filtered count when search term is active', () => {
    const allRows = [
      ['2026-01-15', 'deepseek-chat', 'key-a', 'output_tokens', 100, 0.001, 0.1],
      ['2026-01-15', 'deepseek-chat', 'key-a', 'input_tokens', 200, 0.002, 0.4],
      ['2026-01-16', 'deepseek-reasoner', 'key-b', 'output_tokens', 300, 0.003, 0.9],
    ];

    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('COUNT(*)')) return [{ values: [[3]], columns: [] }];
        return [{ values: allRows, columns: [] }];
      },
    };

    // No search — should show (3 rows)
    renderTable([], 'all', 'all');
    expect(document.getElementById('rowCount').textContent).toBe('(3 rows)');

    // Set search term that matches only 2 rows (deepseek-chat)
    document.getElementById('rawSearch').value = 'deepseek-chat';
    renderTable([], 'all', 'all');
    const text = document.getElementById('rowCount').textContent;
    expect(text).toContain('2 of 3');
  });
});

  it('shows (0 rows) when no data is returned', () => {
    globalThis.db = {
      exec: () => [],
    };

    renderTable([], 'all', 'all');
    expect(document.getElementById('rowCount').textContent).toBe('(0 rows)');
  });

  it('search filtering reduces rows below virtual scroll threshold', () => {
    // Generate 600 rows to trigger virtual scroll, then filter to < 500
    const manyRows = [];
    for (let i = 0; i < 600; i++) {
      manyRows.push([
        '2026-01-' + String(i + 1).padStart(2, '0'),
        i < 100 ? 'deepseek-chat' : 'deepseek-reasoner',
        'key-' + i,
        'output_tokens',
        100 + i,
        0.001,
        0.1 + i * 0.001,
      ]);
    }

    globalThis.db = {
      exec: (sql) => {
        if (sql.includes('COUNT(*)')) return [{ values: [[600]], columns: [] }];
        return [{ values: manyRows, columns: [] }];
      },
    };

    // Without search: 600 rows → virtual scroll (>500)
    renderTable([], 'all', 'all');
    expect(document.getElementById('rowCount').textContent).toContain('600 rows');

    // With search for 'deepseek-chat': 100 rows → direct render (<500)
    document.getElementById('rawSearch').value = 'deepseek-chat';
    renderTable([], 'all', 'all');
    const text = document.getElementById('rowCount').textContent;
    expect(text).toContain('100 of 600');
    // Virtual scroll class should be removed (100 < 500)
    expect(document.querySelector('.table-wrap').classList.contains('virtual-scroll')).toBe(false);
  });
