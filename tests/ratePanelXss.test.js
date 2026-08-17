import { describe, it, expect } from 'vitest';

// DSD-GAP-030 — XSS in rate-limit top-days panel.
// d.date is CSV-derived (utc_date column from user-uploaded ZIPs) and was
// interpolated raw into innerHTML. This test ensures the extracted helper
// escapeHtml()'s the date so crafted payloads cannot execute JS in the page.

describe('renderTopDaysHtml — XSS escape (DSD-GAP-030)', () => {
  it('escapes a malicious date string containing an <img> onerror payload', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const html = renderTopDaysHtml([{ date: malicious, requests: 42 }]);

    // The raw <img> tag must NOT appear verbatim — angle brackets are escaped
    expect(html).not.toContain('<img');

    // The escaped text MUST be present so the user still sees the value
    expect(html).toContain('&lt;img');
    expect(html).toContain('42');

    // Verify in a real DOM: no img elements survive innerHTML assignment
    const el = document.createElement('ul');
    el.innerHTML = html;
    expect(el.querySelectorAll('img').length).toBe(0);
    expect(el.querySelector('.r-date').textContent).toBe(malicious);
  });

  it('escapes a script-tag payload in the date field', () => {
    const payload = '<script>alert(document.cookie)</script>';
    const html = renderTopDaysHtml([{ date: payload, requests: 1 }]);

    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders normal YYYY-MM-DD dates unchanged', () => {
    const html = renderTopDaysHtml([
      { date: '2026-08-15', requests: 5000 },
      { date: '2026-08-16', requests: 3000 },
    ]);

    expect(html).toContain('2026-08-15');
    expect(html).toContain('2026-08-16');
    expect(html).toContain('#1');
    expect(html).toContain('#2');
  });

  it('renders the empty-state placeholder when topDays is empty', () => {
    const html = renderTopDaysHtml([]);
    expect(html).toContain('No request data available');
  });

  it('renders the empty-state placeholder when topDays is null/undefined', () => {
    expect(renderTopDaysHtml(null)).toContain('No request data available');
    expect(renderTopDaysHtml(undefined)).toContain('No request data available');
  });
});