/**
 * Shared Copi defaults / ask policy for agent actions.
 * Prefer propose-with-defaults over multi-turn interrogation.
 */

export type CopiAskTier = 'auto' | 'soft' | 'hard';

export const COPI_DEFAULT_REMINDER_HOUR = 9;
export const COPI_DEFAULT_TASK_LEAD_MINUTES = 30;
export const COPI_DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
export const COPI_DEFAULT_PRODUCT_REORDER = 5;
export const COPI_SUPPORT_TICKET_SUBJECT = 'Consulta desde Copi';

/** Tomorrow at 09:00 in the given IANA timezone (fallback: local machine). */
export function defaultTomorrowNineAmIso(now: Date = new Date(), timeZone?: string): string {
  const base = new Date(now.getTime());
  base.setDate(base.getDate() + 1);
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(base);
      const year = Number(parts.find((p) => p.type === 'year')?.value);
      const month = Number(parts.find((p) => p.type === 'month')?.value);
      const day = Number(parts.find((p) => p.type === 'day')?.value);
      // Approximate wall time as UTC offset-agnostic ISO for confirm display;
      // callers that need exact zoned instants should use copi-timezone helpers.
      const rough = new Date(Date.UTC(year, month - 1, day, COPI_DEFAULT_REMINDER_HOUR, 0, 0));
      return rough.toISOString();
    } catch {
      // fall through
    }
  }
  base.setHours(COPI_DEFAULT_REMINDER_HOUR, 0, 0, 0);
  return base.toISOString();
}

/** +24h from now — existing Copi create_task fallback. */
export function defaultDueIn24hIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function defaultRemindAtFromDue(
  dueAtIso: string,
  leadMinutes: number = COPI_DEFAULT_TASK_LEAD_MINUTES,
): string {
  return new Date(new Date(dueAtIso).getTime() - leadMinutes * 60_000).toISOString();
}

export function defaultAppointmentEndsAt(startsAtIso: string): string {
  return new Date(
    new Date(startsAtIso).getTime() + COPI_DEFAULT_APPOINTMENT_DURATION_MINUTES * 60_000,
  ).toISOString();
}

export function todayYmd(now: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      return parts; // en-CA → YYYY-MM-DD
    } catch {
      // fall through
    }
  }
  return now.toISOString().slice(0, 10);
}

export function mondayToTodayRange(now: Date = new Date(), timeZone?: string): {
  fromYmd: string;
  toYmd: string;
} {
  const toYmd = todayYmd(now, timeZone);
  const d = new Date(`${toYmd}T12:00:00.000Z`);
  const day = d.getUTCDay(); // 0 Sun
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return { fromYmd: d.toISOString().slice(0, 10), toYmd };
}

/** Resolve cash report range from Spanish utterance; default = this week Mon→today. */
export function parseCashReportRange(
  question: string,
  now: Date = new Date(),
  timeZone?: string,
): { fromYmd: string; toYmd: string } {
  const q = question.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const today = todayYmd(now, timeZone);

  if (/\b(hoy|del dia|del día)\b/.test(q) && !/\b(semana|mes|ayer)\b/.test(q)) {
    return { fromYmd: today, toYmd: today };
  }

  if (/\bayer\b/.test(q)) {
    const d = new Date(`${today}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const ymd = d.toISOString().slice(0, 10);
    return { fromYmd: ymd, toYmd: ymd };
  }

  if (/\beste mes\b|\bmes actual\b|\bdel mes\b/.test(q)) {
    return { fromYmd: `${today.slice(0, 8)}01`, toYmd: today };
  }

  const isoPair = q.match(
    /\b(\d{4}-\d{2}-\d{2})\b(?:\s*(?:a|al|hasta|-|→)\s*)\b(\d{4}-\d{2}-\d{2})\b/,
  );
  if (isoPair?.[1] && isoPair[2]) {
    return { fromYmd: isoPair[1], toYmd: isoPair[2] };
  }

  const singleIso = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (singleIso?.[1] && !/\bsemana\b/.test(q)) {
    return { fromYmd: singleIso[1], toYmd: singleIso[1] };
  }

  // "esta semana" / default
  return mondayToTodayRange(now, timeZone);
}

export function truncateLabel(text: string, max = 48): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function softDefaultAssumptionsLine(assumptions: string[]): string {
  if (assumptions.length === 0) {
    return '';
  }
  return `\n\nSi confirmás, uso: ${assumptions.join('; ')}.`;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export function advanceByRecurrence(params: {
  fromIso: string;
  freq: RecurrenceFreq;
  weekday?: number | null;
}): string {
  const date = new Date(params.fromIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for recurrence: ${params.fromIso}`);
  }

  switch (params.freq) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly': {
      if (params.weekday == null) {
        date.setUTCDate(date.getUTCDate() + 7);
      } else {
        date.setUTCDate(date.getUTCDate() + 1);
        let guard = 0;
        while (date.getUTCDay() !== params.weekday && guard < 8) {
          date.setUTCDate(date.getUTCDate() + 1);
          guard += 1;
        }
      }
      break;
    }
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    default:
      break;
  }

  return date.toISOString();
}

export function buildRecurrenceInstanceSourceKey(params: {
  dueAtIso: string;
  templateKey: string;
}): string {
  return `recur:${params.templateKey}:${params.dueAtIso}`;
}
