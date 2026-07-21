import { describe, it, expect } from 'vitest';

// parseCSV is global in index.html, vitest loads it via setup
describe('parseCSV edge cases (fixed)', () => {
  it('handles escaped double quotes inside quoted field', () => {
    // CSV: name,greeting
    //       Alice,"say ""hello"" world"
    // Expected: greeting = 'say "hello" world'
    const text = 'name,greeting\nAlice,"say ""hello"" world"';
    const result = parseCSV(text);
    expect(result).toHaveLength(1);
    expect(result[0].greeting).toBe('say "hello" world');
  });

  it('handles multiple escaped quotes in one field', () => {
    const text = 'col\n"a""b""c"';
    const result = parseCSV(text);
    expect(result).toHaveLength(1);
    expect(result[0].col).toBe('a"b"c');
  });

  it('handles embedded newlines inside quoted field', () => {
    // CSV with a quoted field containing line breaks
    const text = 'name,description\nAlice,"line 1\nline 2\nline 3"\nBob,simple';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('line 1\nline 2\nline 3');
    expect(result[1].name).toBe('Bob');
  });

  it('handles quoted field with newlines at end of file', () => {
    const text = 'col1,col2\nval,"multi\nline\nfield"';
    const result = parseCSV(text);
    expect(result).toHaveLength(1);
    expect(result[0].col2).toBe('multi\nline\nfield');
  });

  it('handles quoted first field with embedded comma and newline', () => {
    const text = 'name,note\n"Smith, John","works\non\nstuff"\nDoe,Jane';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Smith, John');
    expect(result[0].note).toBe('works\non\nstuff');
    expect(result[1].name).toBe('Doe');
  });
});
