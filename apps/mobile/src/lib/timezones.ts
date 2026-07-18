/** Common IANA time zones for LatAm / business ops, with labels and UTC offsets. */

export type TimezoneOption = {
  id: string;
  label: string;
  offsetLabel: string;
};

/**
 * Compute the UTC offset for an IANA zone without relying on `timeZoneName: longOffset`,
 * which Hermes/React Native often does not populate (it returns plain "GMT").
 */
function getTimezoneOffsetMinutes(timeZone: string, at: Date): number {
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC' || timeZone === 'Etc/GMT') {
    return 0;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(at)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const year = Number.parseInt(parts.year ?? '0', 10);
  const month = Number.parseInt(parts.month ?? '1', 10);
  const day = Number.parseInt(parts.day ?? '1', 10);
  let hour = Number.parseInt(parts.hour ?? '0', 10);
  const minute = Number.parseInt(parts.minute ?? '0', 10);
  const second = Number.parseInt(parts.second ?? '0', 10);

  // Some engines report midnight as 24:00.
  if (hour === 24) {
    hour = 0;
  }

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export function formatUtcOffset(timeZone: string, at: Date = new Date()): string {
  try {
    const totalMinutes = getTimezoneOffsetMinutes(timeZone, at);
    const sign = totalMinutes < 0 ? '-' : '+';
    const absolute = Math.abs(totalMinutes);
    const hours = Math.floor(absolute / 60);
    const minutes = absolute % 60;
    return `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return 'UTC+0:00';
  }
}

const TIMEZONE_IDS = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Argentina/Salta',
  'America/Argentina/Ushuaia',
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/Santiago',
  'America/Montevideo',
  'America/Asuncion',
  'America/La_Paz',
  'America/Lima',
  'America/Bogota',
  'America/Caracas',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
] as const;

function humanizeTimezoneId(id: string): string {
  if (id === 'UTC') {
    return 'UTC';
  }

  return id.replace(/^America\//, '').replace(/^Europe\//, '').replace(/_/g, ' ');
}

export function buildTimezoneOptions(at: Date = new Date()): TimezoneOption[] {
  return TIMEZONE_IDS.map((id) => {
    const offsetLabel = formatUtcOffset(id, at);
    return {
      id,
      label: `${humanizeTimezoneId(id)} (${offsetLabel})`,
      offsetLabel,
    };
  });
}

export function formatTimezoneOptionLabel(timeZone: string, at: Date = new Date()): string {
  return `${humanizeTimezoneId(timeZone)} (${formatUtcOffset(timeZone, at)})`;
}
