'use strict';
// -- Global State --
let SQL = null;
let db = null;
let activeWsId = null;
let charts = {};
let _currentDays = [];
let _groupedDays = [];
const IDB_NAME = 'deepseek-dashboard';
const IDB_STORE = 'sqlite-db';
const DEBOUNCE_MS = 300;
const TABLE_ROW_LIMIT = 50000;

// -- Utilities --
function debounce(fn, ms) {
  let timer = null;
  return function() {
    const ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}
const DB_KEY = 'main';

// Virtual scroller state
let _vscroll = null;  // { rows, rowHeight, pool[], topSpacer, bottomSpacer, poolSize, animationId, initialized }
let _anomalyCache = null; // { items: [], dates: Set(string) }
const ANOMALY_LS_KEY = 'ds-dash-anomaly-prefs';

// -- Utilities --
function fmtUSD(n) { return '$' + Number(n).toFixed(2); }
function fmtTok(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return Math.round(n).toLocaleString();
}
function fmtNum(n) { return Math.round(Number(n)).toLocaleString(); }
function fmtDate(d) { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
function toast(msg, warn) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast show' + (warn ? ' warn' : '');
  el.style.transform = '';  // reset any swipe transform
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('show'); el.style.transform = ''; }, 3000);
}

// -- Toast swipe-to-dismiss (touch) --
(function setupToastSwipe() {
  const el = document.getElementById('toast');
  let startX = 0, startY = 0, currentX = 0, dragging = false;
  el.addEventListener('touchstart', function(e) {
    if (!el.classList.contains('show')) return;
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = 0;
    el.style.transition = 'none';  // kill CSS transition during drag
  }, { passive: true });
  el.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    // Only track horizontal swipes (ignore vertical scrolls)
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();  // prevent page scroll during horizontal swipe
    }
    currentX = dx;
    el.style.transform = 'translateX(' + dx + 'px)';
  }, { passive: false });
  el.addEventListener('touchend', function(e) {
    if (!dragging) return;
    dragging = false;
    el.style.transition = '';  // restore CSS transition
    if (Math.abs(currentX) > 50) {
      // Swiped far enough — dismiss
      clearTimeout(el._t);
      el.classList.remove('show');
      el.style.transform = '';
    } else {
      // Snap back
      el.style.transform = '';
    }
    currentX = 0;
  });
})();

// -- Bottom Sheet (mobile filters drawer) --
(function setupBottomSheet() {
  const sheet = document.getElementById('bottomSheet');
  const overlay = document.getElementById('bottomSheetOverlay');
  const toggleBtn = document.getElementById('filtersToggleBtn');
  const closeBtn = document.getElementById('bottomSheetClose');
  const handle = document.getElementById('bottomSheetHandle');
  const content = document.getElementById('bottomSheetContent');
  const controls = document.getElementById('controls');
  let sheetOpen = false;
  let controlsInSheet = false;

  function isMobile() { return window.innerWidth <= 768; }

  function moveControlsToSheet() {
    if (controlsInSheet) return;
    // Remove 'controls' class so the mobile media query's display:none doesn't hide them
    controls.classList.remove('controls');
    controls.classList.add('bs-controls');
    content.appendChild(controls);
    controlsInSheet = true;
  }

  function moveControlsBack() {
    if (!controlsInSheet) return;
    const kpiGrid = document.getElementById('kpiGrid');
    if (kpiGrid && kpiGrid.parentNode) {
      kpiGrid.parentNode.insertBefore(controls, kpiGrid);
    }
    controls.classList.remove('bs-controls');
    controls.classList.add('controls');
    controlsInSheet = false;
  }

  function openSheet() {
    if (!isMobile()) return;
    moveControlsToSheet();
    sheet.classList.add('open');
    overlay.classList.add('show');
    sheetOpen = true;
  }

  function closeSheet() {
    sheet.classList.remove('open');
    overlay.classList.remove('show');
    sheetOpen = false;
  }

  toggleBtn.addEventListener('click', function() {
    if (sheetOpen) closeSheet(); else openSheet();
  });

  closeBtn.addEventListener('click', closeSheet);
  overlay.addEventListener('click', closeSheet);

  // Swipe-down-to-close (on handle and any touch on sheet surface)
  let sheetStartY = 0, sheetCurrentY = 0, sheetDragging = false;
  function onSheetTouchStart(e) {
    if (!sheetOpen) return;
    // Only start drag if touching the handle or near the top of the sheet
    if (e.target !== handle && e.target.parentNode !== handle && e.target !== sheet) return;
    sheetDragging = true;
    sheetStartY = e.touches[0].clientY;
    sheetCurrentY = 0;
    sheet.style.transition = 'none';
  }
  function onSheetTouchMove(e) {
    if (!sheetDragging) return;
    const dy = e.touches[0].clientY - sheetStartY;
    if (dy < 0) return; // only swipe down
    e.preventDefault();
    sheetCurrentY = dy;
    sheet.style.transform = 'translateY(' + dy + 'px)';
  }
  function onSheetTouchEnd() {
    if (!sheetDragging) return;
    sheetDragging = false;
    sheet.style.transition = '';
    if (sheetCurrentY > 80) {
      closeSheet();
      sheet.style.transform = '';
    } else {
      sheet.style.transform = '';
    }
    sheetCurrentY = 0;
  }

  sheet.addEventListener('touchstart', onSheetTouchStart, { passive: true });
  sheet.addEventListener('touchmove', onSheetTouchMove, { passive: false });
  sheet.addEventListener('touchend', onSheetTouchEnd);

  // Resize: if going to desktop, close sheet and move controls back
  window.addEventListener('resize', function() {
    if (!isMobile() && controlsInSheet) {
      if (sheetOpen) closeSheet();
      moveControlsBack();
    }
  });

  // On load: if mobile, pre-move controls into sheet (hidden until toggled)
  if (isMobile()) {
    moveControlsToSheet();
  }
})();

// -- IndexedDB Persistence --
function idb() { return new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});}

async function saveDB() {
  if (!db) return;
  setStorageStatus('saving');
  const data = db.export();
  const store = (await idb()).transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE);
  await new Promise((resolve, reject) => {
    const req = store.put(data, DB_KEY);
    req.onsuccess = resolve; req.onerror = reject;
  });
  setStorageStatus('saved');
}

