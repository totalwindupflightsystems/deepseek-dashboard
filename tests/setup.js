// Test setup: load dashboard.js functions into global scope
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable',
});

// Expose browser globals that dashboard.js and tests need
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;

// Pre-define globals on the JSDOM window that dashboard.js expects
dom.window.activeWsId = null;
dom.window.db = null;

// Also expose on globalThis for test convenience — proxy to dom.window
Object.defineProperty(globalThis, 'activeWsId', {
  get() { return dom.window.activeWsId; },
  set(v) { dom.window.activeWsId = v; },
  configurable: true,
});
Object.defineProperty(globalThis, 'db', {
  get() { return dom.window.db; },
  set(v) { dom.window.db = v; },
  configurable: true,
});

// Load dashboard.js by evaluating it in the JSDOM window context
const scriptPath = resolve(process.cwd(), 'js', 'dashboard.js');
const scriptContent = readFileSync(scriptPath, 'utf-8');

const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = scriptContent;
dom.window.document.body.appendChild(scriptEl);

// Copy all dashboard functions to globalThis so tests can call them directly
const funcNames = [
  'fmtUSD', 'fmtTok', 'fmtNum', 'escapeHtml',
  'parseCSV', 'getISOWeekStart', 'groupDays', 'detectAnomalies',
  'loadCustomPrices', 'saveCustomPrices',
  'getPricingModels', 'getAvgPriceForModel',
  'collectPricesFromInputs', 'recalcPricing',
];

for (const name of funcNames) {
  if (typeof dom.window[name] === 'function') {
    globalThis[name] = dom.window[name];
  }
}
