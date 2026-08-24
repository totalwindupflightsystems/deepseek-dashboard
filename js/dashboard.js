'use strict';
// -- Global State --
let SQL = null;
let db = null;
let activeWsId = null;
let charts = {};
let _currentDays = [];
let _groupedDays = [];
// DSD-GAP-046: [{ id, name, days }] — per-workspace series when 2+ workspaces
// are selected in overlay mode; null in single-workspace mode.
let _overlaySeries = null;
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
  // DSD-GAP-042: wallet_type column for the new start_time_iso export format.
  // Guarded ALTER so existing IndexedDB databases upgrade in place.
  try {
    const cols = db.exec('PRAGMA table_info(cost_daily)');
    const hasWallet = cols.length && cols[0].values.some(r => r[1] === 'wallet_type');
    if (!hasWallet) db.run('ALTER TABLE cost_daily ADD COLUMN wallet_type TEXT');
  } catch(_) { /* table_info or ALTER failed — column may already exist */ }
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

// -- Progress UI helpers (DSD-GAP-034) --
// Returns a progress callback for _processSingleFile that updates the drop
// zone title and a progress bar element with live row counts.
function makeProgressUpdater(dz, fileTotal, fileIndex, fileName) {
  const titleEl = dz.querySelector('.drop-title');
  const barEl = dz.querySelector('.drop-progress-bar');
  const labelEl = dz.querySelector('.drop-progress-label');
  const idx = (fileIndex || 0) + 1;

  return function(upd) {
    const phase = upd.phase || '';
    const name = fileName || upd.fileName || '';

    if (phase === 'parsing') {
      titleEl.textContent = fileTotal > 1
        ? `Parsing ${name} (${idx}/${fileTotal})…`
        : `Parsing ${name}…`;
      if (barEl) barEl.style.width = '0%';
      if (labelEl) labelEl.textContent = '';
    } else if (phase === 'inserting') {
      const pct = upd.rowsTotal > 0 ? Math.round(upd.rowsDone / upd.rowsTotal * 100) : 0;
      if (fileTotal > 1) {
        titleEl.textContent = `Processing ${name} (${idx}/${fileTotal}) — ${pct}%`;
      } else {
        titleEl.textContent = `Processing — ${pct}%`;
      }
      if (barEl) barEl.style.width = pct + '%';
      if (labelEl) labelEl.textContent = `${fmtNum(upd.rowsDone)} / ${fmtNum(upd.rowsTotal)} rows`;
    } else if (phase === 'saving') {
      if (fileTotal > 1) {
        titleEl.textContent = `Saving ${name} (${idx}/${fileTotal})…`;
      } else {
        titleEl.textContent = 'Saving to storage…';
      }
      if (barEl) barEl.style.width = '100%';
      if (labelEl) labelEl.textContent = '';
    }
  };
}

function hideProgressBar(dz) {
  const barEl = dz.querySelector('.drop-progress-bar');
  const labelEl = dz.querySelector('.drop-progress-label');
  if (barEl) barEl.style.width = '0%';
  if (labelEl) labelEl.textContent = '';
}

// -- Core file processing (no UI, no refreshAll) --
// progressCb({ phase, fileIndex, fileTotal, fileName, rowsDone, rowsTotal })
//   is an optional callback for UI progress reporting (DSD-GAP-034).
async function _processSingleFile(file, progressCb) {
  const cb = typeof progressCb === 'function' ? progressCb : () => {};

  // -- Phase 1: parse ZIP entries --
  cb({ phase: 'parsing', fileName: file.name, rowsDone: 0, rowsTotal: 0 });
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

  if (!amountRows.length && !costRows.length) throw new Error('No amount-*/cost-* CSV found in archive');

  // DSD-GAP-042: new export format (start_time_iso / end_time_iso) has no
  // utc_date column. Derive utc_date from the date part of start_time_iso
  // (e.g. "2026-07-25T00:00:00-05:00" → "2026-07-25") for both amount and cost.
  for (const r of amountRows) {
    if (!r.utc_date && r.start_time_iso) r.utc_date = r.start_time_iso.slice(0, 10);
  }
  for (const r of costRows) {
    if (!r.utc_date && r.start_time_iso) r.utc_date = r.start_time_iso.slice(0, 10);
  }

  // Normalize date format: YYYYMMDD → YYYY-MM-DD (DeepSeek changed formats mid-2026)
  for (const r of amountRows) {
    if (r.utc_date && /^\d{8}$/.test(r.utc_date)) {
      r.utc_date = r.utc_date.slice(0,4) + '-' + r.utc_date.slice(4,6) + '-' + r.utc_date.slice(6,8);
    }
  }
  for (const r of costRows) {
    if (r.utc_date && /^\d{8}$/.test(r.utc_date)) {
      r.utc_date = r.utc_date.slice(0,4) + '-' + r.utc_date.slice(4,6) + '-' + r.utc_date.slice(6,8);
    }
  }

  // Defense-in-depth (DSD-GAP-030): drop rows whose utc_date is not a valid
  // YYYY-MM-DD string after normalization. CSV data is user-uploaded and
  // arbitrary strings (e.g. HTML payloads) must not survive into sql.js.
  const _dateRe = /^\d{4}-\d{2}-\d{2}$/;
  let droppedCount = 0;
  for (let i = amountRows.length - 1; i >= 0; i--) {
    if (amountRows[i].utc_date && !_dateRe.test(amountRows[i].utc_date)) { amountRows.splice(i, 1); droppedCount++; }
  }
  for (let i = costRows.length - 1; i >= 0; i--) {
    if (costRows[i].utc_date && !_dateRe.test(costRows[i].utc_date)) { costRows.splice(i, 1); droppedCount++; }
  }
  if (droppedCount > 0) console.info(`[upload] dropped ${droppedCount} row(s) with invalid utc_date`);

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

  // -- Phase 2: insert in a single transaction (DSD-GAP-034) --
  // Wrapping all inserts + deletes in BEGIN/COMMIT gives a ~10-100x speedup
  // for large files because sql.js skips the implicit per-statement commit
  // (which flushes the full in-memory DB journal on every row).
  const totalRows = amountRows.length + costRows.length;
  cb({ phase: 'inserting', fileName: file.name, rowsDone: 0, rowsTotal: totalRows });
  let rowsDone = 0;

  db.run('BEGIN');
  let tokenCount = 0, costCount = 0;
  try {
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
    for (const r of amountRows) {
      if (!r.utc_date || !r.model || !r.type || r.type === 'type') continue;
      stmtTok.run([activeWsId, r.utc_date, r.model, r.api_key_name||'', r.type,
                   parseFloat(r.price)||0, parseFloat(r.amount)||0, uploadId]);
      tokenCount++;
      rowsDone++;
      if ((rowsDone & 511) === 0) cb({ phase: 'inserting', fileName: file.name, rowsDone, rowsTotal: totalRows });
    }
    stmtTok.free();

    // Insert cost rows
    const stmtCost = db.prepare('INSERT INTO cost_daily (workspace_id, utc_date, model, cost, currency, wallet_type, upload_id) VALUES (?,?,?,?,?,?,?)');
    for (const r of costRows) {
      if (!r.utc_date || !r.model) continue;
      stmtCost.run([activeWsId, r.utc_date, r.model, parseFloat(r.cost)||0, r.currency||'USD', r.wallet_type||'', uploadId]);
      costCount++;
      rowsDone++;
      if ((rowsDone & 511) === 0) cb({ phase: 'inserting', fileName: file.name, rowsDone, rowsTotal: totalRows });
    }
    stmtCost.free();

    // Record upload
    db.run('INSERT INTO uploads (id, workspace_id, filename, uploaded_at, mode, rows_replaced, rows_added, date_min, date_max) VALUES (?,?,?,?,?,?,?,?,?)',
      [uploadId, activeWsId, file.name, new Date().toISOString(), mode, rowsReplaced, tokenCount+costCount, dateMin, dateMax]);

    // Update workspace
    db.run('UPDATE workspaces SET last_upload_at = ? WHERE id = ?', [new Date().toISOString(), activeWsId]);

    db.run('COMMIT');
  } catch(e) {
    // Rollback on error so partial inserts don't corrupt the DB
    try { db.run('ROLLBACK'); } catch(_) {}
    throw e;
  }

  cb({ phase: 'saving', fileName: file.name, rowsDone: totalRows, rowsTotal: totalRows });
  await saveDB();
  let msg = `${mode === 'replace' ? 'Updated' : 'Added'} ${fmtNum(tokenCount)} rows · ${dateMin} → ${dateMax}`;
  if (droppedCount > 0) msg += ` (${droppedCount} dropped — invalid utc_date)`;
  return { success: true, message: msg, file: file.name, dropped: droppedCount };
}

// -- Upload Processing (single file, backward compatible) --
async function handleUpload(file) {
  const ext = file.name.toLowerCase().endsWith('.zip');
  const mime = file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!ext && !mime) { toast('Please select a .zip file', true); return; }
  if (!activeWsId) { toast('Create a workspace first', true); return; }

  const dz = document.getElementById('dropZone');
  dz.classList.add('processing');

  try {
    const result = await _processSingleFile(file, makeProgressUpdater(dz, 1));
    toast(result.message);
  } catch(e) {
    toast('Error: ' + e.message, true);
    console.error(e);
  }

  dz.classList.remove('processing');
  dz.querySelector('.drop-title').textContent = 'Drop DeepSeek usage ZIP here';
  hideProgressBar(dz);
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
  const skippedNonZip = [];
  for (let i = 0; i < files.length; i++) {
    const ext = files[i].name.toLowerCase().endsWith('.zip');
    const mime = files[i].type === 'application/zip' || files[i].type === 'application/x-zip-compressed';
    if (ext || mime) {
      fileArray.push(files[i]);
    } else {
      skippedNonZip.push(files[i].name);
    }
  }

  if (fileArray.length === 0) {
    toast('No .zip files found', true);
    dz.classList.remove('processing');
    return;
  }

  let successCount = 0, failCount = 0;
  const failReasons = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const progressCb = makeProgressUpdater(dz, fileArray.length, i, file.name);

    try {
      const result = await _processSingleFile(file, progressCb);
      toast(result.message);
      successCount++;
    } catch(e) {
      toast(`Error: ${file.name} — ${e.message}`, true);
      console.error(e);
      failReasons.push(`${file.name}: ${e.message}`);
      failCount++;
    }
  }

  dz.classList.remove('processing');
  dz.querySelector('.drop-title').textContent = 'Drop DeepSeek usage ZIP here';
  hideProgressBar(dz);

  // Report any non-ZIP files that were silently skipped during the filter
  if (skippedNonZip.length > 0) {
    const plural = skippedNonZip.length === 1 ? 'file' : 'files';
    const msg = `Skipped ${skippedNonZip.length} non-ZIP ${plural}: ${skippedNonZip.join(', ')}`;
    toast(msg);
    console.info('Skipped non-ZIP files:', skippedNonZip);
  }

  if (failCount > 0) {
    let summary = `Done: ${successCount} succeeded, ${failCount} failed`;
    const reasonStr = ' — ' + failReasons.join('; ');
    if (summary.length + reasonStr.length > 200) {
      summary += reasonStr.slice(0, 200 - summary.length - 3) + '...';
    } else {
      summary += reasonStr;
    }
    toast(summary, true);
  }

  await refreshAll();
}

// -- Data Querying --

// Returns the dataset's max utc_date (YYYY-MM-DD) for the active workspace, or
// null when the db is unavailable / the workspace has no rows.  token_usage is
// queried first; cost_daily is the fallback.  Used to anchor relative period
// windows (7d/30d) to the DATA instead of the wall clock so a June export viewed
// in August still shows the last 7 days of June.
function getDatasetMaxDate() {
  if (typeof db === 'undefined' || !db || typeof db.exec !== 'function') return null;
  try {
    let r = db.exec('SELECT MAX(utc_date) FROM token_usage WHERE workspace_id = ?', [activeWsId]);
    if (r.length && r[0].values.length && r[0].values[0][0]) return r[0].values[0][0];
    r = db.exec('SELECT MAX(utc_date) FROM cost_daily WHERE workspace_id = ?', [activeWsId]);
    if (r.length && r[0].values.length && r[0].values[0][0]) return r[0].values[0][0];
  } catch (_) { /* ignore — fall back to wall clock */ }
  return null;
}

