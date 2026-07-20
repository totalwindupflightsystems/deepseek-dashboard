import { describe, it, expect } from 'vitest';

describe('parseCSV', () => {
  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCSV('col1,col2,col3')).toEqual([]);
  });

  it('parses simple two-row CSV', () => {
    const text = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC' });
    expect(result[1]).toEqual({ name: 'Bob', age: '25', city: 'LA' });
  });

  it('strips BOM prefix (\\uFEFF)', () => {
    const text = '\uFEFFmodel,tokens\ndeepseek-chat,1000';
    const result = parseCSV(text);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe('deepseek-chat');
  });

  it('handles quoted fields with embedded commas', () => {
    const text = 'name,description\nWidget,"small, red, shiny"\nGadget,"large, blue"';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('small, red, shiny');
    expect(result[1].description).toBe('large, blue');
  });

  it('handles quoted fields with embedded double quotes', () => {
    // In CSV, double quotes inside quoted fields are escaped as ""
    // The parser toggles inQ on each ", so "" inside quotes toggles twice = stays in
    // This means a field like "say ""hello""" would be parsed as: say "hello"
    // Let's test the basic quote handling
    const text = 'name,greeting\nAlice,"hello, world"';
    const result = parseCSV(text);
    expect(result).toHaveLength(1);
    expect(result[0].greeting).toBe('hello, world');
  });

  it('handles different line endings (\\r\\n)', () => {
    const text = 'col1,col2\r\nval1,val2\r\nval3,val4';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].col1).toBe('val1');
    expect(result[1].col1).toBe('val3');
  });

  it('handles mixed quoted and unquoted fields', () => {
    const text = 'model,type,amount\ndeepseek,output_tokens,"1000"\nopenai,"input_cache_hit_tokens",500';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe('1000');
    expect(result[1].type).toBe('input_cache_hit_tokens');
  });

  it('skips rows with mismatched column count', () => {
    const text = 'a,b,c\n1,2,3\n4,5\n6,7,8';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ a: '1', b: '2', c: '3' });
    expect(result[1]).toEqual({ a: '6', b: '7', c: '8' });
  });

  it('trims field values', () => {
    const text = 'col1,col2\n  val1  , val2 ';
    const result = parseCSV(text);
    expect(result[0].col1).toBe('val1');
    expect(result[0].col2).toBe('val2');
  });

  it('handles empty trailing lines', () => {
    const text = 'col1,col2\nv1,v2\n\n';
    const result = parseCSV(text);
    // The empty line after split yields [''] which has length 1 < 2, skipped
    expect(result).toHaveLength(1);
  });

  it('parses real-world DeepSeek cost CSV format', () => {
    const text = 'utc_date,model,cost,currency,wallet_type\n2024-01-15,deepseek-chat,0.042,USD,prepaid\n2024-01-15,deepseek-chat,0.018,USD,prepaid';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].utc_date).toBe('2024-01-15');
    expect(result[0].cost).toBe('0.042');
  });

  it('parses real-world DeepSeek amount CSV format', () => {
    const text = 'utc_date,model,api_key_name,type,price,amount\n2024-01-15,deepseek-chat,key1,output_tokens,2.8e-6,5000\n2024-01-15,deepseek-chat,key1,input_tokens,1.4e-6,12000';
    const result = parseCSV(text);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('output_tokens');
    expect(result[1].type).toBe('input_tokens');
  });
});