async function loadDB() {
  try {
    const store = (await idb()).transaction(IDB_STORE,'readonly').objectStore(IDB_STORE);
    const data = await new Promise((resolve, reject) => {
      const req = store.get(DB_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (data) {
      db = new SQL.Database(new Uint8Array(data));
      return true;
    }
  } catch(e) { console.warn('IndexedDB load failed:', e); }
  db = new SQL.Database();
  return false;
}

function setStorageStatus(s) {
  const dot = document.querySelector('#storageInd .dot');
  const label = document.getElementById('storageLabel');
  dot.className = 'dot';
  if (s === 'saving') { dot.classList.add('saving'); label.textContent = 'saving...'; }
  else if (s === 'saved') { label.textContent = 'saved'; }
  else if (s === 'error') { dot.classList.add('error'); label.textContent = 'error'; }
  else { label.textContent = 'ready'; }
}

// -- Schema --
function initSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, last_upload_at TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL,
    utc_date TEXT NOT NULL, model TEXT NOT NULL, api_key_name TEXT,
    type TEXT NOT NULL, price REAL, amount REAL, upload_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS cost_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL,
    utc_date TEXT NOT NULL, model TEXT NOT NULL, cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD', upload_id TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, filename TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    mode TEXT NOT NULL DEFAULT 'insert', rows_replaced INTEGER DEFAULT 0,
    rows_added INTEGER DEFAULT 0, date_min TEXT, date_max TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_token_ws ON token_usage(workspace_id, utc_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cost_ws ON cost_daily(workspace_id, utc_date)`);
}

// -- Workspace Management --
function getWorkspaces() {
  const rows = [];
  db.each('SELECT * FROM workspaces ORDER BY created_at DESC', {}, (r) => rows.push(r));
  return rows;
}

function createWorkspace(name) {
  const id = genId();
  db.run('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)', [id, name, new Date().toISOString()]);
  saveDB();
  return id;
}

function renameWorkspace(id, name) {
  db.run('UPDATE workspaces SET name = ? WHERE id = ?', [name, id]);
  saveDB();
}

function deleteWorkspace(id) {
  db.run('DELETE FROM token_usage WHERE workspace_id = ?', [id]);
  db.run('DELETE FROM cost_daily WHERE workspace_id = ?', [id]);
  db.run('DELETE FROM uploads WHERE workspace_id = ?', [id]);
  db.run('DELETE FROM workspaces WHERE id = ?', [id]);
  saveDB();
}

function clearWorkspaceData(id) {
  db.run('DELETE FROM token_usage WHERE workspace_id = ?', [id]);
  db.run('DELETE FROM cost_daily WHERE workspace_id = ?', [id]);
  db.run('DELETE FROM uploads WHERE workspace_id = ?', [id]);
  db.run('UPDATE workspaces SET last_upload_at = NULL WHERE id = ?', [id]);
  saveDB();
}

function setupCollapsiblePanel(toggleId, bodyId, chevronId) {
  const toggle = document.getElementById(toggleId);
  const body = document.getElementById(bodyId);
  const chevron = document.getElementById(chevronId);
  let collapsed = window.innerWidth <= 768;
  if (collapsed) { body.classList.add('collapsed'); chevron.classList.add('collapsed'); }
  toggle.addEventListener('click', function() {
    collapsed = !collapsed;
    body.classList.toggle('collapsed', collapsed);
    chevron.classList.toggle('collapsed', collapsed);
  });
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && collapsed) {
      collapsed = false;
      body.classList.remove('collapsed');
      chevron.classList.remove('collapsed');
    } else if (window.innerWidth <= 768 && !collapsed) {
      collapsed = true;
      body.classList.add('collapsed');
      chevron.classList.add('collapsed');
    }
  });
}

// -- CSV Parser --
// Character-by-character parser. Handles:
//   - Quoted fields with embedded commas
//   - Quoted fields with embedded newlines (multi-line fields)
//   - Escaped double quotes inside quoted fields ("")
//   - BOM prefix stripping
//   - Row length mismatch detection (skips malformed rows)
//   - Mixed \r\n, \r, and \n line endings
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');               // strip BOM
  if (!text.trim()) return [];

  const rows = [];
  const vals = [];
  let cur = '', inQ = false;
  let headers = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQ) {
      if (ch === '"') {
        // Escaped quote: "" inside quoted field → literal "
        if (i + 1 < text.length && text[i + 1] === '"') {
          cur += '"';
          i++;                                        // skip second quote
        } else {
          inQ = false;                                // closing quote
        }
      } else {
        cur += ch;                                    // newlines, commas, everything kept
      }
    } else {
      if (ch === '"') {
        inQ = true;                                   // opening quote
      } else if (ch === ',') {
        vals.push(cur.trim());
        cur = '';
      } else if (ch === '\r') {
        // \r\n or standalone \r → row terminator
        if (i + 1 < text.length && text[i + 1] === '\n') i++;
        vals.push(cur.trim());
        cur = '';
        if (!headers) {
          headers = vals.slice();                    // first row = headers
        } else if (vals.length === headers.length) {
          const row = {}; headers.forEach((h, j) => row[h] = vals[j]); rows.push(row);
        }
        vals.length = 0;
      } else if (ch === '\n') {
        // standalone \n → row terminator
        vals.push(cur.trim());
        cur = '';
        if (!headers) {
          headers = vals.slice();
        } else if (vals.length === headers.length) {
          const row = {}; headers.forEach((h, j) => row[h] = vals[j]); rows.push(row);
        }
        vals.length = 0;
      } else {
        cur += ch;
      }
    }
  }

  // Handle last field/row when file doesn't end with newline
  if (cur || vals.length > 0) {
    vals.push(cur.trim());
    if (headers && vals.length === headers.length && vals.some(v => v !== '')) {
      const row = {}; headers.forEach((h, j) => row[h] = vals[j]); rows.push(row);
    }
  }

  return rows;
}

// -- Core file processing (no UI, no refreshAll) --
async function _processSingleFile(file) {
  const zip = await JSZip.loadAsync(file);
  let amountRows = [], costRows = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const text = await entry.async('text');
    if (name.startsWith('amount-')) amountRows = amountRows.concat(parseCSV(text));
    else if (name.startsWith('cost-')) costRows = costRows.concat(parseCSV(text));
    else if (name.endsWith('.csv')) {
      if (text.includes('input_cache')) amountRows = amountRows.concat(parseCSV(text));
      else if (text.includes('wallet_type')) costRows = costRows.concat(parseCSV(text));
    }
  }

  if (!amountRows.length && !costRows.length) throw new Error('No CSV data found in ZIP');

  // Detect date range
  const dates = new Set();
  amountRows.forEach(r => { if (r.utc_date) dates.add(r.utc_date); });
  costRows.forEach(r => { if (r.utc_date) dates.add(r.utc_date); });
  const dateArr = [...dates].sort();
  const dateMin = dateArr[0], dateMax = dateArr[dateArr.length-1];

  // Diff detection: check for overlapping date ranges (not just exact match)
  const existing = db.exec(
    `SELECT COUNT(*) as cnt FROM uploads WHERE workspace_id = ? AND NOT (date_max < ? OR date_min > ?)`,
    [activeWsId, dateMin, dateMax]);
  const hasExisting = existing.length > 0 && existing[0].values[0][0] > 0;

  const uploadId = genId();
  const mode = hasExisting ? 'replace' : 'insert';
  let rowsReplaced = 0;

  if (hasExisting) {
    // Count existing rows before deleting (SQL.js DELETE returns no rows)
    const cntBefore = db.exec(
      `SELECT COUNT(*) as cnt FROM token_usage WHERE workspace_id = ? AND utc_date >= ? AND utc_date <= ?`,
      [activeWsId, dateMin, dateMax]);
    rowsReplaced = (cntBefore.length && cntBefore[0].values.length ? cntBefore[0].values[0][0] : 0);

    // Delete old data for the overlapping date range
    db.exec(`DELETE FROM token_usage WHERE workspace_id = ? AND utc_date >= ? AND utc_date <= ?`, [activeWsId, dateMin, dateMax]);
    db.exec(`DELETE FROM cost_daily WHERE workspace_id = ? AND utc_date >= ? AND utc_date <= ?`, [activeWsId, dateMin, dateMax]);
    // Remove old upload records that overlap with this date range
    db.run(`DELETE FROM uploads WHERE workspace_id = ? AND NOT (date_max < ? OR date_min > ?)`,
      [activeWsId, dateMin, dateMax]);
  }

  // Insert token rows
  const stmtTok = db.prepare('INSERT INTO token_usage (workspace_id, utc_date, model, api_key_name, type, price, amount, upload_id) VALUES (?,?,?,?,?,?,?,?)');
  let tokenCount = 0;
  for (const r of amountRows) {
    if (!r.utc_date || !r.model || !r.type || r.type === 'type') continue;
    stmtTok.run([activeWsId, r.utc_date, r.model, r.api_key_name||'', r.type,
                 parseFloat(r.price)||0, parseFloat(r.amount)||0, uploadId]);
    tokenCount++;
  }
  stmtTok.free();

  // Insert cost rows
  const stmtCost = db.prepare('INSERT INTO cost_daily (workspace_id, utc_date, model, cost, currency, upload_id) VALUES (?,?,?,?,?,?)');
  let costCount = 0;
  for (const r of costRows) {
    if (!r.utc_date || !r.model) continue;
    stmtCost.run([activeWsId, r.utc_date, r.model, parseFloat(r.cost)||0, r.currency||'USD', uploadId]);
    costCount++;
  }
  stmtCost.free();

  // Record upload
  db.run('INSERT INTO uploads (id, workspace_id, filename, uploaded_at, mode, rows_replaced, rows_added, date_min, date_max) VALUES (?,?,?,?,?,?,?,?,?)',
    [uploadId, activeWsId, file.name, new Date().toISOString(), mode, rowsReplaced, tokenCount+costCount, dateMin, dateMax]);

  // Update workspace
  db.run('UPDATE workspaces SET last_upload_at = ? WHERE id = ?', [new Date().toISOString(), activeWsId]);

  await saveDB();
  return { success: true, message: `${mode === 'replace' ? 'Updated' : 'Added'} ${fmtNum(tokenCount)} rows · ${dateMin} → ${dateMax}`, file: file.name };
}

// -- Upload Processing (single file, backward compatible) --
async function handleUpload(file) {
  const ext = file.name.toLowerCase().endsWith('.zip');
  const mime = file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!ext && !mime) { toast('Please select a .zip file', true); return; }
  if (!activeWsId) { toast('Create a workspace first', true); return; }

  const dz = document.getElementById('dropZone');
  dz.classList.add('processing');
  dz.querySelector('.drop-title').textContent = 'Processing...';

  try {
    const result = await _processSingleFile(file);
    toast(result.message);
  } catch(e) {
    toast('Error: ' + e.message, true);
    console.error(e);
  }

  dz.classList.remove('processing');
  dz.querySelector('.drop-title').textContent = 'Drop DeepSeek usage ZIP here';
  await refreshAll();
}

// -- Multiple file upload --
async function handleMultipleUpload(files) {
  if (!files || files.length === 0) return;
  if (!activeWsId) { toast('Create a workspace first', true); return; }

  const dz = document.getElementById('dropZone');
  dz.classList.add('processing');

  // Filter to only .zip files (check extension and MIME type)
  const fileArray = [];
  for (let i = 0; i < files.length; i++) {
    const ext = files[i].name.toLowerCase().endsWith('.zip');
    const mime = files[i].type === 'application/zip' || files[i].type === 'application/x-zip-compressed';
    if (ext || mime) fileArray.push(files[i]);
  }

  if (fileArray.length === 0) {
    toast('No .zip files found', true);
    dz.classList.remove('processing');
    return;
  }

  let successCount = 0, failCount = 0;

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    dz.querySelector('.drop-title').textContent = `Processing file ${i+1} of ${fileArray.length}: ${file.name}`;

    try {
      const result = await _processSingleFile(file);
      toast(result.message);
      successCount++;
    } catch(e) {
      toast(`Error: ${file.name} — ${e.message}`, true);
      console.error(e);
      failCount++;
    }
  }

  dz.classList.remove('processing');
  dz.querySelector('.drop-title').textContent = 'Drop DeepSeek usage ZIP here';

  if (failCount > 0) {
    toast(`Done: ${successCount} succeeded, ${failCount} failed`);
  }

  await refreshAll();
}

// -- Data Querying --
function queryPeriod(period) {
  if (period === 'all') return ['2000-01-01', '2099-12-31'];
  if (period === '7d') {
    const d = new Date(); d.setDate(d.getDate()-7);
    return [d.toISOString().slice(0,10), new Date().toISOString().slice(0,10)];
  }
  if (period === '30d') {
    const d = new Date(); d.setDate(d.getDate()-30);
    return [d.toISOString().slice(0,10), new Date().toISOString().slice(0,10)];
  }
  if (period.startsWith('month-')) {
    const [y,m] = period.replace('month-','').split('-');
    const start = `${y}-${m}-01`;
    const end = `${y}-${String(m).padStart(2,'0')}-${new Date(Number(y),Number(m),0).getDate()}`;
    return [start, end];
  }
  return ['1','1'];
}

function getDailyData(period, model) {
  const [start, end] = queryPeriod(period);
  let where = 'workspace_id = ? AND utc_date >= ? AND utc_date <= ?';
  const params = [activeWsId, start, end];
  if (model && model !== 'all') { where += ' AND model = ?'; params.push(model); }

  // Aggregate token_usage
  const days = {};
  const tuRows = db.exec(`SELECT utc_date, model, type, SUM(amount) as total_amount, SUM(price*amount) as total_cost FROM token_usage WHERE ${where} GROUP BY utc_date, model, type`, params);
  if (tuRows.length) {
    for (const row of tuRows[0].values) {
      const [date, mdl, typ, amount, cost] = row;
      if (!days[date]) days[date] = {date, cost_tokens:0, cost_csv:0, total_tokens:0, cache_hit:0, cache_miss:0,
                                      output:0, prompt:0, requests:0, byModel:{}};
      days[date].cost_tokens += Number(cost||0);
      days[date].total_tokens += Number(amount||0);
      if (typ === 'input_cache_hit_tokens') days[date].cache_hit += Number(amount||0);
      if (typ === 'input_cache_miss_tokens') days[date].cache_miss += Number(amount||0);
      if (typ === 'output_tokens') days[date].output += Number(amount||0);
      if (typ.startsWith('input')) days[date].prompt += Number(amount||0);
      if (typ === 'request_count') days[date].requests += Number(amount||0);
      if (!days[date].byModel[mdl]) days[date].byModel[mdl] = {cost:0, tokens:0, cache_hit:0, cache_miss:0, output:0, requests:0, input_cost:0, output_cost:0};
      days[date].byModel[mdl].cost += Number(cost||0);
      days[date].byModel[mdl].tokens += Number(amount||0);
      if (typ === 'input_cache_hit_tokens') days[date].byModel[mdl].cache_hit += Number(amount||0);
      if (typ === 'input_cache_miss_tokens') days[date].byModel[mdl].cache_miss += Number(amount||0);
      if (typ === 'output_tokens') days[date].byModel[mdl].output += Number(amount||0);
      if (typ === 'request_count') days[date].byModel[mdl].requests += Number(amount||0);
      if (typ.startsWith('input')) days[date].byModel[mdl].input_cost += Number(cost||0);
      if (typ === 'output_tokens') days[date].byModel[mdl].output_cost += Number(cost||0);
    }
  }

  // Merge cost_daily
  const cdRows = db.exec(`SELECT utc_date, model, SUM(cost) as total_cost FROM cost_daily WHERE ${where} GROUP BY utc_date, model`, params);
  if (cdRows.length) {
    for (const row of cdRows[0].values) {
      const [date, mdl, cost] = row;
      if (!days[date]) days[date] = {date, cost_tokens:0, cost_csv:0, total_tokens:0, cache_hit:0, cache_miss:0,
                                      output:0, prompt:0, requests:0, byModel:{}};
      days[date].cost_csv += Number(cost||0);
      if (!days[date].byModel[mdl]) days[date].byModel[mdl] = {cost:0, tokens:0, cache_hit:0, cache_miss:0, output:0, requests:0};
      days[date].byModel[mdl].cost += Number(cost||0);
    }
  }

  return Object.values(days).sort((a,b) => a.date.localeCompare(b.date));
}

const GRANULARITY_LS_KEY = 'ds-dash-granularity';

function getISOWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7; // 1=Mon..7=Sun
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function groupDays(days, granularity) {
  if (!days || !days.length || granularity === 'daily') return days;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const groups = {};
  for (const d of days) {
    let key, label;
    if (granularity === 'weekly') {
      key = getISOWeekStart(d.date);
      const monday = new Date(key + 'T00:00:00');
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const sm = MONTHS[monday.getMonth()];
      const em = MONTHS[sunday.getMonth()];
      label = sm === em
        ? `${sm} ${monday.getDate()}-${sunday.getDate()}`
        : `${sm} ${monday.getDate()} - ${em} ${sunday.getDate()}`;
    } else if (granularity === 'monthly') {
      key = d.date.slice(0, 7);
      const [y, m] = key.split('-');
      label = `${MONTHS[parseInt(m)-1]} ${y}`;
    }
    if (!groups[key]) {
      groups[key] = { label, date: d.date, cost_tokens: 0, cost_csv: 0, total_tokens: 0, cache_hit: 0, cache_miss: 0, output: 0, prompt: 0, requests: 0, byModel: {} };
    }
    const g = groups[key];
    g.cost_tokens += d.cost_tokens;
    g.cost_csv += d.cost_csv;
    g.total_tokens += d.total_tokens;
    g.cache_hit += d.cache_hit;
    g.cache_miss += d.cache_miss;
    g.output += d.output;
    g.prompt += d.prompt;
    g.requests += d.requests;
    for (const [model, v] of Object.entries(d.byModel)) {
      if (!g.byModel[model]) g.byModel[model] = { cost:0, tokens:0, cache_hit:0, cache_miss:0, output:0, requests:0, input_cost:0, output_cost:0 };
      g.byModel[model].cost += v.cost;
      g.byModel[model].tokens += v.tokens;
      g.byModel[model].cache_hit += v.cache_hit;
      g.byModel[model].cache_miss += v.cache_miss;
      g.byModel[model].output += v.output;
      g.byModel[model].requests += v.requests;
      g.byModel[model].input_cost += (v.input_cost || 0);
      g.byModel[model].output_cost += (v.output_cost || 0);
    }
  }
  return Object.values(groups).sort((a,b) => a.date.localeCompare(b.date));
}

function getModels() {
  const r = db.exec('SELECT DISTINCT model FROM token_usage WHERE workspace_id = ? UNION SELECT DISTINCT model FROM cost_daily WHERE workspace_id = ?', [activeWsId, activeWsId]);
  return r.length ? r[0].values.map(v => v[0]).sort() : [];
}

function getKeys() {
  const r = db.exec('SELECT DISTINCT api_key_name FROM token_usage WHERE workspace_id = ? AND api_key_name != ""', [activeWsId]);
  return r.length ? r[0].values.map(v => v[0]).sort() : [];
}

function getUploads() {
  const r = db.exec('SELECT * FROM uploads WHERE workspace_id = ? ORDER BY uploaded_at DESC LIMIT 20', [activeWsId]);
  return r.length ? r[0].values.map(v => ({id:v[0], workspace_id:v[1], filename:v[2], uploaded_at:v[3], mode:v[4], rows_replaced:v[5], rows_added:v[6], date_min:v[7], date_max:v[8]})) : [];
}

// -- Rendering --
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function downloadChart(chartKey, chartType) {
  const chart = charts[chartKey];
  if (!chart) return;
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  const days = _groupedDays.length ? _groupedDays : _currentDays;
  const startDate = days.length ? (days[0]?.label || days[0]?.date || 'unknown') : 'unknown';
  const endDate = days.length ? (days[days.length-1]?.label || days[days.length-1]?.date || 'unknown') : 'unknown';
  const url = chart.toBase64Image('image/png', 1);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chartType}_${granularity}_${startDate}_${endDate}.png`;
  a.click();
}

let refreshTimeout;
async function refreshAll() {
  clearTimeout(refreshTimeout);
  if (!activeWsId) return;
  const period = document.getElementById('periodSelect').value || 'all';
  const modelFilter = document.getElementById('modelSelect').value || 'all';

  const days = getDailyData(period, modelFilter);
  _currentDays = days;
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  const chartDays = groupDays(days, granularity);
  _groupedDays = chartDays;
  if (!days.length) {
    document.getElementById('kpiGrid').innerHTML = '<div style="color:var(--text-dim);padding:20px">No data yet — drag in a DeepSeek usage ZIP</div>';
    ['tokens','spend','modelPie','ratio','key','modelDist'].forEach(k => destroyChart(k));
    document.getElementById('topSpend').innerHTML = '';
    return;
  }

  // KPI
  const totalCost = days.reduce((s,d) => s + (d.cost_csv || d.cost_tokens), 0);
  const totalTokens = days.reduce((s,d) => s + d.total_tokens, 0);
  const totalPrompt = days.reduce((s,d) => s + d.prompt, 0);
  const totalOutput = days.reduce((s,d) => s + d.output, 0);
  const totalRequests = days.reduce((s,d) => s + d.requests, 0);
  const avgDaily = days.length > 0 ? totalCost / days.length : 0;
  const ioRatio = totalPrompt > 0 ? (totalOutput / totalPrompt * 100).toFixed(1) + '%' : '—';
  const inputPct = totalTokens > 0 ? (totalPrompt/totalTokens*100).toFixed(1) : '0.0';
  const outputPct = totalTokens > 0 ? (totalOutput/totalTokens*100).toFixed(1) : '0.0';

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card spend"><div class="label">Total Cost</div><div class="value">${fmtUSD(totalCost)}</div><div class="sub">${days[0]?.date||'—'} → ${days[days.length-1]?.date||'—'}</div></div>
    <div class="kpi-card tokens"><div class="label">Input Tokens</div><div class="value" style="color:var(--accent)">${fmtTok(totalPrompt)}</div><div class="sub">${inputPct}% of total</div></div>
    <div class="kpi-card output"><div class="label">Output Tokens</div><div class="value" style="color:var(--cyan)">${fmtTok(totalOutput)}</div><div class="sub">${outputPct}% of total</div></div>
    <div class="kpi-card keys"><div class="label">Output / Input Ratio</div><div class="value">${ioRatio}</div><div class="sub">${fmtNum(totalRequests)} requests · ~${fmtNum(Math.round(totalRequests/Math.max(days.length,1)))}/day</div></div>
    <div class="kpi-card models"><div class="label">Avg Daily Cost</div><div class="value">${fmtUSD(avgDaily)}</div><div class="sub">${days.length} days of data</div></div>
  `;

  // Update period select with available months
  const periodSel = document.getElementById('periodSelect');
  const curPeriod = periodSel.value;
  const months = new Set(days.map(d => d.date.slice(0,7)));
  periodSel.innerHTML = '<option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option>';
  [...months].sort().reverse().forEach(m => {
    const [y,mo] = m.split('-');
    periodSel.innerHTML += `<option value="month-${m}">${new Date(y,mo-1).toLocaleDateString('en-US',{year:'numeric',month:'long'})}</option>`;
  });
  periodSel.value = periodSel.querySelector(`option[value="${curPeriod}"]`) ? curPeriod : 'all';

  // Charts
  renderTokenChart(chartDays);
  renderModelDistChart(chartDays);
  renderSpendChart(chartDays);
  renderModelPie(chartDays);
  renderRatioChart(chartDays);
  renderTopSpend(chartDays);
  renderKeyChart(chartDays);

  // Anomaly Detection
  const prefs = loadAnomalyPrefs();
  document.getElementById('thresholdSlider').value = prefs.threshold;
  document.getElementById('thresholdLabel').textContent = prefs.threshold.toFixed(1);
  document.getElementById('chkCost').checked = prefs.cost;
  document.getElementById('chkTokens').checked = prefs.tokens;
  document.getElementById('chkRequests').checked = prefs.requests;
  _anomalyCache = detectAnomalies(days, prefs.threshold, prefs);
  renderAnomalyPanel(_anomalyCache);
  // Charts will re-render with anomaly markers when charts are drawn above

  // Rate Limit Monitor
  runRateLimitCheck();

  // Wire up chart download buttons
  document.querySelectorAll('.chart-dl-btn').forEach(btn => {
    btn.onclick = () => downloadChart(btn.dataset.chart, btn.dataset.type);
  });

  // Refresh models/keys dropdowns
  const modelSel = document.getElementById('modelSelect');
  const models = getModels();
  modelSel.innerHTML = '<option value="all">All Models</option>' + models.map(m => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join('');
  modelSel.value = models.includes(modelFilter) ? modelFilter : 'all';

  const keySel = document.getElementById('keySelect');
  const keys = getKeys();
  keySel.innerHTML = '<option value="all">All Keys</option>' + keys.map(k => '<option value="' + escapeHtml(k) + '">' + escapeHtml(k) + '</option>').join('');

  // Refresh upload history
  renderUploadHistory();

  // Refresh raw data table
  renderTable(days, modelFilter);
}

function isMobileChart() { return window.innerWidth <= 768; }

function chartFontSize() { return isMobileChart() ? 8 : 9; }
function chartGridColor() { return document.documentElement.getAttribute('data-theme') === 'light' ? '#d0d7de' : '#21262d'; }
function chartTickColor() { return document.documentElement.getAttribute('data-theme') === 'light' ? '#656d76' : '#8b949e'; }

function chartTooltipOptions() {
  return {
    backgroundColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#161b22',
    titleColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#1f2328' : '#f0f6fc',
    bodyColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#24292f' : '#e6edf3',
    borderColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#d0d7de' : '#30363d',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 6,
    displayColors: true,
    titleFont: { size: 12, weight: '600' },
    bodyFont: { size: 12 }
  };
}

function chartLegendOptions() {
  return { labels: { color: chartTickColor(), usePointStyle: true, padding: 14, font: { size: chartFontSize() } } };
}

function chartScalesOptions(yTitle, yTickFormatter) {
  const tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  return {
    x: { ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
    y: { ticks: { ...tick, callback: yTickFormatter }, grid: { color: chartGridColor() }, title: yTitle ? { display: true, text: yTitle, color: chartTickColor(), font: { size: chartFontSize() } } : undefined }
  };
}

function chartCommonOptions() {
  return {
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } },
    animation: { duration: 400 }
  };
}

function renderTokenChart(days) {
  destroyChart('tokens');
  const ctx = document.getElementById('cTokens').getContext('2d');
  const inputColor = '#4c6ef5';
  const outputColor = '#39d2c0';
  const datasets = [
    { label: 'Input Tokens', data: days.map(d => d.cache_hit + d.cache_miss), borderColor: inputColor, backgroundColor: 'rgba(76,110,245,0.15)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, hoverBorderWidth: 2 },
    { label: 'Output Tokens', data: days.map(d => d.output), borderColor: outputColor, backgroundColor: 'rgba(57,210,192,0.12)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, hoverBorderWidth: 2 },
  ];

  // Anomaly scatter overlay
  if (_anomalyCache && _anomalyCache.dates.size && document.getElementById('granularitySelect')?.value === 'daily') {
    const anomalyPts = [];
    const maxVal = Math.max(...days.map(d => d.cache_hit + d.cache_miss + d.output)) * 1.08;
    days.forEach((d, i) => { if (_anomalyCache.dates.has(d.date)) anomalyPts.push({x: i, y: maxVal}); });
    if (anomalyPts.length) {
      datasets.push({
        type: 'scatter',
        label: 'Anomaly',
        data: anomalyPts,
        pointBackgroundColor: 'rgba(248,81,73,0.9)',
        pointBorderColor: '#f85149',
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBorderWidth: 2,
        showLine: false,
        order: 2
      });
    }
  }

  charts.tokens = new Chart(ctx, {
    type: 'line',
    data: { labels: days.map(d => d.label || fmtDate(d.date)), datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 2.2,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: chartLegendOptions(), tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtTok(ctx.parsed.y) + ' tokens' } } },
      scales: chartScalesOptions('Tokens', v => fmtTok(v))
    }
  });
}

function renderModelDistChart(days) {
  destroyChart('modelDist');
  const ctx = document.getElementById('cModelDist').getContext('2d');
  const labels = days.map(d => d.label || fmtDate(d.date));
  const models = [...new Set(days.flatMap(d => Object.keys(d.byModel)))];
  const baseColors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950','#f778ba','#79c0ff','#d2a8ff','#ffa657','#56d364','#db6d28'];

  const datasets = models.map((m, i) => {
    const base = baseColors[i % baseColors.length];
    return {
      label: m,
      data: days.map(d => d.byModel[m]?.tokens || 0),
      borderColor: base,
      backgroundColor: base + '40',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      hoverBorderWidth: 2,
    };
  });

  const tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  charts.modelDist = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 2.2,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: chartLegendOptions(),
        tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtTok(ctx.parsed.y) + ' tokens' } }
      },
      scales: {
        x: { stacked: true, ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
        y: { stacked: true, ticks: { ...tick, callback: v => fmtTok(v) }, grid: { color: chartGridColor() }, title: { display: true, text: 'Tokens', color: chartTickColor(), font: { size: chartFontSize() } } }
      }
    }
  });
}

function renderSpendChart(days) {
  destroyChart('spend');
  const ctx = document.getElementById('cSpend').getContext('2d');
  const labels = days.map(d => d.label || fmtDate(d.date));
  const models = [...new Set(days.flatMap(d => Object.keys(d.byModel)))];
  const baseColors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950'];
  const datasets = [];
  models.forEach((m, i) => {
    const base = baseColors[i % baseColors.length];
    datasets.push({
      label: m + ' Input Cost',
      data: days.map(d => d.byModel[m]?.input_cost || 0),
      backgroundColor: base,
      borderRadius: 4,
      borderSkipped: false,
      hoverBackgroundColor: base + 'dd',
      stack: 'input'
    });
    datasets.push({
      label: m + ' Output Cost',
      data: days.map(d => d.byModel[m]?.output_cost || 0),
      backgroundColor: base + '88',
      borderRadius: 4,
      borderSkipped: false,
      hoverBackgroundColor: base + 'cc',
      stack: 'output'
    });
  });

  // Anomaly scatter overlay
  if (_anomalyCache && _anomalyCache.dates.size && document.getElementById('granularitySelect')?.value === 'daily') {
    const anomalyPts = [];
    const maxVal = Math.max(...days.map(d => d.cost_csv || d.cost_tokens)) * 1.08;
    days.forEach((d, i) => { if (_anomalyCache.dates.has(d.date)) anomalyPts.push({x: i, y: maxVal}); });
    if (anomalyPts.length) {
      datasets.push({
        type: 'scatter',
        label: 'Anomaly',
        data: anomalyPts,
        pointBackgroundColor: 'rgba(248,81,73,0.9)',
        pointBorderColor: '#f85149',
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBorderWidth: 2,
        showLine: false,
        order: 2
      });
    }
  }

  const tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  charts.spend = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 1.6,
      plugins: { legend: { labels: { color: chartTickColor(), usePointStyle: true, padding: 8, font: { size: chartFontSize() } } },
        tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtUSD(ctx.parsed.y) } } },
      scales: {
        x: { stacked: true, ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
        y: { stacked: true, ticks: { ...tick, callback: v => fmtUSD(v) }, grid: { color: chartGridColor() } }
      }
    }
  });
}

function renderModelPie(days) {
  destroyChart('modelPie');
  const ctx = document.getElementById('cModelPie').getContext('2d');
  const mc = {}; days.forEach(d => Object.entries(d.byModel).forEach(([m,v]) => mc[m] = (mc[m]||0) + v.cost));
  const entries = Object.entries(mc).sort((a,b) => b[1] - a[1]);
  const colors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950'];
  const borderColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#161b22';
  charts.modelPie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_,i) => colors[i%colors.length]), borderColor: borderColor, borderWidth: 2, hoverOffset: 6 }] },
    options: {
      ...chartCommonOptions(), aspectRatio: 1.4,
      plugins: {
        legend: { position: 'bottom', labels: { color: chartTickColor(), padding: 10, font: { size: chartFontSize() },
          generateLabels: function(chart) {
            return chart.data.labels.map((l,i) => ({ text: l + ' (' + fmtUSD(chart.data.datasets[0].data[i]) + ')',
              fillStyle: chart.data.datasets[0].backgroundColor[i], strokeStyle: chart.data.datasets[0].backgroundColor[i], index: i }));
          }
        }},
        tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => ctx.label + ': ' + fmtUSD(ctx.parsed) } }
      }
    }
  });
}

function renderRatioChart(days) {
  destroyChart('ratio');
  const tp = days.reduce((s,d) => s + d.prompt, 0);
  const to = days.reduce((s,d) => s + d.output, 0);
  const ctx = document.getElementById('cRatio').getContext('2d');
  const borderColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#161b22';
  charts.ratio = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Input Tokens', 'Output Tokens'], datasets: [{ data: [tp, to], backgroundColor: ['#4c6ef5','#39d2c0'], borderColor: borderColor, borderWidth: 2, hoverOffset: 6 }] },
    options: {
      ...chartCommonOptions(), aspectRatio: 1.4,
      plugins: {
        legend: { position: 'bottom', labels: { color: chartTickColor(), padding: 10, font: { size: chartFontSize() },
          generateLabels: function(chart) {
            return chart.data.labels.map((l,i) => ({ text: l + ': ' + fmtTok(chart.data.datasets[0].data[i]),
              fillStyle: chart.data.datasets[0].backgroundColor[i], strokeStyle: chart.data.datasets[0].backgroundColor[i], index: i }));
          }
        }},
        tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => ctx.label + ': ' + fmtTok(ctx.parsed) + ' (' + (ctx.parsed/(tp+to)*100).toFixed(1) + '%)' } }
      }
    }
  });
}

function renderTopSpend(days) {
  const sorted = [...days].sort((a,b) => (b.cost_csv||b.cost_tokens) - (a.cost_csv||a.cost_tokens)).slice(0,10);
  document.getElementById('topSpend').innerHTML = sorted.map((d,i) =>
    `<li><span class="rank">#${i+1}</span><span class="date">${d.label || fmtDate(d.date)}</span><span class="amount">${fmtUSD(d.cost_csv||d.cost_tokens)}</span></li>`
  ).join('');
}

function renderKeyChart(days) {
  destroyChart('key');
  if (!activeWsId) return;

  // Get per-key costs from DB
  const r = db.exec(`SELECT api_key_name, SUM(price*amount) as total_cost FROM token_usage WHERE workspace_id = ? AND type != 'request_count' GROUP BY api_key_name ORDER BY total_cost DESC`, [activeWsId]);
  if (!r.length) return;

  const entries = r[0].values.filter(v => v[0]).slice(0, 12);
  const colors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950','#f778ba','#79c0ff','#d2a8ff','#ffa657','#56d364','#db6d28'];
  const ctx = document.getElementById('cKey').getContext('2d');
  const tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  charts.key = new Chart(ctx, {
    type: 'bar',
    data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => Number(e[1])), backgroundColor: entries.map((_,i) => colors[i%colors.length]), borderRadius: 4, borderSkipped: false, hoverBackgroundColor: entries.map((_,i) => colors[i%colors.length] + 'dd') }] },
    options: {
      ...chartCommonOptions(), indexAxis: 'y', aspectRatio: 1.4,
      plugins: { legend: { display: false }, tooltip: { ...chartTooltipOptions(), callbacks: { label: ctx => fmtUSD(ctx.parsed.x) } } },
      scales: {
        x: { ticks: { ...tick, callback: v => fmtUSD(v) }, grid: { color: chartGridColor() } },
        y: { ticks: { ...tick }, grid: { display: false } }
      }
    }
  });
}