// Returns true when the active workspace has ANY rows in token_usage or
// cost_daily.  Guards against an unavailable db so it never throws in the
// mocked test harness.
function workspaceHasData() {
  if (typeof db === 'undefined' || !db || typeof db.exec !== 'function') return false;
  try {
    let r = db.exec('SELECT 1 FROM token_usage WHERE workspace_id = ? LIMIT 1', [activeWsId]);
    if (r.length && r[0].values.length) return true;
    r = db.exec('SELECT 1 FROM cost_daily WHERE workspace_id = ? LIMIT 1', [activeWsId]);
    if (r.length && r[0].values.length) return true;
  } catch (_) { /* ignore */ }
  return false;
}

// Pure helper: pick the empty-state message based on whether the workspace has
// any data at all.  When the workspace HAS data but the selected period matches
// nothing, the message guides the user to broaden the filter instead of
// re-uploading data they already have.
function emptyStateMessage(hasData, period) {
  if (hasData && period && period !== 'all') {
    return 'No data in the selected period — try All Time or a month';
  }
  return 'No data yet — drag in a DeepSeek usage ZIP';
}

function queryPeriod(period) {
  if (period === 'all') return ['2000-01-01', '2099-12-31'];
  if (period === '7d') {
    const end = getDatasetMaxDate() || new Date().toISOString().slice(0,10);
    const d = new Date(end); d.setUTCDate(d.getUTCDate() - 6);
    return [d.toISOString().slice(0,10), end];
  }
  if (period === '30d') {
    const end = getDatasetMaxDate() || new Date().toISOString().slice(0,10);
    const d = new Date(end); d.setUTCDate(d.getUTCDate() - 29);
    return [d.toISOString().slice(0,10), end];
  }
  if (period.startsWith('month-')) {
    const [y,m] = period.replace('month-','').split('-');
    const start = `${y}-${m}-01`;
    const end = `${y}-${String(m).padStart(2,'0')}-${new Date(Number(y),Number(m),0).getDate()}`;
    return [start, end];
  }
  return ['1','1'];
}

// DSD-GAP-046: optional explicit workspaceId — overlay mode queries one series
// per selected workspace while the single-workspace path (wsId omitted) keeps
// its existing behavior keyed on activeWsId.
function getDailyData(period, model, key, wsId) {
  const wid = wsId || activeWsId;
  const [start, end] = queryPeriod(period);
  let where = 'workspace_id = ? AND utc_date >= ? AND utc_date <= ?';
  const params = [wid, start, end];
  if (model && model !== 'all') { where += ' AND model = ?'; params.push(model); }
  if (key && key !== 'all') { where += ' AND api_key_name = ?'; params.push(key); }

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

  // Merge cost_daily — but ONLY when no key filter is active.
  // cost_daily has no api_key_name column, so its rows cannot be attributed
  // to a single key. Merging them under a key filter pollutes every cost
  // aggregate (KPI Total Cost, Avg Daily Cost, spend chart, top-spend) with
  // the unfiltered global cost. When a key IS selected, cost derives from
  // token_usage price*amount only — the same source the per-key chart (cKey)
  // uses. When the filter is 'all' (or empty), the merge runs as before so
  // cost-only exports (where token_usage may be empty) still get a cost figure.
  if (!key || key === 'all') {
    let cdWhere = 'workspace_id = ? AND utc_date >= ? AND utc_date <= ?';
    const cdParams = [wid, start, end];
    if (model && model !== 'all') { cdWhere += ' AND model = ?'; cdParams.push(model); }
    const cdRows = db.exec(`SELECT utc_date, model, SUM(cost) as total_cost FROM cost_daily WHERE ${cdWhere} GROUP BY utc_date, model`, cdParams);
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
  }

  return Object.values(days).sort((a,b) => a.date.localeCompare(b.date));
}

const GRANULARITY_LS_KEY = 'ds-dash-granularity';
const OVERLAY_LS_KEY = 'ds-dash-overlay-normalize';
const TREND_LS_KEY = 'ds-dash-trend';
const PROJECTION_LS_KEY = 'ds-dash-projection';
const HORIZON_LS_KEY = 'ds-dash-horizon';

// ─────────────────────────────────────────────
// DSD-GAP-043: Trend charting helpers
// ─────────────────────────────────────────────

/**
 * groupByWeek(days) → array of { date, label, total_tokens, cost } summed per ISO week.
 * Reuses getISOWeekStart for week boundary detection. Sorted ascending.
 * @param {Array} days — day objects with { date, total_tokens, cost_csv, cost_tokens }
 * @returns {Array<{date:string,label:string,total_tokens:number,cost:number}>}
 */
function groupByWeek(days) {
  if (!days || !days.length) return [];
  const groups = {};
  for (const d of days) {
    const key = getISOWeekStart(d.date);
    if (!groups[key]) {
      groups[key] = { date: key, label: key, total_tokens: 0, cost: 0 };
    }
    groups[key].total_tokens += d.total_tokens || 0;
    groups[key].cost += d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0);
  }
  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * rollingMean(values, window=7) → array of numbers aligned 1:1 with input.
 * Partial-window policy: for index i, average of values[max(0, i-window+1) .. i]
 * (i.e. as many points as available up to `window` size, starting from index 0).
 * Non-numeric entries (null/undefined/NaN) are treated as 0 and counted.
 * @param {Array<number>} values
 * @param {number} [window=7]
 * @returns {Array<number>}
 */
function rollingMean(values, window) {
  const w = window || 7;
  if (!values || values.length === 0) return [];
  const result = new Array(values.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (Number.isFinite(v)) { sum += v; count++; }
    const head = i - w;
    if (head >= 0) {
      const hv = Number(values[head]);
      if (Number.isFinite(hv)) { sum -= hv; count--; }
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}

/**
 * growthRate(days) → day-over-day % change series.
 * First point is null (no previous day). Subsequent = (today - yesterday)/yesterday * 100.
 * Handles yesterday === 0 → null (avoids division by zero).
 * @param {Array} days — day objects with { date, total_tokens, cost_csv, cost_tokens }
 * @param {string} [field='total_tokens']
 * @returns {Array<number|null>}
 */
function growthRate(days, field) {
  const f = field || 'total_tokens';
  if (!days || !days.length) return [];
  const result = new Array(days.length);
  const getVal = (d) => d[f] != null ? d[f] : (d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0));
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { result[i] = null; continue; }
    const prev = getVal(days[i - 1]);
    const cur = getVal(days[i]);
    if (prev === 0) { result[i] = null; continue; }
    result[i] = ((cur - prev) / prev) * 100;
  }
  return result;
}

// ─────────────────────────────────────────────
// DSD-GAP-044: Projection Engine — linear least-squares
// and exponential fit, horizon projection, confidence band,
// and quarter-over-quarter projection summary.
// ─────────────────────────────────────────────

/**
 * linreg(ys) → { slope, intercept, r2 } via ordinary least squares.
 * x indices are 0..n-1. Returns slope=0,intercept=mean,r2=0 for degenerate input.
 * @param {Array<number>} ys
 * @returns {{slope:number,intercept:number,r2:number}}
 */
function linreg(ys) {
  var n = ys ? ys.length : 0;
  if (!n) return { slope: 0, intercept: 0, r2: 0 };
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    var y = Number(ys[i]);
    if (!Number.isFinite(y)) y = 0;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  var denomX = n * sumX2 - sumX * sumX;
  if (denomX === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  var slope = (n * sumXY - sumX * sumY) / denomX;
  var intercept = (sumY - slope * sumX) / n;
  // r²
  var meanY = sumY / n;
  var ssTot = 0, ssRes = 0;
  for (var j = 0; j < n; j++) {
    var yj = Number(ys[j]);
    if (!Number.isFinite(yj)) yj = 0;
    var pred = slope * j + intercept;
    ssTot += (yj - meanY) * (yj - meanY);
    ssRes += (yj - pred) * (yj - pred);
  }
  var r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  if (r2 < 0) r2 = 0;
  return { slope: slope, intercept: intercept, r2: r2 };
}

/**
 * expfit(ys) → { a, b, r2 } fitting y = a * e^(b*x) via log-linearization.
 * If any y <= 0, that point is skipped (log undefined). If no positive points,
 * returns a degenerate fit with r2=0. r2 is computed in log-space.
 * @param {Array<number>} ys
 * @returns {{a:number,b:number,r2:number}}
 */
function expfit(ys) {
  var n = ys ? ys.length : 0;
  if (!n) return { a: 0, b: 0, r2: 0 };
  var xs = [], lns = [];
  for (var i = 0; i < n; i++) {
    var y = Number(ys[i]);
    if (Number.isFinite(y) && y > 0) {
      xs.push(i);
      lns.push(Math.log(y));
    }
  }
  if (xs.length < 2) return { a: 0, b: 0, r2: 0 };
  var m = xs.length;
  var sumX = 0, sumLn = 0, sumXLn = 0, sumX2 = 0;
  for (var j = 0; j < m; j++) {
    sumX += xs[j];
    sumLn += lns[j];
    sumXLn += xs[j] * lns[j];
    sumX2 += xs[j] * xs[j];
  }
  var denom = m * sumX2 - sumX * sumX;
  if (denom === 0) return { a: Math.exp(sumLn / m), b: 0, r2: 0 };
  var b = (m * sumXLn - sumX * sumLn) / denom;
  var lnA = (sumLn - b * sumX) / m;
  var a = Math.exp(lnA);
  // r2 in log space
  var meanLn = sumLn / m;
  var ssTot = 0, ssRes = 0;
  for (var k = 0; k < m; k++) {
    var pred = lnA + b * xs[k];
    ssTot += (lns[k] - meanLn) * (lns[k] - meanLn);
    ssRes += (lns[k] - pred) * (lns[k] - pred);
  }
  var r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  if (r2 < 0) r2 = 0;
  return { a: a, b: b, r2: r2 };
}

/**
 * projectFit(ys, horizon, fitType) → array of `horizon` projected values
 * extending the series forward.
 * @param {Array<number>} ys — historical series
 * @param {number} horizon — number of points to project forward
 * @param {string} fitType — 'linear' or 'exponential'
 * @returns {Array<number>}
 */
function projectFit(ys, horizon, fitType) {
  if (!ys || !ys.length || horizon <= 0) return [];
  var n = ys.length;
  if (fitType === 'exponential') {
    var ef = expfit(ys);
    if (ef.a === 0 && ef.b === 0) {
      // Fallback to linear if exp fit degenerate
      var lf0 = linreg(ys);
      var out0 = [];
      for (var h0 = 0; h0 < horizon; h0++) out0.push(lf0.slope * (n + h0) + lf0.intercept);
      return out0;
    }
    var out = [];
    for (var h = 0; h < horizon; h++) out.push(ef.a * Math.exp(ef.b * (n + h)));
    return out;
  }
  // linear (default)
  var lf = linreg(ys);
  var res = [];
  for (var i = 0; i < horizon; i++) res.push(lf.slope * (n + i) + lf.intercept);
  return res;
}

/**
 * projectConfidenceBand(ys, horizon, fitType) → { upper, lower } arrays of
 * length `horizon`. The band widens with horizon: width at step h is
 * stdDev * sqrt(1 + h/n) * 1.96 (95% prediction interval approximation).
 * @param {Array<number>} ys — historical series
 * @param {number} horizon
 * @param {string} fitType — 'linear' or 'exponential'
 * @returns {{upper:Array<number>,lower:Array<number>}}
 */
function projectConfidenceBand(ys, horizon, fitType) {
  if (!ys || !ys.length || horizon <= 0) return { upper: [], lower: [] };
  var n = ys.length;
  // Compute residuals and stdDev in the appropriate space
  var residuals = [];
  if (fitType === 'exponential') {
    var ef = expfit(ys);
    for (var i = 0; i < n; i++) {
      var yv = Number(ys[i]);
      if (Number.isFinite(yv) && yv > 0) {
        residuals.push(yv - ef.a * Math.exp(ef.b * i));
      }
    }
  } else {
    var lf = linreg(ys);
    for (var j = 0; j < n; j++) {
      residuals.push(Number(ys[j]) - (lf.slope * j + lf.intercept));
    }
  }
  var dof = Math.max(residuals.length - 2, 1);
  var variance = residuals.reduce(function(s, r) { return s + r * r; }, 0) / dof;
  var stdDev = Math.sqrt(variance);
  var projected = projectFit(ys, horizon, fitType);
  var upper = [], lower = [];
  for (var h = 0; h < horizon; h++) {
    var expansion = stdDev * Math.sqrt(1 + (h + 1) / n) * 1.96;
    upper.push(projected[h] + expansion);
    // Clamp lower at 0 — tokens/cost can't be negative
    lower.push(Math.max(0, projected[h] - expansion));
  }
  return { upper: upper, lower: lower };
}

/**
 * computeQuarterProjection(days, fitType) → {
 *   currentQuarterTotal, projectedNextQuarterTotal, fitType, fitR2
 * }
 * Sums the current quarter's total tokens (or cost) and projects the next
 * quarter using the selected fit. Uses the daily series for fitting.
 * @param {Array} days — day objects with { date, total_tokens, cost_csv, cost_tokens }
 * @param {string} fitType — 'linear' or 'exponential'
 * @param {string} chartType — 'tokens' or 'spend'
 * @returns {{currentQuarterTotal:number,projectedNextQuarterTotal:number,fitType:string,fitR2:number}}
 */
function computeQuarterProjection(days, fitType, chartType) {
  if (!days || !days.length) return { currentQuarterTotal: 0, projectedNextQuarterTotal: 0, fitType: fitType, fitR2: 0 };
  var getVal = function(d) {
    return chartType === 'tokens'
      ? d.total_tokens
      : (d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0));
  };
  var values = days.map(getVal);
  // Determine current quarter from last data point date
  var lastDate = days[days.length - 1].date;
  var yr = parseInt(lastDate.slice(0, 4));
  var mo = parseInt(lastDate.slice(5, 7));
  var qStartMonth = Math.floor((mo - 1) / 3) * 3 + 1; // 1,4,7,10
  // Sum current quarter: Q spans months qStartMonth..qStartMonth+2
  var currentQuarterTotal = 0;
  var qMonths = [qStartMonth, qStartMonth + 1, qStartMonth + 2].map(function(m) {
    return yr + '-' + String(m).padStart(2, '0');
  });
  for (var i = 0; i < days.length; i++) {
    var mon = days[i].date.slice(0, 7);
    if (qMonths.indexOf(mon) !== -1) {
      currentQuarterTotal += getVal(days[i]);
    }
  }
  // Project next quarter (~90 days)
  var projected = projectFit(values, 90, fitType);
  var nextQuarterTotal = projected.reduce(function(s, v) { return s + v; }, 0);
  // r2 from the fit
  var r2;
  if (fitType === 'exponential') {
    r2 = expfit(values).r2;
  } else {
    r2 = linreg(values).r2;
  }
  return {
    currentQuarterTotal: currentQuarterTotal,
    projectedNextQuarterTotal: nextQuarterTotal,
    fitType: fitType,
    fitR2: r2
  };
}

