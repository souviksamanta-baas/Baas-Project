import { describe, expect, it } from 'vitest';

import { formatTimezoneOptionLabel, formatUtcOffset } from '../src/lib/timezones';

describe('formatUtcOffset', () => {
  const winter = new Date('2026-01-15T15:00:00Z');
  const summer = new Date('2026-07-15T15:00:00Z');

  it('returns UTC-3:00 for Argentina/Cordoba', () => {
    expect(formatUtcOffset('America/Argentina/Cordoba', winter)).toBe('UTC-3:00');
  });

  it('returns UTC+0:00 for UTC', () => {
    expect(formatUtcOffset('UTC', winter)).toBe('UTC+0:00');
  });

  it('returns a negative winter offset for New York', () => {
    expect(formatUtcOffset('America/New_York', winter)).toBe('UTC-5:00');
  });

  it('returns a daylight-saving summer offset for New York', () => {
    expect(formatUtcOffset('America/New_York', summer)).toBe('UTC-4:00');
  });
});

describe('formatTimezoneOptionLabel', () => {
  it('includes Cordoba with UTC-3:00', () => {
    const label = formatTimezoneOptionLabel(
      'America/Argentina/Cordoba',
      new Date('2026-01-15T15:00:00Z'),
    );
    expect(label).toBe('Argentina/Cordoba (UTC-3:00)');
  });
});