function renderUploadHistory() {
  const uploads = getUploads();
  const card = document.getElementById('historyCard');
  if (!uploads.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('historyList').innerHTML = uploads.map(u => {
    const dt = new Date(u.uploaded_at);
    const timeAgo = Math.round((Date.now() - dt.getTime()) / 60000);
    return `<div class="history-item">
      <span class="hi-name">${escapeHtml(u.filename)} <span style="color:var(--text-dim);font-size:0.7rem">${u.mode === 'replace' ? '(updated)' : '(new)'}</span></span>
      <span class="hi-meta">${fmtNum(u.rows_added)} rows · ${u.date_min}→${u.date_max} · ${timeAgo < 60 ? timeAgo+'m ago' : Math.round(timeAgo/60)+'h ago'}</span>
    </div>`;
  }).join('');
}

// -- Anomaly Detection --

const ANOMALY_DEFAULTS = {threshold: 2.0, cost: true, tokens: true, requests: true};

function loadAnomalyPrefs() {
  try { return Object.assign({}, ANOMALY_DEFAULTS, JSON.parse(localStorage.getItem(ANOMALY_LS_KEY))); }
  catch(e) { return Object.assign({}, ANOMALY_DEFAULTS); }
}

function saveAnomalyPrefs(prefs) {
  try { localStorage.setItem(ANOMALY_LS_KEY, JSON.stringify(prefs)); } catch(e) {}
}

function detectAnomalies(days, threshold, metrics) {
  if (!days || !days.length) return {items: [], dates: new Set()};
  const items = [];
  const dates = new Set();

  function _zTest(vals, label) {
    const n = vals.length;
    const mean = vals.reduce((s,v) => s+v, 0) / n;
    const std = Math.sqrt(vals.reduce((s,v) => s+(v-mean)*(v-mean), 0) / n);
    if (std < 1e-12) return;
    vals.forEach((v, i) => {
      const z = Math.abs((v - mean) / std);
      if (z > threshold) {
        items.push({date: days[i].date, metric: label, value: v, zScore: z});
        dates.add(days[i].date);
      }
    });
  }

  if (metrics.cost) _zTest(days.map(d => d.cost_csv || d.cost_tokens), 'Cost');
  if (metrics.tokens) _zTest(days.map(d => d.total_tokens), 'Tokens');
  if (metrics.requests) _zTest(days.map(d => d.requests), 'Requests');

  items.sort((a,b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
  return {items, dates};
}

function renderAnomalyPanel(anomalies) {
  const badge = document.getElementById('anomalyBadge');
  const list = document.getElementById('anomalyList');
  const count = anomalies.items.length;

  badge.textContent = count;
  badge.classList.toggle('zero', count === 0);

  if (!count) {
    list.innerHTML = '<div class="anomaly-empty">No anomalies detected</div>';
    return;
  }

  list.innerHTML = anomalies.items.map(a => {
    const label = a.metric === 'Cost' ? fmtUSD(a.value)
      : a.metric === 'Tokens' ? fmtTok(a.value)
      : fmtNum(a.value);
    return '<div class="anomaly-item">\n' +
      '      <span class="a-date">' + escapeHtml(a.date) + '</span>\n' +
      '      <span class="a-metric">' + escapeHtml(a.metric) + '</span>\n' +
      '      <span class="a-value">' + label + '</span>\n' +
      '      <span class="a-zscore">z=' + a.zScore.toFixed(2) + '</span>\n' +
      '    </div>';
  }).join('');
}

// -- Rate Limit Monitor --
const RATE_LS_KEY = 'ds-dash-rate-prefs';
const RATE_DEFAULTS = {tier: 'free', customRpm: 10, customDay: 14400};
const RATE_TIER_LIMITS = {free: {rpm: 10, day: 14400}, paid: {rpm: 500, day: 720000}, enterprise: {rpm: 5000, day: 7200000}};

function loadRatePrefs() {
  try { return Object.assign({}, RATE_DEFAULTS, JSON.parse(localStorage.getItem(RATE_LS_KEY))); }
  catch(e) { return Object.assign({}, RATE_DEFAULTS); }
}
function saveRatePrefs(prefs) {
  try { localStorage.setItem(RATE_LS_KEY, JSON.stringify(prefs)); } catch(e) {}
}

function getRateLimits(tier, customRpm, customDay) {
  if (tier === 'custom') return {rpm: Math.max(1, customRpm||1), day: Math.max(1, customDay||1)};
  return RATE_TIER_LIMITS[tier] || RATE_TIER_LIMITS.free;
}

function computeRateMetrics(days) {
  if (!days || !days.length) return null;
  const totalReq = days.reduce((s, d) => s + (d.requests || 0), 0);
  const avgDay = totalReq / days.length;
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  const isDaily = granularity === 'daily';

  // Find peak day
  let peakDay = null, peakReq = 0;
  days.forEach(d => {
    const r = d.requests || 0;
    if (r > peakReq) { peakReq = r; peakDay = d.date; }
  });

  // Top 5 request days
  const sorted = [...days].sort((a, b) => (b.requests||0) - (a.requests||0)).slice(0, 5);

  return { totalReq, avgDay, isDaily, peakDay, peakReq, topDays: sorted };
}

function renderRatePanel(metrics) {
  const prefs = loadRatePrefs();
  const limits = getRateLimits(prefs.tier, prefs.customRpm, prefs.customDay);

  // Update tier selector
  document.getElementById('rateTierSelect').value = prefs.tier;
  document.getElementById('rateCustomInputs').classList.toggle('show', prefs.tier === 'custom');
  document.getElementById('rateCustomRpm').value = prefs.customRpm;
  document.getElementById('rateCustomDay').value = prefs.customDay;

  if (!metrics) {
    document.getElementById('rTotalReq').textContent = '0';
    document.getElementById('rAvgDay').textContent = '0';
    document.getElementById('rEstRpm').textContent = '—';
    document.getElementById('rPeakDay').textContent = '—';
    document.getElementById('rateGaugeFill').style.width = '0%';
    document.getElementById('rateGaugeFill').className = 'rate-gauge-fill green';
    document.getElementById('rateGaugeLabel').textContent = '0%';
    document.getElementById('rateTopDays').innerHTML = '<li style="color:var(--text-dim);font-size:0.78rem;padding:4px 0">No data</li>';
    document.getElementById('rateBadge').textContent = '\u26AA';
    return;
  }

  // Metrics
  document.getElementById('rTotalReq').textContent = fmtNum(metrics.totalReq);
  document.getElementById('rAvgDay').textContent = fmtNum(Math.round(metrics.avgDay));
  document.getElementById('rEstRpm').textContent = metrics.isDaily ? '~' + (metrics.avgDay / 1440).toFixed(2) : '—';
  document.getElementById('rPeakDay').innerHTML = metrics.peakDay ? `${fmtDate(metrics.peakDay)} (${fmtNum(metrics.peakReq)})` : '—';

  // Top days
  const topList = document.getElementById('rateTopDays');
  if (metrics.topDays.length) {
    topList.innerHTML = metrics.topDays.map((d, i) =>
      `<li><span class="r-rank">#${i+1}</span><span class="r-date">${d.date}</span><span class="r-req">${fmtNum(d.requests||0)}</span></li>`
    ).join('');
  } else {
    topList.innerHTML = '<li style="color:var(--text-dim);font-size:0.78rem;padding:4px 0">No request data available</li>';
  }

  // Gauge: usage vs daily limit
  const pct = Math.min(100, (metrics.avgDay / limits.day) * 100);
  const fill = document.getElementById('rateGaugeFill');
  fill.style.width = pct + '%';
  let cls = 'green';
  if (pct > 80) cls = 'red';
  else if (pct > 50) cls = 'yellow';
  fill.className = 'rate-gauge-fill ' + cls;
  document.getElementById('rateGaugeLabel').textContent = pct.toFixed(1) + '%';

  // Badge status
  const badge = document.getElementById('rateBadge');
  if (pct > 80) badge.textContent = '\u{1F534}';  // red circle
  else if (pct > 50) badge.textContent = '\u{1F7E1}'; // yellow circle
  else badge.textContent = '\u{1F7E2}'; // green circle
}

function runRateLimitCheck() {
  const days = _currentDays;
  if (!days || !activeWsId) {
    renderRatePanel(null);
    return;
  }
  const metrics = computeRateMetrics(days);
  renderRatePanel(metrics);
}

// -- Virtual Scroller Implementation --

// Human-readable token type labels
function formatType(type) {
  if (type === 'input_cache_hit_tokens') return 'Input (Cache Hit)';
  if (type === 'input_cache_miss_tokens') return 'Input (Cache Miss)';
  if (type === 'output_tokens') return 'Output';
  if (type === 'request_count') return 'Requests';
  return type;
}

// Build a single row from raw data array
function _buildRowContent(r) {
  const typ = r[3], amt = Number(r[4]), price = Number(r[5]), cost = Number(r[6]);
  return [
    r[0],
    r[1],
    r[2]||'\u2014',
    formatType(typ),
    typ === 'request_count' ? fmtNum(amt) : fmtTok(amt),
    price > 0 ? '$' + price.toExponential(3) : '\u2014',
    fmtUSD(cost)
  ];
}

// Set column widths from thead measurement
function _syncColWidths(table, colgroup) {
  const ths = table.querySelectorAll('thead th');
  const cols = colgroup.querySelectorAll('col');
  let totalWidth = 0;
  ths.forEach((th, i) => {
    const w = th.offsetWidth;
    if (cols[i]) cols[i].style.width = w + 'px';
    totalWidth += w;
  });
  // Set table width to match
  table.style.width = Math.max(totalWidth, table.offsetParent ? table.offsetParent.clientWidth : totalWidth) + 'px';
}

// Create a recycled pool row
function _createPoolRow() {
  const tr = document.createElement('tr');
  tr.className = 'v-row';
  for (let c = 0; c < 7; c++) {
    const td = document.createElement('td');
    if (c >= 4) td.className = 'num';
    tr.appendChild(td);
  }
  return tr;
}

// Destroy virtual scroller state
function _destroyVScroll() {
  if (_vscroll) {
    if (_vscroll.animationId) cancelAnimationFrame(_vscroll.animationId);
    if (_vscroll.scrollHandler) {
      _vscroll.tableWrap.removeEventListener('scroll', _vscroll.scrollHandler, { passive: true });
    }
    if (_vscroll.resizeObserver) _vscroll.resizeObserver.disconnect();
    _vscroll = null;
  }
}

// Initialize virtual scroll on the table
function _initVScroll(rows, table, tableWrap) {
  _destroyVScroll();

  const BUFFER = 10;
  const ROW_HEIGHT = 28; // initial estimate, refined after first render
  let rowHeight = ROW_HEIGHT;
  const totalRows = rows.length;

  // Add colgroup for fixed column widths
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    for (let i = 0; i < 7; i++) {
      colgroup.appendChild(document.createElement('col'));
    }
    table.insertBefore(colgroup, table.firstChild);
  }

  // Switch to virtual scroll layout
  tableWrap.classList.add('virtual-scroll');
  const tbody = table.querySelector('tbody');

  // Reset tbody styles
  tbody.style.display = 'block';
  tbody.style.position = 'relative';
  tbody.style.overflow = 'hidden';
  tbody.innerHTML = '';

  // Calculate pool size
  const viewportH = tableWrap.clientHeight || 400;
  const poolSize = Math.ceil(viewportH / rowHeight) + 2 * BUFFER + 5;

  // Create pool of reusable rows
  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    const tr = _createPoolRow();
    tbody.appendChild(tr);
    pool.push(tr);
  }

  // Set the total scroll height
  const totalHeight = totalRows * rowHeight;
  tbody.style.height = totalHeight + 'px';

  // Sync column widths after a frame for layout settling
  requestAnimationFrame(() => {
    _syncColWidths(table, colgroup);
  });

  // State
  _vscroll = {
    rows,
    rowHeight,
    pool,
    poolSize,
    tableWrap,
    tbody,
    table,
    colgroup,
    totalRows,
    totalHeight,
    lastStartIdx: -1,
    initialized: false,
    scrollHandler: null,
    animationId: null,
    resizeObserver: null
  };

  // Scroll handler (throttled via rAF)
  function handleScroll() {
    if (_vscroll.animationId) return; // throttle: only one rAF pending
    _vscroll.animationId = requestAnimationFrame(() => {
      _vscroll.animationId = null;
      _updateVisibleRows(_vscroll);
    });
  }

  _vscroll.scrollHandler = handleScroll;
  tableWrap.addEventListener('scroll', handleScroll, { passive: true });

  // First render
  _vscroll.initialized = true;
  _updateVisibleRows(_vscroll);

  // Observe resize
  const ro = new ResizeObserver(() => {
    _syncColWidths(table, colgroup);
    _updateVisibleRows(_vscroll);
  });
  ro.observe(tableWrap);
  _vscroll.resizeObserver = ro;
}

// Update which rows are visible based on scroll position
function _updateVisibleRows(vs) {
  if (!vs || !vs.initialized) return;

  const { rows, pool, poolSize, tableWrap, tbody, rowHeight, totalRows, totalHeight } = vs;

  const scrollTop = tableWrap.scrollTop;
  const viewportH = tableWrap.clientHeight || 400;
  const BUFFER = 10;

  // Calculate visible range
  let startIdx = Math.floor(scrollTop / rowHeight) - BUFFER;
  startIdx = Math.max(0, startIdx);
  let endIdx = startIdx + poolSize;
  endIdx = Math.min(totalRows, endIdx);
  // Adjust start if we're near the end
  if (endIdx === totalRows) {
    startIdx = Math.max(0, endIdx - poolSize);
  }

  // Update total height in case rowHeight has been refined
  tbody.style.height = totalHeight + 'px';

  // Recycle pool: position and populate each visible row
  const firstVisible = startIdx;
  const lastVisible = startIdx + poolSize;

  for (let i = 0; i < poolSize; i++) {
    const dataIdx = firstVisible + i;
    if (dataIdx < totalRows) {
      const tr = pool[i];
      const top = dataIdx * rowHeight;
      tr.style.top = top + 'px';
      tr.style.display = 'table';

      // Only update content if data changed
      const r = rows[dataIdx];
      const vals = _buildRowContent(r);
      const tds = tr.children;
      for (let c = 0; c < 7; c++) {
        if (tds[c].textContent !== vals[c]) {
          tds[c].textContent = vals[c];
        }
      }
    } else {
      pool[i].style.display = 'none';
    }
  }
}

// -- renderTable --
function renderTable(days, modelFilter) {
  if (!activeWsId) return;

  const period = document.getElementById('periodSelect').value || 'all';
  const [start, end] = queryPeriod(period);

  let where = 'workspace_id = ? AND utc_date >= ? AND utc_date <= ?';
  const params = [activeWsId, start, end];
  if (modelFilter && modelFilter !== 'all') { where += ' AND model = ?'; params.push(modelFilter); }

  // Count total matching rows first (fast COUNT query)
  const countR = db.exec(`SELECT COUNT(*) FROM token_usage WHERE ${where}`, params);
  const totalCount = countR.length ? countR[0].values[0][0] : 0;

  // Fetch with row cap for memory safety — virtual scroll renders windows from this array
  const r = db.exec(`SELECT utc_date, model, api_key_name, type, amount, price, (price*amount) as cost FROM token_usage WHERE ${where} ORDER BY utc_date DESC, model, type LIMIT ?`, [...params, TABLE_ROW_LIMIT]);
  const rows = r.length ? r[0].values : [];
  const capped = totalCount > TABLE_ROW_LIMIT;

  const rowCountEl = document.getElementById('rowCount');
  const table = document.getElementById('dataTable');
  const tableWrap = document.querySelector('.table-wrap');
  const tbody = table.querySelector('tbody');

  // Set headers
  table.querySelector('thead tr').innerHTML = '<th>Date</th><th>Model</th><th>API Key</th><th>Type</th><th class="num">Amount</th><th class="num">Unit Price</th><th class="num">Cost</th>';

  if (!rows.length) {
    _destroyVScroll();
    tableWrap.classList.remove('virtual-scroll');
    table.style.display = '';
    tbody.style.display = '';
    tbody.style.position = '';
    tbody.style.overflow = '';
    tbody.style.height = '';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;color:var(--text-dim)">No data</td></tr>';
    rowCountEl.textContent = '(0 rows)';
    return;
  }

  rowCountEl.textContent = `(${rows.length} rows${capped ? ', capped at ' + TABLE_ROW_LIMIT.toLocaleString() + ' of ' + totalCount.toLocaleString() : ''})`;

  if (rows.length > 500) {
    // Use virtual scrolling for large datasets
    _initVScroll(rows, table, tableWrap);
    updateTableScrollIndicator();
  } else {
    // Small dataset: render all rows directly
    _destroyVScroll();
    tableWrap.classList.remove('virtual-scroll');
    table.style.display = '';
    tbody.style.display = '';
    tbody.style.position = '';
    tbody.style.overflow = '';
    tbody.style.height = '';
    tbody.innerHTML = rows.map(r => {
      const typ = r[3], amt = Number(r[4]), price = Number(r[5]), cost = Number(r[6]);
      const typLabel = formatType(typ);
      return '<tr>\n        <td>' + escapeHtml(r[0]) + '</td><td>' + escapeHtml(r[1]) + '</td><td>' + escapeHtml(r[2]||'\u2014') + '</td><td>' + escapeHtml(typLabel) + '</td>\n        <td class="num">' + (typ==='request_count' ? fmtNum(amt) : fmtTok(amt)) + '</td>\n        <td class="num">' + (price > 0 ? '$'+price.toExponential(3) : '\u2014') + '</td>\n        <td class="num">' + fmtUSD(cost) + '</td>\n      </tr>';
    }).join('');
    updateTableScrollIndicator();
  }
}

// Attach table-wrap scroll listener once
(function() {
  const wrap = document.querySelector('.table-wrap');
  if (wrap) {
    wrap.addEventListener('scroll', updateTableScrollIndicator, { passive: true });
    window.addEventListener('resize', updateTableScrollIndicator, { passive: true });
  }
})();

// -- Switch Workspace --
async function switchWorkspace(id) {
  activeWsId = id;
  document.getElementById('wsSelect').value = id;

  if (id) {
    document.getElementById('noWs').style.display = 'none';
    document.getElementById('activeContent').style.display = 'block';
    Object.values(charts).forEach(c => c.destroy()); charts = {};
    _destroyVScroll();
    await refreshAll();
  } else {
    document.getElementById('noWs').style.display = 'block';
    document.getElementById('activeContent').style.display = 'none';
  }
}

function updateTableScrollIndicator() {
  const wrap = document.querySelector('.table-wrap');
  if (!wrap) return;
  const hasOverflow = wrap.scrollWidth > wrap.clientWidth + 1;
  const scrolledToEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2;
  wrap.classList.toggle('can-scroll-right', hasOverflow && !scrolledToEnd);
}

function refreshWsList() {
  const workspaces = getWorkspaces();
  const sel = document.getElementById('wsSelect');
  sel.innerHTML = workspaces.map(w => '<option value="' + escapeHtml(w.id) + '">' + escapeHtml(w.name) + '</option>').join('');
  if (!workspaces.length) {
    sel.innerHTML = '<option value="">No Workspace</option>';
    switchWorkspace(null);
  } else if (!activeWsId || !workspaces.find(w => w.id === activeWsId)) {
    switchWorkspace(workspaces[0].id);
  }
  sel.value = activeWsId || '';
}

// -- Modal --
let modalCallback = null;
function showModal(title, placeholder, cb) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalInput').value = '';
  document.getElementById('modalInput').placeholder = placeholder || '';
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('modalInput').focus();
  modalCallback = cb;
}
function hideModal() { document.getElementById('modalOverlay').classList.remove('show'); modalCallback = null; }

