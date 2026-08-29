import { describe, expect, it } from 'vitest';

/** Mirrors mobile `intervalsOverlap` — keep in sync with appointmentAvailability.ts */
function intervalsOverlap(
  startsAt: string,
  endsAt: string,
  otherStartsAt: string,
  otherEndsAt: string,
): boolean {
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  const otherStartMs = new Date(otherStartsAt).getTime();
  const otherEndMs = new Date(otherEndsAt).getTime();
  return startMs < otherEndMs && endMs > otherStartMs;
}

describe('appointment assignee availability overlap', () => {
  it('detects overlapping scheduled slots', () => {
    expect(
      intervalsOverlap(
        '2026-08-28T10:00:00.000Z',
        '2026-08-28T10:30:00.000Z',
        '2026-08-28T10:15:00.000Z',
        '2026-08-28T10:45:00.000Z',
      ),
    ).toBe(true);
  });

  it('treats adjacent slots as free (no overlap)', () => {
    expect(
      intervalsOverlap(
        '2026-08-28T10:00:00.000Z',
        '2026-08-28T10:30:00.000Z',
        '2026-08-28T10:30:00.000Z',
        '2026-08-28T11:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('detects contained and containing ranges', () => {
    expect(
      intervalsOverlap(
        '2026-08-28T10:00:00.000Z',
        '2026-08-28T11:00:00.000Z',
        '2026-08-28T10:15:00.000Z',
        '2026-08-28T10:45:00.000Z',
      ),
    ).toBe(true);
    expect(
      intervalsOverlap(
        '2026-08-28T10:15:00.000Z',
        '2026-08-28T10:45:00.000Z',
        '2026-08-28T10:00:00.000Z',
        '2026-08-28T11:00:00.000Z',
      ),
    ).toBe(true);
  });
});