/**
 * getSelectedProjection() → 'none' | 'linear' | 'exponential'
 * @returns {string}
 */
function getSelectedProjection() {
  var sel = document.getElementById('projectionSelect');
  return sel ? (sel.value || 'none') : 'none';
}

/**
 * getSelectedHorizon() → 30 or 90 (default 30)
 * @returns {number}
 */
function getSelectedHorizon() {
  var sel = document.getElementById('horizonSelect');
  if (!sel) return 30;
  var v = parseInt(sel.value, 10);
  return v === 90 ? 90 : 30;
}

/**
 * Build Chart.js datasets for projection overlays on the token & spend charts.
 * Produces a dashed projection line (with null gap from last historical point
 * to first projected point) plus upper/lower confidence band as two filled
 * line datasets. Uses the daily series for fitting, aligns to chart labels.
 *
 * @param {Array} days — grouped day objects (what the charts render)
 * @param {Array} rawDays — original daily series (before groupDays)
 * @param {string} fitType — 'linear' or 'exponential'
 * @param {number} horizon — 30 or 90
 * @param {string} chartType — 'tokens' or 'spend'
 * @returns {Array} Chart.js datasets to push (may be empty)
 */
function buildProjectionDatasets(days, rawDays, fitType, horizon, chartType) {
  if (!days || !days.length || !fitType || fitType === 'none') return [];
  // Fit from the daily series for best resolution
  var source = rawDays && rawDays.length ? rawDays : days;
  var getVal = function(d) {
    return chartType === 'tokens'
      ? d.total_tokens
      : (d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0));
  };
  var ys = source.map(getVal);
  if (ys.length < 2) return [];
  var projected = projectFit(ys, horizon, fitType);
  var band = projectConfidenceBand(ys, horizon, fitType);
  var projColor = chartType === 'tokens' ? '#ff9f1c' : '#ff6b6b';
  var bandColor = projColor;

  // Build label-aligned data arrays:
  // Historical portion: null (projection starts after last historical point)
  // First projected point: connect from last historical value (null gap then
  // dashed line)
  var n = days.length;
  var projData = new Array(n + horizon).fill(null);
  var upperData = new Array(n + horizon).fill(null);
  var lowerData = new Array(n + horizon).fill(null);
  // Connect: set the first projected point's predecessor to last historical val
  if (n > 0) {
    projData[n - 1] = getVal(days[n - 1]); // bridge point
    upperData[n - 1] = getVal(days[n - 1]);
    lowerData[n - 1] = getVal(days[n - 1]);
  }
  for (var h = 0; h < horizon; h++) {
    projData[n + h] = projected[h];
    upperData[n + h] = band.upper[h];
    lowerData[n + h] = band.lower[h];
  }

  return [
    {
      type: 'line',
      label: 'Projection (' + fitType + ', ' + horizon + 'd)',
      data: projData,
      borderColor: projColor,
      backgroundColor: projColor + '20',
      fill: false,
      borderDash: [8, 4],
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      order: 0
    },
    {
      type: 'line',
      label: 'Upper Bound (95%)',
      data: upperData,
      borderColor: 'transparent',
      backgroundColor: bandColor + '15',
      fill: '+1', // fill to next dataset (lower)
      pointRadius: 0,
      tension: 0.3,
      order: 0
    },
    {
      type: 'line',
      label: 'Lower Bound (95%)',
      data: lowerData,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      order: 0
    }
  ];
}

/**
 * Render the projection quarter summary line into #projectionSummary.
 * Shows projected next-quarter total vs current-quarter total for both
 * tokens and spend, using the selected fit type.
 * @param {Array} days — daily series (rawDays / _currentDays)
 * @param {string} fitType — 'linear' or 'exponential'
 */
function renderProjectionSummary(days, fitType) {
  var el = document.getElementById('projectionSummary');
  if (!el) return;
  if (!days || !days.length || !fitType || fitType === 'none') {
    el.innerHTML = '';
    return;
  }
  var tokProj = computeQuarterProjection(days, fitType, 'tokens');
  var spendProj = computeQuarterProjection(days, fitType, 'spend');
  var tokChange = tokProj.currentQuarterTotal > 0
    ? ((tokProj.projectedNextQuarterTotal - tokProj.currentQuarterTotal) / tokProj.currentQuarterTotal * 100).toFixed(1)
    : '0.0';
  var spendChange = spendProj.currentQuarterTotal > 0
    ? ((spendProj.projectedNextQuarterTotal - spendProj.currentQuarterTotal) / spendProj.currentQuarterTotal * 100).toFixed(1)
    : '0.0';
  var tokArrow = parseFloat(tokChange) >= 0 ? '▲' : '▼';
  var spendArrow = parseFloat(spendChange) >= 0 ? '▲' : '▼';
  el.innerHTML = '<span class="proj-summary-item">Next Q Tokens: <strong>' + fmtTok(tokProj.projectedNextQuarterTotal) +
    '</strong> vs current ' + fmtTok(tokProj.currentQuarterTotal) + ' (' + tokArrow + Math.abs(parseFloat(tokChange)) + '%)</span>' +
    '<span class="proj-summary-item">Next Q Spend: <strong>' + fmtUSD(spendProj.projectedNextQuarterTotal) +
    '</strong> vs current ' + fmtUSD(spendProj.currentQuarterTotal) + ' (' + spendArrow + Math.abs(parseFloat(spendChange)) + '%)</span>' +
    '<span class="proj-summary-item">Fit r²: tokens ' + tokProj.fitR2.toFixed(3) + ', spend ' + spendProj.fitR2.toFixed(3) + '</span>';
}

// ─────────────────────────────────────────────
// DSD-GAP-045: Quarterly aggregation helpers
// ─────────────────────────────────────────────

/**
 * Normalize a date string to 'YYYY-MM-DD'.
 * Handles both 'YYYY-MM-DD' (standard) and 'YYYYMMDD' (DeepSeek CSV export format).
 * @param {string} dateStr
 * @returns {string} 'YYYY-MM-DD' or '' for invalid input
 */
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  var s = dateStr.trim();
  // 8-digit YYYYMMDD format (DeepSeek CSV exports)
  if (/^\d{8}$/.test(s) && s.indexOf('-') === -1) {
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  }
  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

/**
 * quarterKey(dateStr) → 'YYYY-Qn'
 * Maps a date string to its calendar quarter key.
 * Handles both 'YYYY-MM-DD' and 'YYYYMMDD' formats (normalizes first).
 * Boundary correctness: Dec 31 → Q4 of its year, Jan 1 → Q1 of its year.
 * @param {string} dateStr — 'YYYY-MM-DD' or 'YYYYMMDD'
 * @returns {string} 'YYYY-Qn' (e.g. '2025-Q4', '2026-Q1') or '' for invalid
 */
function quarterKey(dateStr) {
  var norm = normalizeDate(dateStr);
  if (!norm) return '';
  var yr = parseInt(norm.slice(0, 4), 10);
  var mo = parseInt(norm.slice(5, 7), 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) return '';
  var q = Math.floor((mo - 1) / 3) + 1; // 1..4
  return yr + '-Q' + q;
}

/**
 * quarterLabel(qKey) → human-readable label
 * @param {string} qKey — 'YYYY-Qn' (from quarterKey)
 * @returns {string} e.g. 'Q1 2025' or '' for invalid
 */
function quarterLabel(qKey) {
  if (!qKey || typeof qKey !== 'string') return '';
  var parts = qKey.split('-Q');
  if (parts.length !== 2) return '';
  var yr = parts[0];
  var qn = parseInt(parts[1], 10);
  if (isNaN(qn) || qn < 1 || qn > 4) return '';
  return 'Q' + qn + ' ' + yr;
}

/**
 * aggregateByQuarter(days) → array of quarter aggregation objects, sorted ascending.
 * Each quarter object: { key, label, dayCount, totalTokens, totalCost, avgDailyTokens,
 *   avgDailyCost, byModel: { model: {tokens, cost} }, byWorkspace: { ws: {tokens, cost} } }
 * Cost convention matches KPIs: d.cost_csv || d.cost_tokens.
 * @param {Array} days — day objects from getDailyData
 * @returns {Array<{key:string,label:string,dayCount:number,totalTokens:number,totalCost:number,avgDailyTokens:number,avgDailyCost:number,byModel:Object,byWorkspace:Object}>}
 */
function aggregateByQuarter(days) {
  if (!days || !days.length) return [];
  var buckets = {};
  for (var i = 0; i < days.length; i++) {
    var d = days[i];
    var qk = quarterKey(d.date);
    if (!qk) continue;
    if (!buckets[qk]) {
      buckets[qk] = {
        key: qk,
        label: quarterLabel(qk),
        dayCount: 0,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byWorkspace: {}
      };
    }
    var b = buckets[qk];
    b.dayCount++;
    b.totalTokens += d.total_tokens || 0;
    var cost = d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0);
    b.totalCost += cost;

    // Per-model shares
    if (d.byModel) {
      for (var model in d.byModel) {
        if (!d.byModel.hasOwnProperty(model)) continue;
        if (!b.byModel[model]) b.byModel[model] = { tokens: 0, cost: 0 };
        b.byModel[model].tokens += d.byModel[model].tokens || 0;
        b.byModel[model].cost += d.byModel[model].cost || 0;
      }
    }

    // Per-workspace shares (from _currentDays activeWsId if available, or 'default')
    var wsName = 'default';
    if (typeof activeWsId !== 'undefined' && activeWsId) {
      // Try to find workspace name; fall back to id
      wsName = activeWsId;
    }
    if (!b.byWorkspace[wsName]) b.byWorkspace[wsName] = { tokens: 0, cost: 0 };
    b.byWorkspace[wsName].tokens += d.total_tokens || 0;
    b.byWorkspace[wsName].cost += cost;
  }

  var result = Object.values(buckets).sort(function(a, b) {
    return a.key.localeCompare(b.key);
  });

  // Compute daily averages
  for (var j = 0; j < result.length; j++) {
    var q = result[j];
    q.avgDailyTokens = q.dayCount > 0 ? q.totalTokens / q.dayCount : 0;
    q.avgDailyCost = q.dayCount > 0 ? q.totalCost / q.dayCount : 0;
  }

  return result;
}

/**
 * computeQoQ(quarters) → adds QoQ delta fields to each quarter object.
 * For each quarter (except the first), computes the delta vs the previous quarter.
 * @param {Array} quarters — output of aggregateByQuarter (sorted ascending)
 * @returns {Array} same array with added fields: qoqTokenDelta, qoqTokenPct,
 *   qoqCostDelta, qoqCostPct (null for first quarter)
 */
