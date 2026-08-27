import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { webcrypto } from 'node:crypto';

// DSD-GAP-053: the sql.js wasm engine is fetched by app JS and sha384-verified
// against a hardcoded constant BEFORE the bytes are handed to initSqlJs.
// These tests exercise fetchVerifiedWasm with injected fetch/digest (no
// network, no CDN): hash-match success, hash mismatch, fetch failure (network
// error + HTTP error status), malformed digest length, plus a pin test against
// the real local wasm bytes (node_modules copy — installed by npm ci in CI).
//
// NOTE: rejections are caught manually and asserted via their message STRING
// instead of expect(...).rejects — the helper runs inside the jsdom window
// (vitest evals dashboard.js there), so its errors carry `http://localhost/`
// stack frames; letting such error objects reach vitest's assertion metadata
// makes the CLI stack-parser try to read them as filesystem paths (EISDIR
// unhandled-error noise). Asserting on the extracted message avoids that.

const REAL_WASM = resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
// Must match SQL_WASM_SHA384_B64 in js/dashboard.js (and CI ci.yml). A drift
// here fails the pin tests below — update all three together.
const APP_PIN = 'x0YkuPkDHnKTZcB1JO4eb6j5+eU36aka+jBA6tOKTFaTz98b9V7fPT0QgZ9qyQW2';
const REAL_WASM_SIZE = 658410; // sql.js@1.14.2 sql-wasm.wasm

// Digest through a NODE-realm Buffer copy: vitest's jsdom environment hands us
// jsdom-realm TypedArrays (TextEncoder output, views created inside the
// window-eval'd dashboard.js), and node's webcrypto brand-rejects foreign-realm
// views. Buffer.from() copies the bytes realm-agnostically; node webcrypto
// always accepts node Buffers. The browser default path (crypto.subtle on a
// same-realm view in dashboard.js) is unaffected.
const sha384 = (algo, bytes) => webcrypto.subtle.digest(algo, Buffer.from(bytes));
const b64 = (buf) => Buffer.from(buf).toString('base64');

function okFetch(bytes) {
  return async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes });
}

// Run the helper, resolve to the caught error (or null on success). See the
// file-level NOTE for why we don't use expect(...).rejects here.
async function rejectionOf(promise) {
  return promise.then(() => null, (e) => e);
}

describe('fetchVerifiedWasm (DSD-GAP-053)', () => {
  it('resolves with the fetched bytes when sha384 matches (real webcrypto digest)', async () => {
    const payload = new TextEncoder().encode('hello wasm engine');
    const expected = b64(await sha384('SHA-384', payload));
    const out = await fetchVerifiedWasm('https://cdn.example/sql.wasm', expected, {
      fetch: okFetch(payload.buffer),
      digest: sha384,
    });
    expect(Buffer.from(out).equals(payload)).toBe(true);
  });

  it('rejects on sha384 mismatch (swapped wasm can never run)', async () => {
    const payload = new TextEncoder().encode('tampered engine bytes');
    const wrongExpected = b64(await sha384('SHA-384', new TextEncoder().encode('something else entirely')));
    const err = await rejectionOf(fetchVerifiedWasm('https://cdn.example/sql.wasm', wrongExpected, {
      fetch: okFetch(payload.buffer),
      digest: sha384,
    }));
    expect(err).toBeTruthy();
    expect(String(err && err.message)).toMatch(/sha384 mismatch/);
  });

  it('rejects on network fetch failure', async () => {
    const err = await rejectionOf(fetchVerifiedWasm('https://cdn.example/sql.wasm', APP_PIN, {
      fetch: async () => { throw new TypeError('Failed to fetch'); },
      digest: sha384,
    }));
    expect(err).toBeTruthy();
    expect(String(err && err.message)).toMatch(/Failed to fetch/);
  });

  it('rejects on HTTP error status (non-ok response)', async () => {
    const fetch404 = async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
    const err = await rejectionOf(fetchVerifiedWasm('https://cdn.example/sql.wasm', APP_PIN, {
      fetch: fetch404,
      digest: sha384,
    }));
    expect(err).toBeTruthy();
    expect(String(err && err.message)).toMatch(/HTTP 404/);
  });

  it('rejects when the digest has the wrong length (not sha384)', async () => {
    const payload = new TextEncoder().encode('payload digested as sha256');
    const shortDigest = async (algo, bytes) => webcrypto.subtle.digest('SHA-256', Buffer.from(bytes)); // 32 bytes, not 48
    const err = await rejectionOf(fetchVerifiedWasm('https://cdn.example/sql.wasm', APP_PIN, {
      fetch: okFetch(payload.buffer),
      digest: shortDigest,
    }));
    expect(err).toBeTruthy();
    expect(String(err && err.message)).toMatch(/digest length/);
  });

  it.runIf(existsSync(REAL_WASM))('pin: real local sql.js@1.14.2 wasm matches the app constant', async () => {
    const wasm = readFileSync(REAL_WASM);
    expect(wasm.length).toBe(REAL_WASM_SIZE);
    // b64 of the real bytes must equal the pinned constant — proves the pin
    // matches the exact dependency version the app ships against.
    expect(b64(await sha384('SHA-384', wasm))).toBe(APP_PIN);
    const out = await fetchVerifiedWasm('https://cdn.example/sql.wasm', APP_PIN, {
      fetch: okFetch(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)),
      digest: sha384,
    });
    expect(out.byteLength).toBe(REAL_WASM_SIZE);
  });

  it.runIf(existsSync(REAL_WASM))('pin: a single tampered byte in the real wasm is rejected', async () => {
    const wasm = readFileSync(REAL_WASM);
    const tampered = new Uint8Array(wasm);
    tampered[tampered.length - 1] ^= 0xff; // flip last byte
    const err = await rejectionOf(fetchVerifiedWasm('https://cdn.example/sql.wasm', APP_PIN, {
      fetch: okFetch(tampered.buffer),
      digest: sha384,
    }));
    expect(err).toBeTruthy();
    expect(String(err && err.message)).toMatch(/sha384 mismatch/);
  });
});
