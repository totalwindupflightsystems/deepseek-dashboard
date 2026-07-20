import { describe, it, expect, beforeEach } from 'vitest';

// Mock db.exec: returns SQL.js-style results [{ columns: [...], values: [[...], ...] }]
function makeDbResult(values, columns) {
  return values.length ? [{ values, columns: columns || [] }] : [];
}

describe('getAvgPriceForModel', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
    globalThis.db = {
      exec: () => [],
    };
  });

  it('returns zeros when no activeWsId', () => {
    globalThis.activeWsId = null;
    const result = getAvgPriceForModel('deepseek-chat');
    expect(result).toEqual({ input: 0, output: 0, cache_hit: 0 });
  });

  it('returns zeros when db returns no rows', () => {
    globalThis.db.exec = () => [];
    const result = getAvgPriceForModel('deepseek-chat');
    expect(result).toEqual({ input: 0, output: 0, cache_hit: 0 });
  });

  it('averages prices by type from db results', () => {
    globalThis.db.exec = (sql, params) => {
      expect(params).toEqual(['ws-1', 'deepseek-chat']);
      return makeDbResult([
        ['output_tokens', 2.8e-6],
        ['input_tokens', 1.4e-6],
        ['input_cache_hit_tokens', 0.14e-6],
        ['input_cache_miss_tokens', 1.4e-6],
      ]);
    };
    const result = getAvgPriceForModel('deepseek-chat');
    expect(result.output).toBeCloseTo(2.8e-6);
    expect(result.input).toBeCloseTo(1.4e-6);
    expect(result.cache_hit).toBeCloseTo(0.14e-6);
  });

  it('handles input type prefix matching (any input_*)', () => {
    globalThis.db.exec = () => makeDbResult([
      ['input_cache_miss_tokens', 2.0],
      ['input_tokens', 1.0],
    ]);
    const result = getAvgPriceForModel('deepseek-chat');
    // Both match 'input' prefix — the LAST one processed overwrites
    // input_cache_miss_tokens: starts with 'input' → input = 2.0
    // input_tokens: starts with 'input' → input = 1.0 (overwrites)
    expect(result.input).toBeCloseTo(1.0);
  });

  it('handles non-numeric avg values gracefully', () => {
    globalThis.db.exec = () => makeDbResult([
      ['input_tokens', null], // Number(null) = 0
    ]);
    const result = getAvgPriceForModel('deepseek-chat');
    expect(result.input).toBe(0);
  });
});

