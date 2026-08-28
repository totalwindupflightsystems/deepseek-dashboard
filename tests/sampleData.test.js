import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// DSD-GAP-054: in-app 'Load sample data' — builds a fixture ZIP entirely
// in-browser from the committed tests/fixtures CSVs (same-origin fetch) and
// routes it through the existing handleUpload/_processSingleFile pipeline, so
// a fresh visitor sees charts with one click (no account, no clone, no manual
// ZIP download).
//
// CRITICAL: tests/setup.js stubs window.fetch with a NEVER-RESOLVING promise
// (so init() stays suspended and never touches the network). Every test below
// replaces window.fetch with a resolving stub BEFORE triggering any code path
// that fetches — a test that completes is the no-hang proof (a forgotten stub
// would deadlock and hit the vitest timeout).

const FIXTURES_DIR = resolve(process.cwd(), 'tests', 'fixtures');
const FIXTURE_FILES = [
  'amount-2026-06.csv',
  'amount-2026-07-25_2026-08-23.csv',
  'cost-2026-06.csv',
  'cost-2026-07-25_2026-08-23.csv',
];
// Raw data rows per committed fixture (hardcoded, deterministic — same
// convention as zipPipelineNewFormat.test.js):
//   amount-2026-06 = 22, amount-2026-07-25_2026-08-23 = 22,
//   cost-2026-06 = 22, cost-2026-07-25_2026-08-23 = 15.
const FIXTURE_ROW_COUNTS = [22, 22, 22, 15];
const RAW_TOTAL = FIXTURE_ROW_COUNTS.reduce((a, b) => a + b, 0); // 81
// Each of the 4 fixtures carries exactly one 'not-a-date' row, so the
// defense-in-depth date check drops 4 rows after normalization/derivation.
const DROPPED_TOTAL = 4;
const KEPT_TOTAL = RAW_TOTAL - DROPPED_TOTAL; // 77

function fixtureText(basename) {
  return readFileSync(resolve(FIXTURES_DIR, basename), 'utf-8');
}

// Resolving fetch stub replacing the setup.js never-resolving stub. Serves
// the 4 relative fixture URLs (as dashboard.js calls them) with the committed
// CSV texts read from disk.
function makeFetchStub() {
  return async (input) => {
    const basename = String(input).split('/').pop();
    if (!FIXTURE_FILES.includes(basename)) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => fixtureText(basename) };
  };
}

describe('buildSampleZip — in-browser fixture ZIP builder (DSD-GAP-054)', () => {
  beforeEach(() => {
    window.fetch = makeFetchStub();
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;
  });

  it('builds sample-usage.zip with exactly 4 non-dir entries named by fixture basename', async () => {
    const file = await window.buildSampleZip();
    expect(file.name).toBe('sample-usage.zip');
    expect(file.type).toBe('application/zip');

    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    expect(entries).toHaveLength(4);
    expect(entries.map(entry => entry.name).sort()).toEqual([...FIXTURE_FILES].sort());
  });

  it('each entry parses to the committed fixture row counts', async () => {
    const file = await window.buildSampleZip();
    const zip = await JSZip.loadAsync(file);
    for (const basename of FIXTURE_FILES) {
      const text = await zip.file(basename).async('text');
      expect(parseCSV(text)).toHaveLength(FIXTURE_ROW_COUNTS[FIXTURE_FILES.indexOf(basename)]);
    }
  });

  it('rejects with a clear error when a fixture fetch fails', async () => {
    window.fetch = async () => ({ ok: false, status: 404, text: async () => '' });
    await expect(window.buildSampleZip()).rejects.toThrow(/Failed to load/);
  });
});

describe('fresh-visitor click path — Load sample data (DSD-GAP-054)', () => {
  const capturedToasts = [];
  let createdName;
  let prepareRuns;

  beforeEach(() => {
    capturedToasts.length = 0;
    createdName = null;
    prepareRuns = 0;

    globalThis.activeWsId = undefined; // fresh visitor: no workspace yet
    window.fetch = makeFetchStub();
    window.JSZip = JSZip;
    globalThis.JSZip = JSZip;

    globalThis.db = {
      exec: () => [],
      run: () => {},
      prepare: () => ({ run: () => { prepareRuns++; }, free: () => {} }),
      export: () => new Uint8Array(0),
    };

    window.saveDB = async () => {};
    globalThis.saveDB = window.saveDB;
    window.refreshAll = async () => {};
    globalThis.refreshAll = window.refreshAll;
    window.refreshWsList = () => {};
    window.switchWorkspace = async (id) => { globalThis.activeWsId = id; };
    window.createWorkspace = (name) => { createdName = name; return 'ws-sample'; };

    window.toast = function (msg, warn) { capturedToasts.push(String(msg)); };
  });

  it('clicking #sampleDataBtn auto-creates a Sample workspace, routes all fixture rows through the pipeline, toasts success, re-enables the button, no hang', async () => {
    const btn = document.getElementById('sampleDataBtn');
    expect(btn).not.toBeNull();
    btn.click();

    // The handler is async; wait for the success toast. Simply completing
    // proves the never-resolving setup.js fetch stub was replaced — otherwise
    // this test would deadlock on the first fetch (vitest timeout = hang proof).
    await vi.waitFor(() => {
      expect(capturedToasts.join(' ')).toMatch(/Added \d+ rows/);
    });

    const allToasts = capturedToasts.join(' ');
    expect(createdName).toBe('Sample');
    // All 81 raw rows route through the pipeline; 4 malformed-date rows are
    // dropped by the existing defense-in-depth check → 77 survive into sql.js.
    expect(prepareRuns).toBe(KEPT_TOTAL);
    expect(allToasts).toMatch(/4 dropped — invalid utc_date/);
    expect(btn.disabled).toBe(false);
    expect(allToasts).not.toMatch(/^Error:/);
  });
});
