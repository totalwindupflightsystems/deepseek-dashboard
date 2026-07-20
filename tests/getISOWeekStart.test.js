import { describe, it, expect } from 'vitest';

describe('getISOWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    expect(getISOWeekStart('2024-01-17')).toBe('2024-01-15'); // Wed -> Mon Jan 15
  });

  it('returns Monday for a Sunday', () => {
    expect(getISOWeekStart('2024-01-21')).toBe('2024-01-15'); // Sun -> Mon Jan 15
  });

  it('returns same date for a Monday', () => {
    expect(getISOWeekStart('2024-01-15')).toBe('2024-01-15'); // Mon stays Mon
  });

  it('returns previous Monday for a Tuesday', () => {
    expect(getISOWeekStart('2024-01-16')).toBe('2024-01-15');
  });

  it('handles year boundary — December 31, 2024 (Tuesday)', () => {
    expect(getISOWeekStart('2024-12-31')).toBe('2024-12-30');
  });

  it('handles year boundary — January 1, 2025 (Wednesday)', () => {
    expect(getISOWeekStart('2025-01-01')).toBe('2024-12-30');
  });

  it('handles weekend to Monday transition', () => {
    expect(getISOWeekStart('2024-06-22')).toBe('2024-06-17'); // Sat -> Mon Jun 17
    expect(getISOWeekStart('2024-06-23')).toBe('2024-06-17'); // Sun -> Mon Jun 17
    expect(getISOWeekStart('2024-06-24')).toBe('2024-06-24'); // Mon stays Mon
  });

  it('handles dates in February correctly', () => {
    expect(getISOWeekStart('2024-03-01')).toBe('2024-02-26'); // Friday Mar 1 -> Mon Feb 26 (leap year)
  });
});