// -- Event Bindings --
document.getElementById('wsSelect').addEventListener('change', function() { switchWorkspace(this.value); });
document.getElementById('wsNewBtn').addEventListener('click', () => {
  showModal('Create Workspace', 'e.g. Personal, Work, Team', (name) => {
    const id = createWorkspace(name); refreshWsList(); switchWorkspace(id); toast('Workspace created');
  });
});
document.getElementById('wsRenameBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  const ws = getWorkspaces().find(w => w.id === activeWsId);
  showModal('Rename Workspace', ws?.name||'', (name) => { renameWorkspace(activeWsId, name); refreshWsList(); toast('Renamed'); });
});
document.getElementById('wsDeleteBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  if (!confirm('Delete this workspace and ALL its data? This cannot be undone.')) return;
  deleteWorkspace(activeWsId); activeWsId = null; refreshWsList(); toast('Workspace deleted');
});
document.getElementById('wsClearBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  if (!confirm('Clear all data in this workspace? Charts will be empty until you upload again.')) return;
  clearWorkspaceData(activeWsId); Object.values(charts).forEach(c => c.destroy()); charts = {}; refreshAll(); refreshWsList(); toast('Data cleared');
});
document.getElementById('noWsCreateBtn').addEventListener('click', () => document.getElementById('wsNewBtn').click());
document.getElementById('modalCancel').addEventListener('click', hideModal);
document.getElementById('modalConfirm').addEventListener('click', () => {
  const val = document.getElementById('modalInput').value.trim();
  if (!val) return;
  hideModal();
  if (modalCallback) modalCallback(val);
});
document.getElementById('modalInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('modalConfirm').click(); });

const _debouncedRefresh = debounce(refreshAll, DEBOUNCE_MS);
['periodSelect','modelSelect','keySelect','granularitySelect'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', _debouncedRefresh);
});
// Persist granularity preference
document.getElementById('granularitySelect')?.addEventListener('change', function() {
  try { localStorage.setItem(GRANULARITY_LS_KEY, this.value); } catch(e) {}
});