function computeQoQ(quarters) {
  if (!quarters || !quarters.length) return quarters || [];
  for (var i = 0; i < quarters.length; i++) {
    var q = quarters[i];
    if (i === 0) {
      q.qoqTokenDelta = null;
      q.qoqTokenPct = null;
      q.qoqCostDelta = null;
      q.qoqCostPct = null;
    } else {
      var prev = quarters[i - 1];
      q.qoqTokenDelta = q.totalTokens - prev.totalTokens;
      q.qoqTokenPct = prev.totalTokens > 0
        ? ((q.totalTokens - prev.totalTokens) / prev.totalTokens * 100)
        : null;
      q.qoqCostDelta = q.totalCost - prev.totalCost;
      q.qoqCostPct = prev.totalCost > 0
        ? ((q.totalCost - prev.totalCost) / prev.totalCost * 100)
        : null;
    }
  }
  return quarters;
}

/**
 * Render the quarterly aggregation chart (bar chart of totals + line of daily averages).
 * Reuses the Chart.js patterns: charts registry, destroyChart(id), Chart.js 4.5.1 API.
 * @param {Array} days — day objects from getDailyData
 */
function renderQuarterlyChart(days) {
  destroyChart('quarterly');
  var ctx = document.getElementById('cQuarterly');
  if (!ctx) return;
  var quarters = aggregateByQuarter(days);
  if (!quarters.length) return;

  var labels = quarters.map(function(q) { return q.label; });

  var datasets = [
    {
      type: 'bar',
      label: 'Total Tokens',
      data: quarters.map(function(q) { return q.totalTokens; }),
      backgroundColor: 'rgba(76,110,245,0.6)',
      borderColor: '#4c6ef5',
      borderWidth: 1,
      borderRadius: 4,
      yAxisID: 'y',
      order: 2
    },
    {
      type: 'bar',
      label: 'Total Cost ($)',
      data: quarters.map(function(q) { return q.totalCost; }),
      backgroundColor: 'rgba(57,210,192,0.6)',
      borderColor: '#39d2c0',
      borderWidth: 1,
      borderRadius: 4,
      yAxisID: 'y1',
      order: 3
    },
    {
      type: 'line',
      label: 'Avg Daily Tokens',
      data: quarters.map(function(q) { return q.avgDailyTokens; }),
      borderColor: '#f778ba',
      backgroundColor: 'rgba(247,120,186,0.1)',
      fill: false,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      yAxisID: 'y',
      order: 1
    },
    {
      type: 'line',
      label: 'Avg Daily Cost ($)',
      data: quarters.map(function(q) { return q.avgDailyCost; }),
      borderColor: '#d2a8ff',
      backgroundColor: 'rgba(210,168,255,0.1)',
      fill: false,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      yAxisID: 'y1',
      order: 0
    }
  ];

  var tick = { color: chartTickColor(), font: { size: chartFontSize() } };

  charts.quarterly = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      ...chartCommonOptions(),
      aspectRatio: 2.0,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: chartLegendOptions(),
        tooltip: {
          ...chartTooltipOptions(),
          callbacks: {
            label: function(ctx) {
              var label = ctx.dataset.label || '';
              var val = ctx.parsed.y;
              if (label.indexOf('Cost') !== -1) {
                return label + ': ' + fmtUSD(val);
              }
              return label + ': ' + fmtTok(val);
            }
          }
        }
      },
      scales: {
        x: { ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
        y: {
          position: 'left',
          ticks: { ...tick, callback: function(v) { return fmtTok(v); } },
          grid: { color: chartGridColor() },
          title: { display: true, text: 'Tokens', color: chartTickColor(), font: { size: chartFontSize() } }
        },
        y1: {
          position: 'right',
          ticks: { ...tick, callback: function(v) { return fmtUSD(v); } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Cost ($)', color: chartTickColor(), font: { size: chartFontSize() } }
        }
      }
    }
  });
}

/**
 * Render the QoQ comparison panel into #qoqPanel.
 * Shows quarter-over-quarter delta (absolute + percent) for tokens and cost.
 * @param {Array} days — day objects from getDailyData
 */
function renderQoQPanel(days) {
  var el = document.getElementById('qoqPanel');
  if (!el) return;
  var quarters = computeQoQ(aggregateByQuarter(days));
  if (!quarters.length) {
    el.innerHTML = '';
    return;
  }

  var html = '';
  for (var i = 0; i < quarters.length; i++) {
    var q = quarters[i];
    var isFirst = i === 0;
    var tokArrow = !isFirst && q.qoqTokenDelta != null
      ? (q.qoqTokenDelta >= 0 ? '▲' : '▼')
      : '—';
    var tokPctStr = !isFirst && q.qoqTokenPct != null
      ? Math.abs(q.qoqTokenPct).toFixed(1) + '%'
      : '';
    var costArrow = !isFirst && q.qoqCostDelta != null
      ? (q.qoqCostDelta >= 0 ? '▲' : '▼')
      : '—';
    var costPctStr = !isFirst && q.qoqCostPct != null
      ? Math.abs(q.qoqCostPct).toFixed(1) + '%'
      : '';

    var tokDeltaStr = !isFirst && q.qoqTokenDelta != null
      ? (q.qoqTokenDelta >= 0 ? '+' : '') + fmtTok(q.qoqTokenDelta)
      : '—';
    var costDeltaStr = !isFirst && q.qoqCostDelta != null
      ? (q.qoqCostDelta >= 0 ? '+' : '') + fmtUSD(q.qoqCostDelta)
      : '—';

    html += '<div class="qoq-quarter">';
    html += '<div class="qoq-q-label">' + escapeHtml(q.label) + '</div>';
    html += '<div class="qoq-q-stats">';
    html += '<div class="qoq-stat"><span class="qoq-stat-label">Tokens</span><span class="qoq-stat-total">' + fmtTok(q.totalTokens) + '</span>';
    if (!isFirst) {
      html += '<span class="qoq-stat-delta ' + (q.qoqTokenDelta >= 0 ? 'up' : 'down') + '">' + tokArrow + ' ' + tokDeltaStr + ' (' + tokPctStr + ')</span>';
    } else {
      html += '<span class="qoq-stat-delta first">— first quarter —</span>';
    }
    html += '</div>';
    html += '<div class="qoq-stat"><span class="qoq-stat-label">Cost</span><span class="qoq-stat-total">' + fmtUSD(q.totalCost) + '</span>';
    if (!isFirst) {
      html += '<span class="qoq-stat-delta ' + (q.qoqCostDelta >= 0 ? 'up' : 'down') + '">' + costArrow + ' ' + costDeltaStr + ' (' + costPctStr + ')</span>';
    } else {
      html += '<span class="qoq-stat-delta first">— first quarter —</span>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
}

/**
 * Populate the quarter selector dropdown with available quarters.
 * @param {Array} days — day objects from getDailyData
 */
function populateQuarterSelect(days) {
  var sel = document.getElementById('quarterSelect');
  if (!sel) return;
  var quarters = aggregateByQuarter(days);
  var currentVal = sel.value;
  var html = '<option value="all">All Quarters</option>';
  for (var i = 0; i < quarters.length; i++) {
    html += '<option value="' + escapeHtml(quarters[i].key) + '">' + escapeHtml(quarters[i].label) + '</option>';
  }
  sel.innerHTML = html;
  // Preserve selection if still valid, otherwise reset to 'all'
  if (currentVal && currentVal !== 'all' && quarters.some(function(q) { return q.key === currentVal; })) {
    sel.value = currentVal;
  } else {
    sel.value = 'all';
  }
}

/**
 * Get the selected quarter from the dropdown.
 * @returns {string} quarter key like '2025-Q4' or 'all'
 */
function getSelectedQuarter() {
  var sel = document.getElementById('quarterSelect');
  return sel ? (sel.value || 'all') : 'all';
}

/**
 * Filter days to a specific quarter.
 * @param {Array} days — all day objects
 * @param {string} qKey — quarter key like '2025-Q4' or 'all'
 * @returns {Array} filtered days (or all if qKey is 'all')
 */
function filterDaysByQuarter(days, qKey) {
  if (!days || !days.length || !qKey || qKey === 'all') return days;
  return days.filter(function(d) {
    return quarterKey(d.date) === qKey;
  });
}

/**
 * Render the quarter drilldown chart — daily series for the selected quarter.
 * @param {Array} days — all day objects (will be filtered to the selected quarter)
 * @param {string} qKey — quarter key or 'all'
 */
function renderQuarterDrilldown(days, qKey) {
  destroyChart('qDrilldown');
  var ctx = document.getElementById('cQDrilldown');
  if (!ctx) return;
  var filtered = filterDaysByQuarter(days, qKey);
  if (!filtered.length) return;

  var labels = filtered.map(function(d) { return d.date; });
  var datasets = [
    {
      type: 'bar',
      label: 'Daily Tokens',
      data: filtered.map(function(d) { return d.total_tokens || 0; }),
      backgroundColor: 'rgba(76,110,245,0.5)',
      borderColor: '#4c6ef5',
      borderWidth: 1,
      borderRadius: 2,
      yAxisID: 'y'
    },
    {
      type: 'line',
      label: 'Daily Cost ($)',
      data: filtered.map(function(d) { return d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0); }),
      borderColor: '#39d2c0',
      backgroundColor: 'rgba(57,210,192,0.1)',
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
      yAxisID: 'y1'
    }
  ];

  var tick = { color: chartTickColor(), font: { size: chartFontSize() } };

  charts.qDrilldown = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      ...chartCommonOptions(),
      aspectRatio: 2.2,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: chartLegendOptions(),
        tooltip: {
          ...chartTooltipOptions(),
          callbacks: {
            label: function(ctx) {
              var label = ctx.dataset.label || '';
              var val = ctx.parsed.y;
              if (label.indexOf('Cost') !== -1) {
                return label + ': ' + fmtUSD(val);
              }
              return label + ': ' + fmtTok(val);
            }
          }
        }
      },
      scales: {
        x: { ticks: { ...tick, maxTicksLimit: 20, maxRotation: 45 }, grid: { color: chartGridColor() } },
        y: {
          position: 'left',
          ticks: { ...tick, callback: function(v) { return fmtTok(v); } },
          grid: { color: chartGridColor() },
          title: { display: true, text: 'Tokens', color: chartTickColor(), font: { size: chartFontSize() } }
        },
        y1: {
          position: 'right',
          ticks: { ...tick, callback: function(v) { return fmtUSD(v); } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Cost ($)', color: chartTickColor(), font: { size: chartFontSize() } }
        }
      }
    }
  });
}

/**
 * Build Chart.js line-dataset overlays for the token & spend charts based on
 * the selected trend type. Returns an array of Chart.js dataset objects.
 *
 * @param {Array} days — grouped day objects (what the charts already render)
 * @param {Array} rawDays — original daily series (before groupDays) used for
 *   trend helpers that need daily resolution
 * @param {string} trendType — one of: 'none','rolling7','weeklySum','weeklyAvg','perModel','growth'
 * @param {string} chartType — 'tokens' or 'spend'
 * @returns {Array} Chart.js datasets to push (may be empty)
 */
