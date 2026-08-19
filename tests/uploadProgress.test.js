import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';

// DSD-GAP-034: transaction-wrapped inserts + progress callback tests.
//
// Verifies:
// (a) _processSingleFile wraps the insert phase in BEGIN/COMMIT.
// (b) saveDB is called exactly once (not mid-loop).
// (c) The progress callback is invoked with phase/rowsDone/rowsTotal info.

const handleMultipleUpload = (files) => window.handleMultipleUpload(files);

function makeFile(name, bytes) {
  return new window.File([bytes], name, { type: 'application/zip' });
}

async function buildZip(entries) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({ type: 'uint8array' });
}

function buildSyntheticAmount(rows) {
  const header = 'user_id,utc_date,model,api_key_name,api_key,type,price,amount';
  const lines = [];
  for (let i = 1; i <= rows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const model = i % 2 ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
    lines.push(`u${i},2026-07-${day},${model},k${(i % 3) + 1},sk-fakekey,completion,0.${i % 9},${i * 100}`);
  }
  return header + '\n' + lines.join('\n') + '\n';
}

function buildSyntheticCost(rows) {
  const header = 'user_id,utc_date,model,wallet_type,cost,currency';
  const lines = [];
  for (let i = 1; i <= rows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const model = i % 2 ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
    lines.push(`u${i},2026-07-${day},${model},Paid,0.${i % 9}000000000000000,USD`);
  }
  return header + '\n' + lines.join('\n') + '\n';
}

// Track all SQL commands issued to the mock db
function makeMockDb() {
  const commands = [];
  const mockDb = {
    run: vi.fn((sql, params) => {
      commands.push({ type: 'run', sql: sql.trim().toUpperCase() });
    }),
    exec: vi.fn((sql, params) => {
      commands.push({ type: 'exec', sql: sql.trim().toUpperCase() });
      // Return empty result for COUNT queries and overlapping check
      return [{ values: [[0]], columns: ['cnt'] }];
    }),
    prepare: vi.fn(() => ({
      run: vi.fn(() => {}),
      free: vi.fn(() => {}),
    })),
    export: vi.fn(() => new Uint8Array(0)),
    _commands: commands,
  };
  return mockDb;
}

describe('DSD-GAP-034: transaction-wrapped inserts', () => {
  beforeEach(() => {
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;
    globalThis.activeWsId = 'ws-test';

    window.saveDB = vi.fn(async () => {});
    globalThis.saveDB = window.saveDB;
    window.refreshAll = vi.fn(async () => {});
    globalThis.refreshAll = window.refreshAll;

    window.toast = function(msg, warn) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'toast show' + (warn ? ' warn' : '');
    };
  });

  it('wraps inserts in a BEGIN/COMMIT transaction', async () => {
    const mockDb = makeMockDb();
    globalThis.db = mockDb;

    const bytes = await buildZip({
      'amount-2026-7.csv': buildSyntheticAmount(50),
      'cost-2026-7.csv': buildSyntheticCost(20),
    });
    const file = makeFile('test.zip', bytes);

    await window._processSingleFile(file);

    const sqls = mockDb._commands.map(c => c.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    // Ensure no ROLLBACK on the success path
    expect(sqls).not.toContain('ROLLBACK');
  });

  it('calls saveDB exactly once (not mid-loop)', async () => {
    const mockDb = makeMockDb();
    globalThis.db = mockDb;

    const bytes = await buildZip({
      'amount-2026-7.csv': buildSyntheticAmount(50),
      'cost-2026-7.csv': buildSyntheticCost(20),
    });
    const file = makeFile('test.zip', bytes);

    await window._processSingleFile(file);

    expect(window.saveDB).toHaveBeenCalledTimes(1);
  });

  it('issues ROLLBACK on insert error and re-throws', async () => {
    const commands = [];
    const mockDb = {
      run: vi.fn((sql) => {
        commands.push(sql.trim().toUpperCase());
        // Simulate failure on the first INSERT INTO uploads
        if (sql.trim().toUpperCase().startsWith('INSERT INTO UPLOADS')) {
          throw new Error('constraint violation');
        }
      }),
      exec: vi.fn(() => [{ values: [[0]], columns: ['cnt'] }]),
      prepare: vi.fn(() => ({
        run: vi.fn(() => {}),
        free: vi.fn(() => {}),
      })),
      export: vi.fn(() => new Uint8Array(0)),
      _commands: commands,
    };
    globalThis.db = mockDb;

    const bytes = await buildZip({
      'amount-2026-7.csv': buildSyntheticAmount(10),
    });
    const file = makeFile('fail.zip', bytes);

    await expect(window._processSingleFile(file)).rejects.toThrow('constraint violation');

    const sqls = commands;
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('ROLLBACK');
    // COMMIT should NOT be called when an error occurs
    expect(sqls).not.toContain('COMMIT');
  });
});

describe('DSD-GAP-034: progress callback', () => {
  beforeEach(() => {
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;
    globalThis.activeWsId = 'ws-test';

    window.saveDB = vi.fn(async () => {});
    globalThis.saveDB = window.saveDB;
    window.refreshAll = vi.fn(async () => {});
    globalThis.refreshAll = window.refreshAll;

    window.toast = function() {};
  });

  it('invokes the progress callback with phase and row counts', async () => {
    globalThis.db = makeMockDb();

    const amountRows = 60;
    const costRows = 30;
    const bytes = await buildZip({
      'amount-2026-7.csv': buildSyntheticAmount(amountRows),
      'cost-2026-7.csv': buildSyntheticCost(costRows),
    });
    const file = makeFile('progress.zip', bytes);

    const updates = [];
    await window._processSingleFile(file, (upd) => updates.push({ ...upd }));

    // Should have at least a parsing phase and a saving phase
    const phases = updates.map(u => u.phase);
    expect(phases).toContain('parsing');
    expect(phases).toContain('inserting');
    expect(phases).toContain('saving');

    // The inserting phase should report row counts
    const insertingUpdates = updates.filter(u => u.phase === 'inserting');
    expect(insertingUpdates.length).toBeGreaterThan(0);

    // Final inserting update should approach total rows (amountRows + costRows)
    const lastInsert = insertingUpdates[insertingUpdates.length - 1];
    expect(lastInsert.rowsTotal).toBe(amountRows + costRows);

    // Saving phase should show 100% completion
    const savingUpdate = updates.find(u => u.phase === 'saving');
    expect(savingUpdate).toBeDefined();
    expect(savingUpdate.rowsDone).toBe(amountRows + costRows);
  });

  it('updates the drop zone title and progress bar via handleUpload', async () => {
    globalThis.db = makeMockDb();

    const bytes = await buildZip({
      'amount-2026-7.csv': buildSyntheticAmount(10),
    });
    const file = makeFile('ui-test.zip', bytes);

    const dz = document.getElementById('dropZone');
    const barEl = dz.querySelector('.drop-progress-bar');
    const titleEl = dz.querySelector('.drop-title');

    await window.handleUpload(file);

    // After completion, title should be restored
    expect(titleEl.textContent).toBe('Drop DeepSeek usage ZIP here');
    // Progress bar should be reset
    expect(barEl.style.width).toBe('0%');
  });
});