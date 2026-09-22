import { describe, expect, it } from 'vitest';

import { responsiveFieldMinWidth, responsiveInputFontSize } from './responsiveFieldWidth';

const row = { chrome: 48, fontScale: 1, maxWidth: 310 };

describe('responsiveFieldMinWidth', () => {
  it('keeps a short value narrower than a shared row', () => {
    const shortWidth = responsiveFieldMinWidth({ ...row, text: '0.00' });
    const longWidth = responsiveFieldMinWidth({ ...row, text: '400000.00' });

    expect(shortWidth).toBeLessThan(120);
    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeLessThan(row.maxWidth);
  });

  it('grows with the user text size', () => {
    const normal = responsiveFieldMinWidth({ ...row, text: '22/09/2026' });
    const large = responsiveFieldMinWidth({ ...row, fontScale: 1.6, text: '22/09/2026' });

    expect(large).toBeGreaterThan(normal);
  });

  it('never asks for more than the row', () => {
    expect(
      responsiveFieldMinWidth({ ...row, maxWidth: 180, text: '123456789012345' }),
    ).toBe(180);
  });
});

describe('responsiveInputFontSize', () => {
  it('keeps the normal size when the value fits on one row', () => {
    expect(responsiveInputFontSize({ ...row, text: '400.00' })).toBe(15);
  });

  it('shrinks only when the value is wider than the full row', () => {
    const size = responsiveInputFontSize({
      ...row,
      maxWidth: 160,
      text: '1234567890.00',
    });

    expect(size).toBeLessThan(15);
    expect(size).toBeGreaterThanOrEqual(11);
  });
});
