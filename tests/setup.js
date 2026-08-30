// Test setup: load dashboard.js functions into global scope
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Use the real dashboard body so the full application script can install its
// event handlers. Exclude all script tags to keep CDN resources and init code
// under test control.
const indexPath = resolve(process.cwd(), 'index.html');
const indexHtml = readFileSync(indexPath, 'utf-8');
const bodyMatch = indexHtml.match(/<body>([\s\S]*?)<script src="js\/dashboard\.js"><\/script>/);
if (!bodyMatch) throw new Error('Could not extract dashboard body from index.html');

const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyMatch[1]}</body></html>`, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable',
});

// Expose browser globals that dashboard.js and tests need
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;

// Keep async application initialization pending in unit tests. The tested
// helpers and event bindings are still evaluated against the real DOM.
dom.window.initSqlJs = () => new Promise(() => {});

// DSD-GAP-053: app init now fetches + verifies the wasm BEFORE initSqlJs.
// Stub fetch with a never-resolving promise so init() stays suspended (same
// contract as the initSqlJs stub above) and never touches the network.
dom.window.fetch = () => new Promise(() => {});

// DSD-GAP-055: the dual-CDN loader in index.html is excluded from the harness,
// so satisfy the init() gate with a resolved {ok:true} and stub the libs it
// would have injected — no code path can touch the network or throw a bare
// ReferenceError before a test installs its own (tests that need real JSZip
// set window.JSZip themselves).
dom.window.__dsdLibs = Promise.resolve({ ok: true });
dom.window.JSZip = { loadAsync: () => new Promise(() => {}) };
dom.window.Chart = function Chart() {};

// Load dashboard.js by evaluating it in the JSDOM window context
const scriptPath = resolve(process.cwd(), 'js', 'dashboard.js');
const scriptContent = readFileSync(scriptPath, 'utf-8');

const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = scriptContent;
dom.window.document.body.appendChild(scriptEl);

// Pricing tests replace the body with focused fixtures that omit the toast.
// Stub notifications in this unit-test harness without changing app behavior.
dom.window.toast = () => {};

// The full application declares these with top-level `let`, so they live in
// the script's global lexical environment rather than as window properties.
// Proxy test assignments into that lexical environment.
for (const name of ['activeWsId', 'db']) {
  Object.defineProperty(globalThis, name, {
    get() { return dom.window.eval(name); },
    set(v) {
      dom.window.__dashboardTestValue = v;
      dom.window.eval(`${name} = window.__dashboardTestValue`);
      delete dom.window.__dashboardTestValue;
    },
    configurable: true,
  });
}

// Copy all dashboard functions to globalThis so tests can call them directly
const funcNames = [
  'fmtUSD', 'fmtTok', 'fmtNum', 'escapeHtml',
  'parseCSV', 'getISOWeekStart', 'groupDays', 'detectAnomalies',
  'loadCustomPrices', 'saveCustomPrices',
  'getPricingModels', 'getAvgPriceForModel',
  'collectPricesFromInputs', 'recalcPricing',
  'getDailyData',
  'exportRowToCsv',
  'renderTopDaysHtml',
  'filterRowsBySearch',
  'renderTable',
  'formatType',
  // DSD-GAP-043: trend helpers
  'groupByWeek', 'rollingMean', 'growthRate', 'buildTrendDatasets',
  // DSD-GAP-044: projection helpers
  'linreg', 'expfit', 'projectFit', 'projectConfidenceBand',
  'computeQuarterProjection', 'getSelectedProjection', 'getSelectedHorizon',
  'buildProjectionDatasets', 'renderProjectionSummary',
  // DSD-GAP-045: quarterly aggregation helpers
  'normalizeDate', 'quarterKey', 'quarterLabel', 'aggregateByQuarter',
  'computeQoQ', 'renderQuarterlyChart', 'renderQoQPanel',
  'populateQuarterSelect', 'getSelectedQuarter', 'filterDaysByQuarter',
  'renderQuarterDrilldown',
  // DSD-GAP-046: multi-workspace overlay helpers
  'normalizeIndex', 'buildOverlayTokenDatasets', 'buildOverlaySpendDatasets',
  'getSelectedWorkspaceIds', 'getOverlayNormalized', 'getWorkspaceName',
  'overlayTooltipLabel',
  // DSD-GAP-047: implicit-insights gallery helpers
  'tokenVsCostShareDivergence', 'weekdayShape', 'cpmDrift', 'cacheHitRatio',
  'projectionCrossings', 'renderInsightGallery',
  // DSD-GAP-053: verified wasm engine loader
  'fetchVerifiedWasm',
];

for (const name of funcNames) {
  if (typeof dom.window[name] === 'function') {
    globalThis[name] = dom.window[name];
  }
}