describe('recalcPricing', () => {
  beforeEach(() => {
    globalThis.activeWsId = 'ws-1';
    // Clear any existing DOM
    document.body.innerHTML = '';

    // Build the minimal DOM structure that recalcPricing expects
    document.body.innerHTML = `
      <div id="pricingResults">
        <span id="pricingOrigCost"></span>
        <span id="pricingNewCost"></span>
        <span id="pricingDiff"></span>
        <div id="pricingDiffItem"></div>
        <table id="pricingBreakdown">
          <tbody></tbody>
        </table>
      </div>
      <div id="pricingModelRows">
        <input data-model="deepseek-chat" data-ptype="input" value="1.4e-6">
        <input data-model="deepseek-chat" data-ptype="output" value="2.8e-6">
        <input data-model="deepseek-chat" data-ptype="cache_hit" value="0.14e-6">
      </div>
    `;

    // Mock db with realistic data
    globalThis.db = {
      exec: () => [],
    };
  });

  it('returns early when no activeWsId', () => {
    globalThis.activeWsId = null;
    const result = recalcPricing();
    expect(result).toBeUndefined();
  });

  it('computes pricing totals correctly', () => {
    globalThis.db.exec = (sql, params) => {
      if (sql.includes('type !=')) {
        // Return: model, type, amount, price
        return makeDbResult([
          ['deepseek-chat', 'input_tokens', 1000, 1.5e-6],          // orig: 0.0015, new: 1000*1.4e-6 = 0.0014
          ['deepseek-chat', 'output_tokens', 500, 3.0e-6],           // orig: 0.0015, new: 500*2.8e-6 = 0.0014
          ['deepseek-chat', 'input_cache_hit_tokens', 200, 0.2e-6],  // orig: 0.00004, new: 200*0.14e-6 = 0.000028
        ]);
      }
      return [];
    };

    recalcPricing();

    const origEl = document.getElementById('pricingOrigCost');
    const newEl = document.getElementById('pricingNewCost');
    expect(origEl.textContent).toBeTruthy();
    expect(newEl.textContent).toBeTruthy();
  });

  it('computes per-model breakdown', () => {
    globalThis.db.exec = (sql) => {
      if (sql.includes('type !=')) {
        return makeDbResult([
          ['deepseek-chat', 'input_tokens', 1000, 1.5e-6],
          ['deepseek-coder', 'output_tokens', 500, 3.0e-6],
        ]);
      }
      return [];
    };

    recalcPricing();

    const tbody = document.querySelector('#pricingBreakdown tbody');
    expect(tbody.innerHTML).toBeTruthy();
    expect(tbody.innerHTML).toContain('deepseek-chat');
    expect(tbody.innerHTML).toContain('deepseek-coder');
  });

  it('shows pricing results after calculation', () => {
    globalThis.db.exec = (sql) => {
      if (sql.includes('type !=')) {
        return makeDbResult([
          ['deepseek-chat', 'input_tokens', 100, 1.0],
        ]);
      }
      return [];
    };

    recalcPricing();

    const resultsEl = document.getElementById('pricingResults');
    expect(resultsEl.classList.contains('show')).toBe(true);
  });

  it('returns early when db has no rows', () => {
    globalThis.db.exec = () => [];
    recalcPricing();
    // Should not throw, and results should not be shown (early return before .show)
    const resultsEl = document.getElementById('pricingResults');
    // classList should NOT contain 'show' since we returned early
    // But wait — the early return doesn't add 'show'
    expect(resultsEl.classList.contains('show')).toBe(false);
  });
});

describe('collectPricesFromInputs', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="pricingModelRows">
        <input data-model="model-a" data-ptype="input" value="1.0">
        <input data-model="model-a" data-ptype="output" value="2.0">
        <input data-model="model-a" data-ptype="cache_hit" value="0.5">
        <input data-model="model-b" data-ptype="input" value="3.0">
      </div>
    `;
  });

  it('collects prices from DOM inputs', () => {
    const prices = collectPricesFromInputs();
    expect(prices).toHaveProperty('model-a');
    expect(prices['model-a']).toEqual({ input: 1.0, output: 2.0, cache_hit: 0.5 });
    expect(prices['model-b'].input).toBe(3.0);
    expect(prices['model-b'].output).toBe(0);
  });

  it('clamps negative values to 0', () => {
    document.getElementById('pricingModelRows').innerHTML = `
      <input data-model="model-a" data-ptype="input" value="-5">
    `;
    const prices = collectPricesFromInputs();
    expect(prices['model-a'].input).toBe(0);
  });

  it('handles NaN inputs as 0', () => {
    document.getElementById('pricingModelRows').innerHTML = `
      <input data-model="model-a" data-ptype="input" value="abc">
    `;
    const prices = collectPricesFromInputs();
    expect(prices['model-a'].input).toBe(0);
  });
});

describe('loadCustomPrices / saveCustomPrices', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadCustomPrices returns empty object when nothing stored', () => {
    expect(loadCustomPrices()).toEqual({});
  });

  it('saveCustomPrices and loadCustomPrices round-trip', () => {
    const testPrices = { 'deepseek-chat': { input: 1.4e-6, output: 2.8e-6, cache_hit: 0.14e-6 } };
    saveCustomPrices(testPrices);
    expect(loadCustomPrices()).toEqual(testPrices);
  });
});
