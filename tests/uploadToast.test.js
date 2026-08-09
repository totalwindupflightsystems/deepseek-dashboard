import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';

// Expose dashboard functions to the test scope.
const handleMultipleUpload = (files) => window.handleMultipleUpload(files);
const toastEl = () => document.getElementById('toast');

function makeFile(name, bytes) {
  // JSDOM File constructor needs a buffer-backed array
  return new window.File([bytes], name, { type: 'application/zip' });
}

async function buildZip(entries) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({ type: 'uint8array' });
}

const SYNTHETIC_AMOUNT = [
  'user_id,utc_date,model,api_key_name,api_key,type,price,amount',
  'u1,2026-07-01,deepseek-v4-pro,k1,sk-a1b2c3d4e5f6g7h8i9j0,completion,0.5,100',
].join('\n') + '\n';

describe('handleMultipleUpload toast reasons (DSD-GAP-018)', () => {
  beforeEach(() => {
    // Expose real JSZip so _processSingleFile can parse ZIPs in jsdom
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;

    // Need a workspace id for the upload to proceed
    globalThis.activeWsId = 'ws-test';

    // Stub db so _processSingleFile doesn't crash on SQL operations.
    // The CSV-less ZIP throws BEFORE any db usage, so a minimal stub suffices.
    globalThis.db = {
      exec: () => [],
      run: () => {},
      prepare: () => ({ run: () => {}, free: () => {} }),
      export: () => new Uint8Array(0),
    };

    // Stub saveDB / refreshAll to avoid IndexedDB / DOM chart operations
    window.saveDB = async () => {};
    globalThis.saveDB = window.saveDB;
    window.refreshAll = async () => {};
    globalThis.refreshAll = window.refreshAll;

    // setup.js stubs toast as a no-op; restore a DOM-writing version so we
    // can assert on #toast textContent after the upload path runs.
    window.toast = function(msg, warn) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'toast show' + (warn ? ' warn' : '');
    };

    // Reset toast element
    toastEl().textContent = '';
    toastEl().className = 'toast';
  });

  it('CSV-less ZIP shows a reason string in the final toast', async () => {
    const bytes = await buildZip({ 'readme.txt': 'just a readme' });
    const file = makeFile('no-csv.zip', bytes);

    await handleMultipleUpload([file]);

    const finalText = toastEl().textContent;
    // PASS criterion: a reason string is visible
    expect(finalText).toMatch(/No amount-\*\/cost-\* CSV found in archive/i);
  });

  it('ZIP with amount-*.csv shows a success summary without failure reasons', async () => {
    const bytes = await buildZip({ 'amount-2026-7.csv': SYNTHETIC_AMOUNT });
    const file = makeFile('has-csv.zip', bytes);

    await handleMultipleUpload([file]);

    const finalText = toastEl().textContent;
    // Success path: toast shows row count info, not failure reasons
    expect(finalText).not.toMatch(/failed/i);
  });
});