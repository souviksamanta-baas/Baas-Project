const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

interface ZonedParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
    minute: 'numeric',
    month: 'numeric',
    second: 'numeric',
    timeZone,
    year: 'numeric',
  });

  const parts = formatter.formatToParts(instant);
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    day: read('day'),
    hour: read('hour') === 24 ? 0 : read('hour'),
    minute: read('minute'),
    month: read('month'),
    second: read('second'),
    year: read('year'),
  };
}

function formatYmd(parts: Pick<ZonedParts, 'day' | 'month' | 'year'>): string {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

function zonedLocalTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, day] = ymd.split('-').map((value) => Number(value));
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const actualMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    guess += targetMs - actualMs;
  }

  return new Date(guess);
}

export function normalizeTimeZone(timeZone?: string | null): string {
  const trimmed = timeZone?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TIMEZONE;
}

export function getZonedDayBounds(
  reference: Date,
  timeZone: string,
  dayOffset: number,
): { end: Date; start: Date } {
  const anchor = new Date(reference.getTime() + dayOffset * 86_400_000);
  const ymd = formatYmd(getZonedParts(anchor, timeZone));
  const start = zonedLocalTimeToUtc(ymd, 0, 0, 0, timeZone);
  const nextAnchor = new Date(start.getTime() + 86_400_000);
  const nextYmd = formatYmd(getZonedParts(nextAnchor, timeZone));
  const end = zonedLocalTimeToUtc(nextYmd, 0, 0, 0, timeZone);
  return { end, start };
}