function buildTrendDatasets(days, rawDays, trendType, chartType) {
  if (!days || !days.length || !trendType || trendType === 'none') return [];

  const trendColor = chartType === 'tokens' ? '#f778ba' : '#d2a8ff';
  const isGrowth = trendType === 'growth';

  if (trendType === 'rolling7') {
    const source = rawDays && rawDays.length ? rawDays : days;
    const vals = source.map(d => chartType === 'tokens' ? d.total_tokens : (d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0)));
    const smoothed = rollingMean(vals, 7);
    // Align by index to grouped labels if days.length === smoothed.length,
    // otherwise align by ratio (map index proportionally)
    let aligned;
    if (smoothed.length === days.length) {
      aligned = smoothed;
    } else {
      aligned = days.map((_, i) => {
        const srcIdx = Math.floor(i * smoothed.length / days.length);
        return smoothed[srcIdx];
      });
    }
    return [{
      type: 'line', label: '7-Day Rolling Avg', data: aligned,
      borderColor: trendColor, backgroundColor: trendColor + '20',
      fill: false, borderDash: [6, 4], tension: 0.3, pointRadius: 0,
      pointHoverRadius: 4, order: 1
    }];
  }

  if (trendType === 'weeklySum' || trendType === 'weeklyAvg') {
    const source = rawDays && rawDays.length ? rawDays : days;
    const weeks = groupByWeek(source);
    if (!weeks.length) return [];
    // Align weekly values to the chart's day labels by finding the week each day falls into
    const weekMap = {};
    for (const w of weeks) { weekMap[w.date] = w; }
    const data = days.map(d => {
      const wk = weekMap[getISOWeekStart(d.date)] || weekMap[getISOWeekStart(d.label || d.date)];
      if (!wk) return null;
      if (trendType === 'weeklySum') return chartType === 'tokens' ? wk.total_tokens : wk.cost;
      // weekly avg = week sum / number of days in that week present in source
      const daysInWeek = source.filter(s => getISOWeekStart(s.date) === wk.date).length || 1;
      return chartType === 'tokens' ? wk.total_tokens / daysInWeek : wk.cost / daysInWeek;
    });
    return [{
      type: 'line', label: trendType === 'weeklySum' ? 'Weekly Sum' : 'Weekly Avg',
      data, borderColor: trendColor, backgroundColor: trendColor + '20',
      fill: false, borderDash: [6, 4], tension: 0.3, pointRadius: 0,
      pointHoverRadius: 4, order: 1
    }];
  }

  if (trendType === 'perModel') {
    const baseColors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950','#f778ba','#79c0ff','#d2a8ff','#ffa657','#56d364','#db6d28'];
    const models = [...new Set(days.flatMap(d => Object.keys(d.byModel || {})))];
    if (!models.length) return [];
    return models.map((m, i) => {
      const base = baseColors[i % baseColors.length];
      return {
        type: 'line', label: m + ' Trend',
        data: days.map(d => {
          const v = d.byModel?.[m];
          return v ? (chartType === 'tokens' ? v.tokens : (v.input_cost + v.output_cost || v.cost || 0)) : null;
        }),
        borderColor: base, backgroundColor: base + '20',
        fill: false, borderDash: [4, 4], tension: 0.3, pointRadius: 0,
        pointHoverRadius: 4, order: 1
      };
    });
  }

  if (trendType === 'growth') {
    const source = rawDays && rawDays.length ? rawDays : days;
    const field = chartType === 'tokens' ? 'total_tokens' : 'cost_csv';
    const rates = growthRate(source, field);
    // Align by index
    let aligned;
    if (rates.length === days.length) {
      aligned = rates;
    } else {
      aligned = days.map((_, i) => {
        const srcIdx = Math.floor(i * rates.length / days.length);
        return rates[srcIdx];
      });
    }
    return [{
      type: 'line', label: 'Day-over-Day Growth %', data: aligned,
      borderColor: trendColor, backgroundColor: trendColor + '20',
      fill: false, borderDash: [6, 4], tension: 0.3, pointRadius: 0,
      pointHoverRadius: 4, order: 1
    }];
  }

  return [];
}

/**
 * Returns the currently selected trend type from the trendSelect control.
 * @returns {string}
 */
function getSelectedTrend() {
  const sel = document.getElementById('trendSelect');
  return sel ? (sel.value || 'none') : 'none';
}

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
  const keyFilter = document.getElementById('keySelect').value || 'all';

  const days = getDailyData(period, modelFilter, keyFilter);
  _currentDays = days;
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  const chartDays = groupDays(days, granularity);
  _groupedDays = chartDays;

  // DSD-GAP-046: multi-workspace overlay — when 2+ workspaces are selected in
  // the switcher, gather one (grouped) series per workspace, reusing the same
  // period/model/key filters, for the token + spend overlay charts. The other
  // renderers (KPIs, pie, ratio, per-key, quarterly) stay on the active
  // workspace by design.
  const wsIds = getSelectedWorkspaceIds();
  if (wsIds.length >= 2) {
    _overlaySeries = wsIds.map(id => ({
      id,
      name: getWorkspaceName(id),
      days: groupDays(getDailyData(period, modelFilter, keyFilter, id), granularity)
    }));
  } else {
    _overlaySeries = null;
  }

  if (!days.length && !(_overlaySeries && _overlaySeries.some(s => s.days.length))) {
    document.getElementById('kpiGrid').innerHTML = '<div style="color:var(--text-dim);padding:20px">' + emptyStateMessage(workspaceHasData(), period) + '</div>';
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
  renderKeyChart(chartDays, keyFilter);

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
  keySel.value = keys.includes(keyFilter) ? keyFilter : 'all';

  // Refresh upload history
  renderUploadHistory();

  // DSD-GAP-044: Projection quarter summary
  renderProjectionSummary(days, getSelectedProjection());

  // DSD-GAP-045: Quarterly aggregation view
  populateQuarterSelect(days);
  renderQuarterlyChart(days);
  renderQoQPanel(days);
  var selQ = getSelectedQuarter();
  renderQuarterDrilldown(days, selQ);

  // DSD-GAP-047: Insights Gallery
  renderInsightGallery();

  // Refresh raw data table
  renderTable(days, modelFilter, keyFilter);
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

// ─────────────────────────────────────────────
// DSD-GAP-046: Multi-workspace overlay charting
// ─────────────────────────────────────────────

// Per-workspace palette: each workspace gets a hue; within a workspace the
// input/total series is solid and the output series is translucent + dashed.
const OVERLAY_WS_COLORS = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950','#f778ba','#79c0ff','#ffa657','#56d364','#db6d28','#d2a8ff'];

/**
 * getOverlayNormalized() → whether the "Normalize (index=100)" checkbox is
 * checked. Only meaningful in overlay mode (2+ workspaces selected).
 * @returns {boolean}
 */
function getOverlayNormalized() {
  const cb = document.getElementById('overlayToggle');
  return !!(cb && cb.checked);
}

/**
 * getSelectedWorkspaceIds() → ids of the workspace options currently selected
 * in the multi-select switcher. Empty string placeholder (No Workspace) is
 * excluded, so a single selection yields a 1-element array.
 * @returns {Array<string>}
 */
function getSelectedWorkspaceIds() {
  const sel = document.getElementById('wsSelect');
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => o.value).filter(v => v);
}

/**
 * getWorkspaceName(id) → display name for a workspace id (falls back to the
 * id itself when the workspace no longer exists).
 * @param {string} id
 * @returns {string}
 */
function getWorkspaceName(id) {
  const ws = getWorkspaces().find(w => w.id === id);
  return ws ? ws.name : id;
}

/**
 * normalizeIndex(values) → index series where the FIRST NON-ZERO value maps
 * to 100 and every other value is scaled by the same factor, so differently
 * sized series become shape-comparable. Null/undefined entries (e.g. the
 * projection gap) pass through untouched; an all-zero or empty series is
 * returned unchanged (no meaningful base).
 * @param {Array<number|null>} values
 * @returns {Array<number|null>}
 */
function normalizeIndex(values) {
  if (!values || !values.length) return values ? values.slice() : [];
  let base = null;
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) { base = n; break; }
  }
  if (base == null) return values.slice();
  const scale = 100 / base;
  return values.map(v => {
    if (v == null || v === '') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n * scale : v;
  });
}

/**
 * buildOverlayTokenDatasets(series, normalized) → Chart.js datasets for the
 * Token Usage chart in overlay mode: one Input/Output pair per workspace,
 * labels prefixed with the workspace name, shared x axis. When `normalized`
 * is true each dataset's values are the index=100 series (raw values are
 * kept on `_raw` so tooltips can still show real numbers).
 * @param {Array<{name:string, days:Array}>} series
 * @param {boolean} normalized
 * @returns {Array<Object>}
 */
function buildOverlayTokenDatasets(series, normalized) {
  const datasets = [];
  (series || []).forEach((s, i) => {
    const base = OVERLAY_WS_COLORS[i % OVERLAY_WS_COLORS.length];
    const input = s.days.map(d => (d.cache_hit || 0) + (d.cache_miss || 0));
    const output = s.days.map(d => d.output || 0);
    const inputData = normalized ? normalizeIndex(input) : input;
    const outputData = normalized ? normalizeIndex(output) : output;
    datasets.push({
      label: s.name + ' — Input Tokens',
      data: inputData,
      _raw: input,
      borderColor: base,
      backgroundColor: base + '22',
      fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, hoverBorderWidth: 2
    });
    datasets.push({
      label: s.name + ' — Output Tokens',
      data: outputData,
      _raw: output,
      borderColor: base + 'cc',
      backgroundColor: base + '0d',
      borderDash: [4, 4],
      fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, hoverBorderWidth: 2
    });
  });
  return datasets;
}

/**
 * buildOverlaySpendDatasets(series, normalized) → Chart.js datasets for the
 * Daily Spend chart in overlay mode: one per-workspace daily-cost line on
 * shared axes. Normalized mode scales each series to index=100 at its first
 * non-zero day (raw values kept on `_raw` for tooltips).
 * @param {Array<{name:string, days:Array}>} series
 * @param {boolean} normalized
 * @returns {Array<Object>}
 */
function buildOverlaySpendDatasets(series, normalized) {
  const datasets = [];
  (series || []).forEach((s, i) => {
    const base = OVERLAY_WS_COLORS[i % OVERLAY_WS_COLORS.length];
    const cost = s.days.map(d => (d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0)));
    datasets.push({
      type: 'line',
      label: s.name + ' — Daily Cost',
      data: normalized ? normalizeIndex(cost) : cost,
      _raw: cost,
      borderColor: base,
      backgroundColor: base + '22',
      fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, hoverBorderWidth: 2
    });
  });
  return datasets;
}

/**
 * overlayTooltipLabel(ctx) → tooltip label for overlay datasets: dataset
 * label + the REAL value (from `_raw`) even when the plotted series is the
 * normalized index.
 * @param {Object} ctx — Chart.js tooltip callback context
 * @param {string} kind — 'tokens' or 'spend'
 * @returns {string}
 */
function overlayTooltipLabel(ctx, kind) {
  const raw = ctx.dataset._raw && ctx.dataset._raw[ctx.dataIndex] != null
    ? ctx.dataset._raw[ctx.dataIndex]
    : ctx.parsed.y;
  return ctx.dataset.label + ': ' + (kind === 'tokens' ? fmtTok(raw) + ' tokens' : fmtUSD(raw));
}

/**
 * resolveOverlaySeries(days, series) → the effective per-workspace series for
 * a chart render. Explicit param wins; otherwise the module-level series set
 * by refreshAll (so trend/projection/normalize re-render handlers keep the
 * overlay intact without changing their call sites).
 * @param {Array} days — active workspace (grouped) days, used for labels
 * @param {Array|null|undefined} series
 * @returns {{series:Array|null, isOverlay:boolean}}
 */
function resolveOverlaySeries(series) {
  const s = series || _overlaySeries;
  return { series: s, isOverlay: !!(s && s.length >= 2) };
}