// Drop zone
const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); if (e.dataTransfer.files.length) handleMultipleUpload(e.dataTransfer.files); });
dz.addEventListener('click', () => {
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/zip,application/x-zip-compressed,.zip'; inp.multiple = true;
  inp.onchange = () => { if (inp.files.length) handleMultipleUpload(inp.files); };
  inp.click();
});

// Export
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  const period = document.getElementById('periodSelect').value || 'all';
  const [start, end] = queryPeriod(period);
  const r = db.exec(`SELECT utc_date, model, SUM(CASE WHEN type='input_cache_hit_tokens' THEN amount ELSE 0 END) as cache_hit, SUM(CASE WHEN type='input_cache_miss_tokens' THEN amount ELSE 0 END) as cache_miss, SUM(CASE WHEN type='output_tokens' THEN amount ELSE 0 END) as output_tokens, SUM(CASE WHEN type='request_count' THEN amount ELSE 0 END) as requests FROM token_usage WHERE workspace_id=? AND utc_date>=? AND utc_date<=? GROUP BY utc_date, model ORDER BY utc_date`, [activeWsId, start, end]);
  const rows = r.length ? r[0].values : [];
  const csv = 'date,model,cache_hit_tokens,cache_miss_tokens,output_tokens,requests\n' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='deepseek-export.csv'; a.click(); URL.revokeObjectURL(url);
  toast('CSV exported');
});

