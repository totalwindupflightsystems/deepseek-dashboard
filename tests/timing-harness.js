// DSD-GAP-034 timing harness — measures _processSingleFile before/after the
// transaction optimization. Loads the real dashboard.js in a JSDOM context
// with a real sql.js instance, then feeds it the big-6mo.zip evidence file.
//
// Usage: node tests/timing-harness.js [path/to/zip]
const { JSDOM } = require('jsdom');
const { readFileSync } = require('fs');
const { resolve } = require('path');

async function main() {
  const zipPath = process.argv[2] || '/tmp/dogfood-dsd/run2/big-6mo.zip';

  // Load sql.js WASM module
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: file => resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  // Build a JSDOM environment matching tests/setup.js
  const indexPath = resolve(process.cwd(), 'index.html');
  const indexHtml = readFileSync(indexPath, 'utf-8');
  const bodyMatch = indexHtml.match(/<body>([\s\S]*?)<script src="js\/dashboard\.js"><\/script>/);
  if (!bodyMatch) throw new Error('Could not extract dashboard body from index.html');

  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyMatch[1]}</body></html>`, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    resources: 'usable',
  });

  // Stub initSqlJs so the app's async init doesn't try to load WASM from CDN
  dom.window.initSqlJs = () => new Promise(() => {});

  // Load JSZip from node_modules into the JSDOM window
  const JSZip = require('jszip');
  dom.window.JSZip = JSZip;

  // Load dashboard.js into the JSDOM context
  const scriptPath = resolve(process.cwd(), 'js', 'dashboard.js');
  const scriptContent = readFileSync(scriptPath, 'utf-8');
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = scriptContent;
  dom.window.document.body.appendChild(scriptEl);

  // Create a real sql.js database and initialize schema
  const db = new SQL.Database();
  // Run initSchema from the dashboard
  dom.window.eval('initSchema');
  // Set up the schema directly
  db.run(`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, last_upload_at TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS token_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, utc_date TEXT NOT NULL, model TEXT NOT NULL, api_key_name TEXT, type TEXT NOT NULL, price REAL, amount REAL, upload_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS cost_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, utc_date TEXT NOT NULL, model TEXT NOT NULL, cost REAL NOT NULL, currency TEXT DEFAULT 'USD', upload_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, filename TEXT, uploaded_at TEXT NOT NULL DEFAULT (datetime('now')), mode TEXT NOT NULL DEFAULT 'insert', rows_replaced INTEGER DEFAULT 0, rows_added INTEGER DEFAULT 0, date_min TEXT, date_max TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_token_ws ON token_usage(workspace_id, utc_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cost_ws ON cost_daily(workspace_id, utc_date)`);
  db.run(`INSERT INTO workspaces (id, name, created_at) VALUES ('ws-bench', 'benchmark', '2026-01-01T00:00:00Z')`);

  // Inject the real db into the dashboard's global scope
  dom.window.__benchDb = db;
  dom.window.eval('db = window.__benchDb;');
  dom.window.eval('activeWsId = "ws-bench";');

  // Stub saveDB to a no-op (we don't want IndexedDB in the benchmark — we're
  // measuring the insert phase, not the persist phase)
  dom.window.eval('saveDB = async function() {};');
  // Stub refreshAll too
  dom.window.eval('refreshAll = async function() {};');
  // Stub toast
  dom.window.eval('toast = function() {};');

  // Load the zip file — JSZip.loadAsync accepts Uint8Array directly.
  // _processSingleFile only uses file.name for the upload record, so we
  // attach a .name property to the Uint8Array.
  const zipBuffer = readFileSync(zipPath);
  const file = new Uint8Array(zipBuffer);
  file.name = 'big-6mo.zip';

  // Get the _processSingleFile function from the window
  const processFn = dom.window._processSingleFile;
  if (typeof processFn !== 'function') {
    throw new Error('_processSingleFile not found on window');
  }

  // Track progress callbacks
  let lastProgress = null;
  const progressCb = (upd) => { lastProgress = upd; };

  // Warm up (first run may have JIT/cache effects)
  // Actually, we can't easily warm up because the DB would have the data already.
  // Instead, we'll run 3 trials on fresh DBs and take the median.

  const times = [];
  for (let trial = 0; trial < 3; trial++) {
    // Reset DB for each trial
    db.run('DELETE FROM token_usage');
    db.run('DELETE FROM cost_daily');
    db.run('DELETE FROM uploads');

    const t0 = performance.now();
    // eslint-disable-next-line no-await-in-loop
    const result = await processFn(file, progressCb);
    const t1 = performance.now();
    const elapsed = t1 - t0;
    times.push(elapsed);
    console.log(`  Trial ${trial + 1}: ${elapsed.toFixed(0)} ms — ${result.message}`);
  }

  // Count rows
  const tokenCount = db.exec('SELECT COUNT(*) FROM token_usage')[0].values[0][0];
  const costCount = db.exec('SELECT COUNT(*) FROM cost_daily')[0].values[0][0];

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];

  console.log('');
  console.log(`Rows inserted: ${tokenCount} token_usage + ${costCount} cost_daily = ${tokenCount + costCount} total`);
  console.log(`Median time (3 trials): ${median.toFixed(0)} ms`);
  console.log(`All trials: ${times.map(t => t.toFixed(0) + ' ms').join(', ')}`);
  if (lastProgress) {
    console.log(`Last progress callback: phase=${lastProgress.phase}, rowsDone=${lastProgress.rowsDone}, rowsTotal=${lastProgress.rowsTotal}`);
  }

  // Check if BEGIN/COMMIT is in the source
  const src = scriptContent;
  const hasBegin = src.includes("db.run('BEGIN')");
  const hasCommit = src.includes("db.run('COMMIT')");
  const hasRollback = src.includes("db.run('ROLLBACK')");
  console.log(`Transaction wrapping: BEGIN=${hasBegin}, COMMIT=${hasCommit}, ROLLBACK=${hasRollback}`);
}

main().catch(e => {
  console.error('Timing harness failed:', e);
  process.exit(1);
});