// DSD-GAP-046: optional per-workspace series param. With 2+ workspaces the
// chart switches to overlay mode (per-workspace series on shared axes,
// optional index=100 normalization). Single-workspace rendering below is
// unchanged byte-for-byte.
function renderTokenChart(days, series) {
  destroyChart('tokens');
  const ctx = document.getElementById('cTokens').getContext('2d');

  const overlay = resolveOverlaySeries(series);
  if (overlay.isOverlay) {
    const normalized = getOverlayNormalized();
    const datasets = buildOverlayTokenDatasets(overlay.series, normalized);
    var chartLabels = days.map(d => d.label || fmtDate(d.date));
    const scales = normalized
      ? chartScalesOptions('Index (100 = first non-zero day)', v => Number(v).toFixed(0))
      : chartScalesOptions('Tokens', v => fmtTok(v));
    charts.tokens = new Chart(ctx, {
      type: 'line',
      data: { labels: chartLabels, datasets },
      options: {
        ...chartCommonOptions(), aspectRatio: 2.2,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: chartLegendOptions(), tooltip: { ...chartTooltipOptions(), callbacks: { label: c => overlayTooltipLabel(c, 'tokens') } } },
        scales
      }
    });
    return;
  }

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

  // DSD-GAP-043: Trend overlays
  const trendType = getSelectedTrend();
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  // Trend overlays compute from the ORIGINAL daily series; only apply when daily
  // granularity so alignment is unambiguous (documented behavior).
  if (trendType !== 'none' && granularity === 'daily') {
    const trendDatasets = buildTrendDatasets(days, _currentDays, trendType, 'tokens');
    datasets.push(...trendDatasets);
  }

  // DSD-GAP-044: Projection overlays (only on daily granularity)
  const projType = getSelectedProjection();
  if (projType !== 'none' && granularity === 'daily') {
    const horizon = getSelectedHorizon();
    const projDatasets = buildProjectionDatasets(days, _currentDays, projType, horizon, 'tokens');
    datasets.push(...projDatasets);
  }

  const isGrowth = trendType === 'growth' && granularity === 'daily';
  const tooltipCb = isGrowth
    ? ctx => ctx.dataset.label + ': ' + (ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(1) + '%')
    : ctx => ctx.dataset.label + ': ' + fmtTok(ctx.parsed.y) + ' tokens';
  const scales = isGrowth
    ? { ...chartScalesOptions('Tokens', v => fmtTok(v)), yGrowth: { position: 'right', ticks: { color: chartTickColor(), font: { size: chartFontSize() }, callback: v => v.toFixed(0) + '%' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Growth %', color: chartTickColor(), font: { size: chartFontSize() } } } }
    : chartScalesOptions('Tokens', v => fmtTok(v));

  // Extend labels for projection horizon
  var projLabelCount = days.length;
  if (projType !== 'none' && granularity === 'daily') {
    projLabelCount = days.length + getSelectedHorizon();
  }
  var chartLabels = days.map(d => d.label || fmtDate(d.date));
  if (projLabelCount > chartLabels.length) {
    // Add projected date labels
    var lastDate = days.length ? new Date(days[days.length - 1].date + 'T00:00:00') : new Date();
    for (var pl = chartLabels.length; pl < projLabelCount; pl++) {
      lastDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
      chartLabels.push(lastDate.toISOString().slice(0, 10));
    }
  }

  charts.tokens = new Chart(ctx, {
    type: 'line',
    data: { labels: chartLabels, datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 2.2,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: chartLegendOptions(), tooltip: { ...chartTooltipOptions(), callbacks: { label: tooltipCb } } },
      scales
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

// DSD-GAP-046: optional per-workspace series param. With 2+ workspaces the
// stacked per-model bars switch to per-workspace daily-cost lines on shared
// axes (optional index=100 normalization). Single-workspace rendering below
// is unchanged byte-for-byte.
function renderSpendChart(days, series) {
  destroyChart('spend');
  const ctx = document.getElementById('cSpend').getContext('2d');

  const overlay = resolveOverlaySeries(series);
  if (overlay.isOverlay) {
    const normalized = getOverlayNormalized();
    const datasets = buildOverlaySpendDatasets(overlay.series, normalized);
    var spendLabels = days.map(d => d.label || fmtDate(d.date));
    const scales = {
      x: { ticks: { color: chartTickColor(), font: { size: chartFontSize() }, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
      y: normalized
        ? { ticks: { color: chartTickColor(), font: { size: chartFontSize() }, callback: v => Number(v).toFixed(0) }, grid: { color: chartGridColor() }, title: { display: true, text: 'Index (100 = first non-zero day)', color: chartTickColor(), font: { size: chartFontSize() } } }
        : { ticks: { color: chartTickColor(), font: { size: chartFontSize() }, callback: v => fmtUSD(v) }, grid: { color: chartGridColor() }, title: { display: true, text: 'Cost', color: chartTickColor(), font: { size: chartFontSize() } } }
    };
    charts.spend = new Chart(ctx, {
      type: 'line',
      data: { labels: spendLabels, datasets },
      options: {
        ...chartCommonOptions(), aspectRatio: 1.6,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: chartLegendOptions(), tooltip: { ...chartTooltipOptions(), callbacks: { label: c => overlayTooltipLabel(c, 'spend') } } },
        scales
      }
    });
    return;
  }

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

  // DSD-GAP-043: Trend overlays
  const trendType = getSelectedTrend();
  const granularity = document.getElementById('granularitySelect')?.value || 'daily';
  if (trendType !== 'none' && granularity === 'daily') {
    const trendDatasets = buildTrendDatasets(days, _currentDays, trendType, 'spend');
    datasets.push(...trendDatasets);
  }

  // DSD-GAP-044: Projection overlays (only on daily granularity)
  const projType = getSelectedProjection();
  if (projType !== 'none' && granularity === 'daily') {
    const horizon = getSelectedHorizon();
    const projDatasets = buildProjectionDatasets(days, _currentDays, projType, horizon, 'spend');
    datasets.push(...projDatasets);
  }

  const isGrowth = trendType === 'growth' && granularity === 'daily';
  const tooltipCb = isGrowth
    ? ctx => ctx.dataset.label + ': ' + (ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(1) + '%')
    : ctx => ctx.dataset.label + ': ' + fmtUSD(ctx.parsed.y);

  const tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  const scales = {
    x: { stacked: true, ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } },
    y: { stacked: true, ticks: { ...tick, callback: v => fmtUSD(v) }, grid: { color: chartGridColor() } }
  };
  if (isGrowth) {
    scales.yGrowth = { position: 'right', stacked: false, ticks: { color: chartTickColor(), font: { size: chartFontSize() }, callback: v => v.toFixed(0) + '%' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Growth %', color: chartTickColor(), font: { size: chartFontSize() } } };
  }

  // Extend labels for projection horizon
  var spendLabels = labels;
  if (projType !== 'none' && granularity === 'daily') {
    spendLabels = labels.slice();
    var lastSDate = days.length ? new Date(days[days.length - 1].date + 'T00:00:00') : new Date();
    for (var spl = spendLabels.length; spl < days.length + getSelectedHorizon(); spl++) {
      lastSDate = new Date(lastSDate.getTime() + 24 * 60 * 60 * 1000);
      spendLabels.push(lastSDate.toISOString().slice(0, 10));
    }
  }

  charts.spend = new Chart(ctx, {
    type: 'bar',
    data: { labels: spendLabels, datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 1.6,
      plugins: { legend: { labels: { color: chartTickColor(), usePointStyle: true, padding: 8, font: { size: chartFontSize() } } },
        tooltip: { ...chartTooltipOptions(), callbacks: { label: tooltipCb } } },
      scales
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

function renderKeyChart(days, keyFilter) {
  destroyChart('key');
  if (!activeWsId) return;

  // Get per-key costs from DB
  let where = 'workspace_id = ? AND type != \'request_count\'';
  const params = [activeWsId];
  if (keyFilter && keyFilter !== 'all') { where += ' AND api_key_name = ?'; params.push(keyFilter); }
  const r = db.exec(`SELECT api_key_name, SUM(price*amount) as total_cost FROM token_usage WHERE ${where} GROUP BY api_key_name ORDER BY total_cost DESC`, params);
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

// ─────────────────────────────────────────────
// DSD-GAP-047: Implicit-Insights Gallery
// Juxtaposition charts that surface the story purely visually — no narrative
// text. Each helper is a pure function returning data; renderInsightGallery
// maps the data to Chart.js datasets.
// ─────────────────────────────────────────────

var INSIGHT_LS_KEY = 'ds-dash-insight-view';
var _insightView = 'shareDivergence';

/**
 * tokenVsCostShareDivergence(days, series) → per-day per-workspace share data.
 * For each day, computes each workspace's share of total tokens (tokenShare)
 * and total cost (costShare), both 0–100. delta = costShare − tokenShare;
 * positive delta means the workspace is getting proportionally more expensive.
 *
 * Uses overlay series resolution (2+ workspaces). Falls back to a single
 * workspace (the active one) if no overlay is active.
 *
 * @param {Array} days — active workspace day objects (for date labels)
 * @param {Array|null} series — overlay series [{id,name,days}] or null
 * @returns {{labels:Array<string>, rows:Array<{wsId:string,wsName:string,tokenShare:Array<number>,costShare:Array<number>,delta:Array<number>}>}}
 */
function tokenVsCostShareDivergence(days, series) {
  var s = series && series.length >= 2 ? series : null;
  var labels = [];
  var rows = [];

  if (!s) {
    // Single workspace: trivially 100/100 for every day — not interesting,
    // but keep the interface consistent.
    if (!days || !days.length) return { labels: [], rows: [] };
    labels = days.map(function(d) { return d.label || fmtDate(d.date); });
    rows.push({
      wsId: 'single',
      wsName: 'Active',
      tokenShare: days.map(function() { return 100; }),
      costShare: days.map(function() { return 100; }),
      delta: days.map(function() { return 0; })
    });
    return { labels: labels, rows: rows };
  }

  // Align by date: build a date→index map from the first series
  var dateList = s[0].days.map(function(d) { return normalizeDate(d.date); });
  labels = dateList.map(function(d) { return fmtDate(d); });

  // For each workspace, extract tokens and cost per aligned date
  var wsData = s.map(function(ws) {
    var dayMap = {};
    ws.days.forEach(function(d) {
      var nd = normalizeDate(d.date);
      if (nd) {
        dayMap[nd] = {
          tokens: d.total_tokens || 0,
          cost: d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0)
        };
      }
    });
    return { id: ws.id, name: ws.name, dayMap: dayMap };
  });

  for (var di = 0; di < dateList.length; di++) {
    var dt = dateList[di];
    var totalTokens = 0;
    var totalCost = 0;
    for (var wi = 0; wi < wsData.length; wi++) {
      var entry = wsData[wi].dayMap[dt];
      if (entry) {
        totalTokens += entry.tokens;
        totalCost += entry.cost;
      }
    }
    for (var wj = 0; wj < wsData.length; wj++) {
      var e = wsData[wj].dayMap[dt];
      var tok = e ? e.tokens : 0;
      var cst = e ? e.cost : 0;
      if (!rows[wj]) {
        rows[wj] = {
          wsId: wsData[wj].id,
          wsName: wsData[wj].name,
          tokenShare: [],
          costShare: [],
          delta: []
        };
      }
      rows[wj].tokenShare.push(totalTokens > 0 ? (tok / totalTokens * 100) : 0);
      rows[wj].costShare.push(totalCost > 0 ? (cst / totalCost * 100) : 0);
      var ts = totalTokens > 0 ? (tok / totalTokens * 100) : 0;
      var cs = totalCost > 0 ? (cst / totalCost * 100) : 0;
      rows[wj].delta.push(cs - ts);
    }
  }

  return { labels: labels, rows: rows };
}

/**
 * weekdayShape(days, series) → per-workspace avg usage by weekday (0=Sun..6=Sat),
 * normalized to index=100 at each workspace's max weekday.
 *
 * Uses overlay series when available (2+ workspaces); falls back to active
 * workspace days. Returns one row per workspace with 7 data points (Sun..Sat).
 *
 * @param {Array} days — active workspace day objects
 * @param {Array|null} series — overlay series or null
 * @returns {{labels:Array<string>, rows:Array<{wsId:string,wsName:string,data:Array<number>}>}}
 */
function weekdayShape(days, series) {
  var s = series && series.length >= 2 ? series : null;
  var labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var rows = [];

  var sources;
  if (s) {
    sources = s.map(function(ws) {
      return { id: ws.id, name: ws.name, days: ws.days };
    });
  } else {
    if (!days || !days.length) return { labels: labels, rows: [] };
    sources = [{ id: 'single', name: 'Active', days: days }];
  }

  for (var si = 0; si < sources.length; si++) {
    var wsDays = sources[si].days;
    var sums = [0, 0, 0, 0, 0, 0, 0];
    var counts = [0, 0, 0, 0, 0, 0, 0];
    for (var di = 0; di < wsDays.length; di++) {
      var norm = normalizeDate(wsDays[di].date);
      if (!norm) continue;
      var dow = new Date(norm + 'T00:00:00').getDay(); // 0=Sun
      sums[dow] += wsDays[di].total_tokens || 0;
      counts[dow]++;
    }
    // Average per weekday that has data
    var avgs = [0, 0, 0, 0, 0, 0, 0];
    var maxAvg = 0;
    for (var wdi = 0; wdi < 7; wdi++) {
      if (counts[wdi] > 0) {
        avgs[wdi] = sums[wdi] / counts[wdi];
        if (avgs[wdi] > maxAvg) maxAvg = avgs[wdi];
      }
    }
    // Normalize to 100 at max
    var normalized = [0, 0, 0, 0, 0, 0, 0];
    if (maxAvg > 0) {
      for (var ni = 0; ni < 7; ni++) {
        normalized[ni] = (avgs[ni] / maxAvg) * 100;
      }
    }
    rows.push({
      wsId: sources[si].id,
      wsName: sources[si].name,
      data: normalized
    });
  }

  return { labels: labels, rows: rows };
}

/**
 * cpmDrift(days, modelFilter) → cost-per-million-tokens per week per model.
 * cost = sum(price*amount) from token_usage, tokens = sum(cache_hit + cache_miss + output).
 * CPM = cost * 1e6 / tokens.
 *
 * Uses groupByWeek to bucket days into weeks. When modelFilter is 'all',
 * produces one series per model; when a specific model is selected, produces
 * a single series for that model.
 *
 * @param {Array} days — day objects from getDailyData
 * @param {string} modelFilter — 'all' or a model name
 * @returns {{labels:Array<string>, rows:Array<{model:string,data:Array<number|null>}>}}
 */
function cpmDrift(days, modelFilter) {
  if (!days || !days.length) return { labels: [], rows: [] };

  // Collect all models present in byModel
  var modelSet = {};
  for (var di = 0; di < days.length; di++) {
    if (days[di].byModel) {
      for (var m in days[di].byModel) {
        if (days[di].byModel.hasOwnProperty(m)) modelSet[m] = true;
      }
    }
  }
  var models;
  if (modelFilter && modelFilter !== 'all') {
    models = modelSet[modelFilter] ? [modelFilter] : [];
  } else {
    models = Object.keys(modelSet).sort();
  }
  if (!models.length) return { labels: [], rows: [] };

  // Group days by ISO week
  var weeks = groupByWeek(days);
  var labels = weeks.map(function(w) { return w.label; });

  var rows = [];
  for (var mi = 0; mi < models.length; mi++) {
    var model = models[mi];
    var data = [];
    for (var wi = 0; wi < weeks.length; wi++) {
      var weekDate = weeks[wi].date; // ISO week start
      var cost = 0;
      var tokens = 0;
      for (var dj = 0; dj < days.length; dj++) {
        if (getISOWeekStart(days[dj].date) !== weekDate) continue;
        var bm = days[dj].byModel && days[dj].byModel[model];
        if (bm) {
          cost += bm.cost || 0;
          tokens += (bm.cache_hit || 0) + (bm.cache_miss || 0) + (bm.output || 0);
        }
      }
      if (tokens > 0) {
        data.push((cost * 1e6) / tokens);
      } else {
        data.push(null);
      }
    }
    rows.push({ model: model, data: data });
  }

  return { labels: labels, rows: rows };
}

/**
 * cacheHitRatio(days) → daily cache-hit ratio (0–100%).
 * ratio = cache_hit / (cache_hit + cache_miss) * 100.
 * Returns per-day values aligned to the day array.
 *
 * @param {Array} days — day objects from getDailyData
 * @returns {{labels:Array<string>, data:Array<number|null>}}
 */
function cacheHitRatio(days) {
  if (!days || !days.length) return { labels: [], data: [] };
  var labels = days.map(function(d) { return d.label || fmtDate(d.date); });
  var data = [];
  for (var i = 0; i < days.length; i++) {
    var hit = days[i].cache_hit || 0;
    var miss = days[i].cache_miss || 0;
    if (hit + miss > 0) {
      data.push((hit / (hit + miss)) * 100);
    } else {
      data.push(null);
    }
  }
  return { labels: labels, data: data };
}

/**
 * projectionCrossings(series) → detect projected spend crossing points between
 * workspace pairs. Uses projectFit (linear) per workspace on the spend series,
 * then finds the first future index where workspace B overtakes A.
 *
 * @param {Array} series — overlay series [{id,name,days}]
 * @param {number} [horizon=90] — projection horizon in days
 * @returns {{labels:Array<string>, projections:Array<{wsId:string,wsName:string,data:Array<number|null>}>}, crossings:Array<{aId:string,bId:string,aName:string,bName:string,crossIndex:number}>}
 */
function projectionCrossings(series, horizon) {
  var h = horizon || 90;
  if (!series || series.length < 2) return { labels: [], projections: [], crossings: [] };

  // Build spend series per workspace
  var wsData = series.map(function(ws) {
    var cost = ws.days.map(function(d) {
      return d.cost_csv != null ? d.cost_csv : (d.cost_tokens || 0);
    });
    return { id: ws.id, name: ws.name, cost: cost };
  });

  // Date labels from the first workspace
  var dateLabels = series[0].days.map(function(d) { return normalizeDate(d.date); });
  var histLen = dateLabels.length;

  // Project each workspace forward
  var projections = [];
  for (var i = 0; i < wsData.length; i++) {
    var proj = projectFit(wsData[i].cost, h, 'linear');
    // Build aligned data: nulls for history, then projected values
    var data = new Array(histLen).fill(null);
    // Bridge: set last historical point so the line connects
    if (histLen > 0 && wsData[i].cost.length > 0) {
      data[histLen - 1] = wsData[i].cost[wsData[i].cost.length - 1];
    }
    for (var p = 0; p < proj.length; p++) {
      data.push(proj[p]);
    }
    projections.push({
      wsId: wsData[i].id,
      wsName: wsData[i].name,
      data: data
    });
  }

  // Extend date labels for the projection horizon
  var allLabels = dateLabels.slice();
  if (histLen > 0) {
    var lastDate = new Date(dateLabels[dateLabels.length - 1] + 'T00:00:00');
    for (var li = 0; li < h; li++) {
      lastDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
      allLabels.push(lastDate.toISOString().slice(0, 10));
    }
  }

  // Detect crossings between every pair of projected lines
  var crossings = [];
  for (var ai = 0; ai < projections.length; ai++) {
    for (var bi = ai + 1; bi < projections.length; bi++) {
      var aData = projections[ai].data;
      var bData = projections[bi].data;
      for (var ci = histLen; ci < aData.length; ci++) {
        // We want the first index where B overtakes A (B > A after A was >= B)
        var aVal = aData[ci];
        var bVal = bData[ci];
        if (aVal == null || bVal == null) continue;
        // Check if they cross: previously A >= B and now B > A, or vice versa
        if (ci > 0) {
          var aPrev = aData[ci - 1];
          var bPrev = bData[ci - 1];
          if (aPrev != null && bPrev != null) {
            if (aPrev >= bPrev && bVal > aVal) {
              // B overtakes A
              crossings.push({
                aId: projections[ai].wsId,
                bId: projections[bi].wsId,
                aName: projections[ai].wsName,
                bName: projections[bi].wsName,
                crossIndex: ci
              });
              break; // first crossing only
            }
            if (bPrev >= aPrev && aVal > bVal) {
              // A overtakes B
              crossings.push({
                aId: projections[bi].wsId,
                bId: projections[ai].wsId,
                aName: projections[bi].wsName,
                bName: projections[ai].wsName,
                crossIndex: ci
              });
              break; // first crossing only
            }
          }
        }
      }
    }
  }

  return { labels: allLabels, projections: projections, crossings: crossings };
}

/**
 * renderInsightGallery() → renders the currently selected insight view on
 * canvas #cInsight. Respects current model/key/period filters and workspace
 * multi-select. Called from refreshAll() and on insight-view button click.
 */
function renderInsightGallery() {
  destroyChart('insight');
  var ctx = document.getElementById('cInsight');
  if (!ctx) return;

  var period = document.getElementById('periodSelect').value || 'all';
  var modelFilter = document.getElementById('modelSelect').value || 'all';
  var keyFilter = document.getElementById('keySelect').value || 'all';

  var days = _currentDays;
  var series = _overlaySeries;

  var tick = { color: chartTickColor(), font: { size: chartFontSize() } };
  var datasets = [];
  var labels = [];
  var scalesX = { ticks: { ...tick, maxTicksLimit: 14 }, grid: { color: chartGridColor() } };
  var scalesY = { ticks: { ...tick, callback: function(v) { return Number(v).toFixed(0) + '%'; } }, grid: { color: chartGridColor() }, title: { display: true, text: 'Share (%)', color: chartTickColor(), font: { size: chartFontSize() } }, min: 0, max: 100 };

  if (_insightView === 'shareDivergence') {
    var div = tokenVsCostShareDivergence(days, series);
    labels = div.labels;
    var divColors = OVERLAY_WS_COLORS;
    div.rows.forEach(function(row, ri) {
      var base = divColors[ri % divColors.length];
      datasets.push({
        type: 'line', label: row.wsName + ' — Token Share',
        data: row.tokenShare, borderColor: base,
        backgroundColor: base + '15', fill: false,
        tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      });
      datasets.push({
        type: 'line', label: row.wsName + ' — Cost Share',
        data: row.costShare, borderColor: base + 'aa',
        backgroundColor: base + '08', fill: false,
        borderDash: [4, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      });
      // Divergence markers: when |delta| grows monotonically over last 7 days,
      // draw a point marker on the cost-share series at the last day.
      if (row.delta.length >= 8) {
        var last7 = row.delta.slice(-7);
        var abs7 = last7.map(function(d) { return Math.abs(d); });
        var growing = true;
        for (var gi = 1; gi < abs7.length; gi++) {
          if (abs7[gi] <= abs7[gi - 1]) { growing = false; break; }
        }
        if (growing && abs7[abs7.length - 1] > 0.5) {
          // Marker point on the cost share at the last day
          var markerData = new Array(row.costShare.length).fill(null);
          markerData[markerData.length - 1] = row.costShare[row.costShare.length - 1];
          datasets.push({
            type: 'scatter', label: row.wsName + ' — Diverging',
            data: markerData,
            pointBackgroundColor: base, pointBorderColor: '#ffffff',
            pointRadius: 7, pointHoverRadius: 9, pointBorderWidth: 2,
            showLine: false
          });
        }
      }
    });
    scalesY.title.text = 'Share (%)';
  } else if (_insightView === 'weekdayShape') {
    var shape = weekdayShape(days, series);
    labels = shape.labels;
    var wsColors = OVERLAY_WS_COLORS;
    shape.rows.forEach(function(row, ri) {
      var base = wsColors[ri % wsColors.length];
      datasets.push({
        type: 'line', label: row.wsName,
        data: row.data, borderColor: base,
        backgroundColor: base + '20', fill: false,
        tension: 0.35, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2
      });
    });
    scalesY.title.text = 'Normalized Usage (100 = peak weekday)';
    scalesY.min = 0;
    scalesY.max = 110;
  } else if (_insightView === 'cpmDrift') {
    var drift = cpmDrift(days, modelFilter);
    labels = drift.labels;
    var dColors = ['#4c6ef5','#39d2c0','#a371f7','#d2991d','#f85149','#3fb950','#f778ba','#79c0ff','#d2a8ff','#ffa657','#56d364','#db6d28'];
    drift.rows.forEach(function(row, ri) {
      var base = dColors[ri % dColors.length];
      datasets.push({
        type: 'line', label: row.model,
        data: row.data, borderColor: base,
        backgroundColor: base + '15', fill: false,
        tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
        spanGaps: true
      });
    });
    scalesY = { ticks: { ...tick, callback: function(v) { return '$' + Number(v).toFixed(2); } }, grid: { color: chartGridColor() }, title: { display: true, text: 'Cost per Million Tokens ($)', color: chartTickColor(), font: { size: chartFontSize() } } };
  } else if (_insightView === 'cacheRatio') {
    var chr = cacheHitRatio(days);
    labels = chr.labels;
    datasets.push({
      type: 'line', label: 'Cache Hit Ratio',
      data: chr.data, borderColor: '#39d2c0',
      backgroundColor: 'rgba(57,210,192,0.18)', fill: true,
      tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
    });
    scalesY.title.text = 'Cache Hit Ratio (%)';
    scalesY.min = 0;
    scalesY.max = 100;
  } else if (_insightView === 'crossingMarkers') {
    var cross = projectionCrossings(series, getSelectedHorizon());
    labels = cross.labels;
    var cColors = OVERLAY_WS_COLORS;
    cross.projections.forEach(function(proj, pi) {
      var base = cColors[pi % cColors.length];
      datasets.push({
        type: 'line', label: proj.wsName + ' (projected)',
        data: proj.data, borderColor: base,
        backgroundColor: base + '10', fill: false,
        borderDash: [8, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      });
    });
    // Crossing markers as scatter points
    cross.crossings.forEach(function(c, ci) {
      var markerColor = '#f85149';
      // Find the value at the crossing index — either workspace's projection
      var projB = cross.projections.find(function(p) { return p.wsId === c.bId; });
      if (projB && projB.data[c.crossIndex] != null) {
        var markerData = new Array(labels.length).fill(null);
        markerData[c.crossIndex] = projB.data[c.crossIndex];
        datasets.push({
          type: 'scatter', label: c.bName + ' overtakes ' + c.aName,
          data: markerData,
          pointBackgroundColor: markerColor, pointBorderColor: '#ffffff',
          pointRadius: 8, pointHoverRadius: 10, pointBorderWidth: 2,
          showLine: false
        });
      }
    });
    scalesY = { ticks: { ...tick, callback: function(v) { return fmtUSD(v); } }, grid: { color: chartGridColor() }, title: { display: true, text: 'Daily Spend (projected)', color: chartTickColor(), font: { size: chartFontSize() } } };
  }

  charts.insight = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      ...chartCommonOptions(), aspectRatio: 2.0,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: chartLegendOptions(), tooltip: { ...chartTooltipOptions(), callbacks: { label: function(c) {
        if (c.dataset.type === 'scatter') return c.dataset.label;
        var val = c.parsed.y;
        if (_insightView === 'cpmDrift') return c.dataset.label + ': $' + Number(val).toFixed(2) + '/M';
        if (_insightView === 'crossingMarkers') return c.dataset.label + ': ' + fmtUSD(val);
        if (_insightView === 'cacheRatio') return c.dataset.label + ': ' + Number(val).toFixed(1) + '%';
        return c.dataset.label + ': ' + Number(val).toFixed(1) + '%';
      } } } },
      scales: { x: scalesX, y: scalesY }
    }
  });
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

/**
 * Render the rate-limit top-days list as HTML.
 * Extracted from renderRatePanel for testability (DSD-GAP-030).
 * d.date is CSV-derived and must be escaped to prevent XSS.
 */
function renderTopDaysHtml(topDays) {
  if (!topDays || !topDays.length) {
    return '<li style="color:var(--text-dim);font-size:0.78rem;padding:4px 0">No request data available</li>';
  }
  return topDays.map((d, i) =>
    `<li><span class="r-rank">#${i+1}</span><span class="r-date">${escapeHtml(d.date)}</span><span class="r-req">${fmtNum(d.requests||0)}</span></li>`
  ).join('');
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
  topList.innerHTML = renderTopDaysHtml(metrics.topDays);

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

// DSD-GAP-033: Client-side search filter over loaded rows.
// Filters the in-memory rows array by a case-insensitive substring match
// against utc_date (r[0]), model (r[1]), api_key_name (r[2]), and type
// (r[3], including its human-readable label from formatType).
// Empty/whitespace term returns all rows unchanged.
function filterRowsBySearch(rows, term) {
  const q = (term || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(r => {
    const date = String(r[0] || '').toLowerCase();
    const model = String(r[1] || '').toLowerCase();
    const key = String(r[2] || '').toLowerCase();
    const type = String(r[3] || '').toLowerCase();
    const typeLabel = formatType(r[3]).toLowerCase();
    return date.includes(q) || model.includes(q) || key.includes(q) || type.includes(q) || typeLabel.includes(q);
  });
}

function renderTable(days, modelFilter, keyFilter) {
  if (!activeWsId) return;

  const period = document.getElementById('periodSelect').value || 'all';
  const [start, end] = queryPeriod(period);

  let where = 'workspace_id = ? AND utc_date >= ? AND utc_date <= ?';
  const params = [activeWsId, start, end];
  if (modelFilter && modelFilter !== 'all') { where += ' AND model = ?'; params.push(modelFilter); }
  if (keyFilter && keyFilter !== 'all') { where += ' AND api_key_name = ?'; params.push(keyFilter); }

  // Count total matching rows first (fast COUNT query)
  const countR = db.exec(`SELECT COUNT(*) FROM token_usage WHERE ${where}`, params);
  const totalCount = countR.length ? countR[0].values[0][0] : 0;

  // Fetch with row cap for memory safety — virtual scroll renders windows from this array
  const r = db.exec(`SELECT utc_date, model, api_key_name, type, amount, price, (price*amount) as cost FROM token_usage WHERE ${where} ORDER BY utc_date DESC, model, type LIMIT ?`, [...params, TABLE_ROW_LIMIT]);
  let rows = r.length ? r[0].values : [];
  const capped = totalCount > TABLE_ROW_LIMIT;

  // DSD-GAP-033: Apply client-side search filter over the fetched rows
  const searchTerm = document.getElementById('rawSearch')?.value || '';
  const isSearching = searchTerm.trim().length > 0;
  rows = filterRowsBySearch(rows, searchTerm);
  const filteredCount = rows.length;

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

  rowCountEl.textContent = (() => {
    if (isSearching) {
      // DSD-GAP-033: show filtered count vs total fetched
      const capNote = capped ? ' of ' + TABLE_ROW_LIMIT.toLocaleString() : '';
      return `(${filteredCount} of ${totalCount.toLocaleString()} rows${capNote})`;
    }
    return `(${rows.length} rows${capped ? ', capped at ' + TABLE_ROW_LIMIT.toLocaleString() + ' of ' + totalCount.toLocaleString() : ''})`;
  })();

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

// DSD-GAP-046: overlay mode — 2+ workspaces selected. The first id becomes the
// active workspace (drives KPIs/filters/period options); the token + spend
// charts render one series per selected workspace on shared axes.
async function switchWorkspaces(ids) {
  if (!ids || !ids.length) return switchWorkspace(null);
  activeWsId = ids[0];
  document.getElementById('noWs').style.display = 'none';
  document.getElementById('activeContent').style.display = 'block';
  Object.values(charts).forEach(c => c.destroy()); charts = {};
  _destroyVScroll();
  await refreshAll();
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
  // DSD-GAP-046: preserve an active multi-selection across a list rebuild
  // (rename/delete re-renders the options) so overlay mode survives.
  const prevSelected = [...sel.selectedOptions].map(o => o.value).filter(v => v && workspaces.some(w => w.id === v));
  sel.innerHTML = workspaces.map(w => '<option value="' + escapeHtml(w.id) + '">' + escapeHtml(w.name) + '</option>').join('');
  if (!workspaces.length) {
    sel.innerHTML = '<option value="">No Workspace</option>';
    switchWorkspace(null);
  } else if (!activeWsId || !workspaces.find(w => w.id === activeWsId)) {
    switchWorkspace(workspaces[0].id);
  }
  sel.value = activeWsId || '';
  if (prevSelected.length >= 2) {
    Array.from(sel.options).forEach(o => { if (prevSelected.includes(o.value)) o.selected = true; });
  }
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
// DSD-GAP-046: multi-select workspace switcher — 2+ selected ids switch to
// overlay mode; a single selection keeps the classic single-workspace path.
document.getElementById('wsSelect').addEventListener('change', function() {
  const ids = getSelectedWorkspaceIds();
  if (ids.length >= 2) switchWorkspaces(ids);
  else switchWorkspace(ids[0] || null);
});
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
  const cb = modalCallback;
  hideModal();
  if (cb) cb(val);
});
document.getElementById('modalInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('modalConfirm').click(); });

const _debouncedRefresh = debounce(refreshAll, DEBOUNCE_MS);
['periodSelect','modelSelect','keySelect','granularitySelect'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', _debouncedRefresh);
});

// DSD-GAP-033: Debounced table-only re-render on search input.
// Reads current filter values and re-renders just the table (no db refetch
// beyond the table's own SELECT — the search filters the fetched rows pool).
const _debouncedTableSearch = debounce(() => {
  if (!activeWsId) return;
  const modelFilter = document.getElementById('modelSelect')?.value || 'all';
  const keyFilter = document.getElementById('keySelect')?.value || 'all';
  const days = _currentDays;
  renderTable(days, modelFilter, keyFilter);
}, DEBOUNCE_MS);
document.getElementById('rawSearch')?.addEventListener('input', _debouncedTableSearch);
// Persist granularity preference
document.getElementById('granularitySelect')?.addEventListener('change', function() {
  try { localStorage.setItem(GRANULARITY_LS_KEY, this.value); } catch(e) {}
});

// DSD-GAP-043: Persist trend preference and re-render charts on change
document.getElementById('trendSelect')?.addEventListener('change', function() {
  try { localStorage.setItem(TREND_LS_KEY, this.value); } catch(e) {}
  // Re-render charts without full refresh (keeps period/model/key/granularity)
  const chartDays = _groupedDays.length ? _groupedDays : _currentDays;
  if (chartDays.length) {
    renderTokenChart(chartDays);
    renderSpendChart(chartDays);
  }
});

// DSD-GAP-046: Persist normalize preference and re-render charts on change
document.getElementById('overlayToggle')?.addEventListener('change', function() {
  try { localStorage.setItem(OVERLAY_LS_KEY, this.checked ? '1' : '0'); } catch(e) {}
  const chartDays = _groupedDays.length ? _groupedDays : _currentDays;
  if (chartDays.length) {
    renderTokenChart(chartDays);
    renderSpendChart(chartDays);
  }
});

// DSD-GAP-044: Persist projection preference and re-render charts on change
document.getElementById('projectionSelect')?.addEventListener('change', function() {
  try { localStorage.setItem(PROJECTION_LS_KEY, this.value); } catch(e) {}
  const chartDays = _groupedDays.length ? _groupedDays : _currentDays;
  if (chartDays.length) {
    renderTokenChart(chartDays);
    renderSpendChart(chartDays);
  }
  renderProjectionSummary(_currentDays, this.value);
});

// DSD-GAP-044: Persist horizon preference and re-render charts on change
document.getElementById('horizonSelect')?.addEventListener('change', function() {
  try { localStorage.setItem(HORIZON_LS_KEY, this.value); } catch(e) {}
  const chartDays = _groupedDays.length ? _groupedDays : _currentDays;
  if (chartDays.length) {
    renderTokenChart(chartDays);
    renderSpendChart(chartDays);
  }
});

// DSD-GAP-045: Quarter selector — re-render drilldown on change
document.getElementById('quarterSelect')?.addEventListener('change', function() {
  renderQuarterDrilldown(_currentDays, this.value);
});

// DSD-GAP-047: Insights Gallery view toggle
document.querySelectorAll('#insightsControls button[data-insight]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    _insightView = btn.dataset.insight;
    try { localStorage.setItem(INSIGHT_LS_KEY, _insightView); } catch(e) {}
    // Update active button styling
    document.querySelectorAll('#insightsControls button[data-insight]').forEach(function(b) {
      b.classList.toggle('accent', b === btn);
    });
    renderInsightGallery();
  });
});
// Restore saved insight view
try {
  var savedInsight = localStorage.getItem(INSIGHT_LS_KEY);
  if (savedInsight) {
    _insightView = savedInsight;
    document.querySelectorAll('#insightsControls button[data-insight]').forEach(function(b) {
      b.classList.toggle('accent', b.dataset.insight === savedInsight);
    });
  }
} catch(e) {}

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

// DSD-GAP-014: pure row mapper for the raw export. SELECT order is
// utc_date, model, api_key_name, type, amount, price — so r[4]=amount,
// r[5]=price. Extracted for unit testing (tests/export.test.js).
function exportRowToCsv(r) {
  const amount = Number(r[4] || 0);
  const price = Number(r[5] || 0);
  return [r[0], r[1], r[2], r[3], r[4], r[5], amount * price].join(',');
}

document.getElementById('exportAllBtn').addEventListener('click', () => {
  if (!activeWsId) return;
  const r = db.exec(`SELECT utc_date, model, api_key_name, type, amount, price FROM token_usage WHERE workspace_id=? ORDER BY utc_date`, [activeWsId]);
  const rows = r.length ? r[0].values : [];
  const csv = 'utc_date,model,api_key_name,type,amount,price,cost\n' + rows.map(exportRowToCsv).join('\n');
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
  // DSD-GAP-043: Restore trend preference
  try {
    const savedTrend = localStorage.getItem(TREND_LS_KEY);
    if (savedTrend) {
      const trendSel = document.getElementById('trendSelect');
      if (trendSel) trendSel.value = savedTrend;
    }
  } catch(e) {}
  // DSD-GAP-046: Restore normalize (index=100) preference
  try {
    const savedOverlay = localStorage.getItem(OVERLAY_LS_KEY);
    const overlayCb = document.getElementById('overlayToggle');
    if (overlayCb && savedOverlay === '1') overlayCb.checked = true;
  } catch(e) {}
  // DSD-GAP-044: Restore projection and horizon preferences
  try {
    const savedProj = localStorage.getItem(PROJECTION_LS_KEY);
    if (savedProj) {
      const projSel = document.getElementById('projectionSelect');
      if (projSel) projSel.value = savedProj;
    }
    const savedHorizon = localStorage.getItem(HORIZON_LS_KEY);
    if (savedHorizon) {
      const horizonSel = document.getElementById('horizonSelect');
      if (horizonSel) horizonSel.value = savedHorizon;
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

    // Migration: normalize YYYYMMDD dates → YYYY-MM-DD (DeepSeek changed formats mid-2026)
    if (loaded) {
      let migrated = 0;
      const fixDates = (table) => {
        const rows = db.exec(`SELECT rowid, utc_date FROM ${table} WHERE utc_date GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`);
        if (rows.length && rows[0].values.length) {
          for (const r of rows[0].values) {
            const d = r[1];
            const normalized = d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8);
            db.run(`UPDATE ${table} SET utc_date = ? WHERE rowid = ?`, [normalized, r[0]]);
            migrated++;
          }
        }
      };
      fixDates('token_usage');
      fixDates('cost_daily');
      if (migrated > 0) await saveDB();
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