document.getElementById('exportAllBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  const r = db.exec(`SELECT * FROM token_usage WHERE workspace_id=? ORDER BY utc_date`, [activeWsId]);
  const rows = r.length ? r[0].values : [];
  const csv = 'utc_date,model,api_key_name,type,amount,price,cost\n' + rows.map(r => [r[2],r[3],r[4],r[5],r[6],r[7],Number(r[6]||0)*Number(r[7]||0)].join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='deepseek-raw-export.csv'; a.click(); URL.revokeObjectURL(url);
  toast('Full raw data exported');
});

// -- Token Pricing Calculator --
const PRICING_LS_KEY = 'ds-dash-custom-prices';

function loadCustomPrices() {
  try { return JSON.parse(localStorage.getItem(PRICING_LS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveCustomPrices(prices) {
  try { localStorage.setItem(PRICING_LS_KEY, JSON.stringify(prices)); } catch(e) {}
}

function getPricingModels() {
  if (!activeWsId) return [];
  const r = db.exec('SELECT DISTINCT model FROM token_usage WHERE workspace_id = ? ORDER BY model', [activeWsId]);
  return r.length ? r[0].values.map(v => v[0]) : [];
}

function getAvgPriceForModel(model) {
  if (!activeWsId) return { input: 0, output: 0, cache_hit: 0 };
  const prices = { input: 0, output: 0, cache_hit: 0 };
  const r = db.exec('SELECT type, AVG(price) FROM token_usage WHERE workspace_id = ? AND model = ? AND price > 0 GROUP BY type', [activeWsId, model]);
  if (r.length) {
    for (const [typ, avg] of r[0].values) {
      const val = Number(avg) || 0;
      if (typ === 'output_tokens') prices.output = val;
      else if (typ === 'input_cache_hit_tokens') prices.cache_hit = val;
      else if (typ.startsWith('input')) prices.input = val;
    }
  }
  return prices;
}

function openPricingCalculator() {
  if (!activeWsId) { toast('Select a workspace first', true); return; }
  const models = getPricingModels();
  if (!models.length) {
    toast('No data in this workspace — upload some data first', true);
    return;
  }
  const saved = loadCustomPrices();
  const rowsEl = document.getElementById('pricingModelRows');
  rowsEl.innerHTML = models.map(m => {
    const def = getAvgPriceForModel(m);
    const sp = saved[m] || {};
    const inp = sp.input !== undefined ? sp.input : def.input;
    const out = sp.output !== undefined ? sp.output : def.output;
    const ch = sp.cache_hit !== undefined ? sp.cache_hit : def.cache_hit;
    const em = escapeHtml(m);
    return '<div class="pricing-model-row">\n' +
      '      <span class="model-label" title="' + em + '">' + em + '</span>\n' +
      '      <span class="price-label">Input $/tok</span>\n' +
      '      <input type="number" step="any" min="0" data-model="' + em + '" data-ptype="input" value="' + inp.toExponential(4) + '" placeholder="0">\n' +
      '      <span class="price-label">Output $/tok</span>\n' +
      '      <input type="number" step="any" min="0" data-model="' + em + '" data-ptype="output" value="' + out.toExponential(4) + '" placeholder="0">\n' +
      '      <span class="price-label">Cache $/tok</span>\n' +
      '      <input type="number" step="any" min="0" data-model="' + em + '" data-ptype="cache_hit" value="' + ch.toExponential(4) + '" placeholder="0">\n' +
      '    </div>';
  }).join('');

  document.getElementById('pricingResults').classList.remove('show');
  document.getElementById('pricingModalOverlay').classList.add('show');
}

function closePricingCalculator() {
  document.getElementById('pricingModalOverlay').classList.remove('show');
}

function collectPricesFromInputs() {
  const prices = {};
  document.querySelectorAll('#pricingModelRows input').forEach(inp => {
    const model = inp.dataset.model;
    const ptype = inp.dataset.ptype;
    const val = parseFloat(inp.value);
    if (!prices[model]) prices[model] = { input: 0, output: 0, cache_hit: 0 };
    prices[model][ptype] = isNaN(val) || val < 0 ? 0 : val;
  });
  return prices;
}

function recalcPricing() {
  if (!activeWsId) return;
  const prices = collectPricesFromInputs();
  saveCustomPrices(prices);

  // Query all non-request_count rows
  const r = db.exec(`SELECT model, type, amount, price FROM token_usage WHERE workspace_id = ? AND type != 'request_count'`, [activeWsId]);
  if (!r.length || !r[0].values.length) {
    toast('No token rows to calculate', true);
    return;
  }

  const rows = r[0].values;
  let totalOrig = 0, totalNew = 0;
  const byModel = {};  // { model: { orig, new } }

  for (const [model, typ, amount, price] of rows) {
    const amt = Number(amount) || 0;
    const origCost = (Number(price) || 0) * amt;
    totalOrig += origCost;

    const mp = prices[model];
    let customPrice = 0;
    if (mp) {
      if (typ === 'output_tokens') customPrice = mp.output;
      else if (typ === 'input_cache_hit_tokens') customPrice = mp.cache_hit;
      else if (typ.startsWith('input')) customPrice = mp.input;
      // fallback: if no custom price set, use 0
    }
    const newCost = customPrice * amt;
    totalNew += newCost;

    if (!byModel[model]) byModel[model] = { orig: 0, new: 0 };
    byModel[model].orig += origCost;
    byModel[model].new += newCost;
  }

  const diff = totalNew - totalOrig;
  const pctChange = totalOrig > 0 ? ((diff / totalOrig) * 100).toFixed(1) : '0.0';

  document.getElementById('pricingOrigCost').textContent = fmtUSD(totalOrig);
  document.getElementById('pricingNewCost').textContent = fmtUSD(totalNew);

  const diffEl = document.getElementById('pricingDiff');
  diffEl.textContent = (diff >= 0 ? '+' : '') + fmtUSD(diff) + ' (' + (diff >= 0 ? '+' : '') + pctChange + '%)';

  const diffItem = document.getElementById('pricingDiffItem');
  diffItem.classList.remove('diff-positive', 'diff-negative');
  if (diff > 0.005) diffItem.classList.add('diff-positive');
  else if (diff < -0.005) diffItem.classList.add('diff-negative');

  // Per-model breakdown table
  const tbody = document.querySelector('#pricingBreakdown tbody');
  const modelEntries = Object.entries(byModel).sort((a, b) => (b[1].new - b[1].orig) - (a[1].new - a[1].orig));
  tbody.innerHTML = modelEntries.map(([model, costs]) => {
    const md = costs.new - costs.orig;
    const mdClass = md > 0.005 ? 'diff-pos' : (md < -0.005 ? 'diff-neg' : '');
    return '<tr>\n' +
      '      <td>' + escapeHtml(model) + '</td>\n' +
      '      <td class="num">' + fmtUSD(costs.orig) + '</td>\n' +
      '      <td class="num">' + fmtUSD(costs.new) + '</td>\n' +
      '      <td class="num ' + mdClass + '">' + (md >= 0 ? '+' : '') + fmtUSD(md) + '</td>\n' +
      '    </tr>';
  }).join('');

  document.getElementById('pricingResults').classList.add('show');
}

// Event bindings for pricing calculator
document.getElementById('pricingBtn').addEventListener('click', openPricingCalculator);
document.getElementById('pricingCancelBtn').addEventListener('click', closePricingCalculator);
document.getElementById('pricingRecalcBtn').addEventListener('click', recalcPricing);

// Close pricing modal on overlay click
document.getElementById('pricingModalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closePricingCalculator();
});

// -- Anomaly Detection Event Bindings --
function runAnomalyDetection() {
  if (!activeWsId || !_currentDays || !_currentDays.length) return;
  const prefs = {
    threshold: parseFloat(document.getElementById('thresholdSlider').value),
    cost: document.getElementById('chkCost').checked,
    tokens: document.getElementById('chkTokens').checked,
    requests: document.getElementById('chkRequests').checked
  };
  document.getElementById('thresholdLabel').textContent = prefs.threshold.toFixed(1);
  saveAnomalyPrefs(prefs);
  _anomalyCache = detectAnomalies(_currentDays, prefs.threshold, prefs);
  renderAnomalyPanel(_anomalyCache);
  // Re-render charts that have anomaly overlays (use grouped days if applicable)
  renderTokenChart(_groupedDays.length ? _groupedDays : _currentDays);
  renderSpendChart(_groupedDays.length ? _groupedDays : _currentDays);
}

document.getElementById('thresholdSlider').addEventListener('input', runAnomalyDetection);
document.getElementById('chkCost').addEventListener('change', runAnomalyDetection);
document.getElementById('chkTokens').addEventListener('change', runAnomalyDetection);
document.getElementById('chkRequests').addEventListener('change', runAnomalyDetection);

// Panel collapse toggle
setupCollapsiblePanel("anomalyToggle", "anomalyBody", "anomalyChevron");

// -- Rate Limit Monitor Event Bindings --
(function() {
  setupCollapsiblePanel("rateToggle", "rateBody", "rateChevron");
  const tierSelect = document.getElementById('rateTierSelect');
  const customInputs = document.getElementById('rateCustomInputs');
  const customRpm = document.getElementById('rateCustomRpm');
  const customDay = document.getElementById('rateCustomDay');

  function saveAndRefresh() {
    const prefs = loadRatePrefs();
    prefs.tier = tierSelect.value;
    if (prefs.tier === 'custom') {
      prefs.customRpm = parseInt(customRpm.value) || 10;
      prefs.customDay = parseInt(customDay.value) || 14400;
    }
    saveRatePrefs(prefs);
    customInputs.classList.toggle('show', prefs.tier === 'custom');
    runRateLimitCheck();
  }

  tierSelect.addEventListener('change', saveAndRefresh);
  customRpm.addEventListener('input', saveAndRefresh);
  customDay.addEventListener('input', saveAndRefresh);
})();

// -- Theme Toggle --
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '\u2600' : '\u263E';
  try { localStorage.setItem('ds-dash-theme', theme); } catch(e) {}
  // Refresh charts so grid/tooltip colors match the active theme
  if (Object.values(charts).length) { refreshAll(); }
}
function loadTheme() {
  let theme = 'dark';
  try { const s = localStorage.getItem('ds-dash-theme'); if (s === 'light' || s === 'dark') theme = s; } catch(e) {}
  setTheme(theme);
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// -- Init --
async function init() {
  loadTheme();
  // Restore granularity preference
  try {
    const saved = localStorage.getItem(GRANULARITY_LS_KEY);
    if (saved && ['daily','weekly','monthly'].includes(saved)) {
      document.getElementById('granularitySelect').value = saved;
    }
  } catch(e) {}
  try {
    SQL = await initSqlJs({ locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}` });
    const loaded = await loadDB();
    initSchema();

    if (!loaded) {
      // First time: create a default workspace and save
      const id = genId();
      db.run('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)', [id, 'Default', new Date().toISOString()]);
      await saveDB();
    }

    refreshWsList();
    if (activeWsId) await refreshAll();

    toast(loaded ? 'Workspace loaded from browser storage' : 'Dashboard ready — create a workspace to begin');
  } catch(e) {
    console.error(e);
    document.body.innerHTML = '<div style="padding:48px;text-align:center;color:var(--red)"><h2>Failed to initialize</h2><p>' + escapeHtml(e.message) + '</p><p style="color:var(--text-dim)">Try reloading the page or clearing browser storage.</p></div>';
  }
}

init();
