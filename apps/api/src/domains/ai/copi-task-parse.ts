export type ParsedTaskItem = {
  assigneeName: string | null;
  assignedToUserId: string | null;
  clarificationQuestion: string | null;
  description: string;
  dueAt: string | null;
  remindAt: string | null;
  title: string;
};

const REMINDER_LEAD_MS = 30 * 60 * 1000;

const ASSIGNEE_PATTERN =
  /\b(?:y\s+)?(?:asignarl[oa]s?|asignar(?:la|lo|las|los)?|asignada?|pasale|pasársela|pasarsela|dale)\s+a\s+([a-záéíóúñü]+)\b/gi;

/**
 * Splits a Copi "create task(s)" message into one or more cleaned task items,
 * including due dates / reminders when the text implies them.
 */
export function parseCreateTaskItems(question: string, timezone: string): ParsedTaskItem[] {
  const segments = splitTaskSegments(question);

  return segments.map((segment) => {
    const { assigneeName, text } = extractAssignee(segment);
    const title = cleanTaskTitle(text);
    const due = inferTaskSchedule(segment, timezone);
    const clarificationQuestion =
      due.needsExactTime && title.length > 0
        ? `¿A qué hora exacta querés completar «${title}»?`
        : null;

    return {
      assigneeName,
      assignedToUserId: null,
      clarificationQuestion,
      description: text.trim() || segment.trim(),
      dueAt: due.dueAt,
      remindAt: due.remindAt,
      title: title.length > 0 ? title.slice(0, 120) : 'Tarea de Copi',
    };
  });
}

export function buildCreateTaskPayload(
  question: string,
  timezone: string,
): Record<string, unknown> {
  const tasks = parseCreateTaskItems(question, timezone);
  const clarifications = tasks
    .map((task) => task.clarificationQuestion)
    .filter((value): value is string => Boolean(value));

  return {
    clarificationQuestions: clarifications,
    description: question,
    dueAt: tasks[0]?.dueAt ?? null,
    remindAt: tasks[0]?.remindAt ?? null,
    tasks,
    title: tasks[0]?.title ?? 'Tarea de Copi',
  };
}

export function summarizeCreateTaskPayload(payload: Record<string, unknown>): string {
  const tasks = readTaskItems(payload);

  if (tasks.length === 0) {
    return `Crear tarea: ${String(payload.title ?? 'Sin título')}`;
  }

  if (tasks.length === 1) {
    const task = tasks[0]!;
    const dueSuffix = task.dueAt ? ` (vence ${formatDueHint(task.dueAt)})` : '';
    const assigneeSuffix = task.assigneeName ? ` (asignada a ${task.assigneeName})` : '';
    return `Crear tarea: ${task.title}${assigneeSuffix}${dueSuffix}`;
  }

  const lines = tasks
    .map((task, index) => {
      const assigneeSuffix = task.assigneeName ? ` → ${task.assigneeName}` : '';
      return `${index + 1}) ${task.title}${assigneeSuffix}`;
    })
    .join('; ');
  return `Crear ${tasks.length} tareas: ${lines}`;
}

export function readTaskItems(payload: Record<string, unknown>): ParsedTaskItem[] {
  const rawTasks = payload.tasks;

  if (Array.isArray(rawTasks) && rawTasks.length > 0) {
    return rawTasks
      .map((item) => normalizeTaskItem(item, String(payload.description ?? '')))
      .filter((item): item is ParsedTaskItem => item != null);
  }

  const title = String(payload.title ?? '').trim();
  if (!title) {
    return [];
  }

  return [
    {
      assigneeName: typeof payload.assigneeName === 'string' ? payload.assigneeName : null,
      assignedToUserId:
        typeof payload.assignedToUserId === 'string' ? payload.assignedToUserId : null,
      clarificationQuestion: null,
      description: (payload.description as string | undefined) ?? title,
      dueAt: (payload.dueAt as string | null | undefined) ?? null,
      remindAt: (payload.remindAt as string | null | undefined) ?? null,
      title,
    },
  ];
}

function normalizeTaskItem(raw: unknown, fallbackDescription: string): ParsedTaskItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const title = String(item.title ?? '').trim();
  if (!title) {
    return null;
  }

  return {
    assigneeName: typeof item.assigneeName === 'string' ? item.assigneeName.trim() || null : null,
    assignedToUserId:
      typeof item.assignedToUserId === 'string' ? item.assignedToUserId.trim() || null : null,
    clarificationQuestion:
      typeof item.clarificationQuestion === 'string' ? item.clarificationQuestion : null,
    description:
      typeof item.description === 'string' && item.description.trim().length > 0
        ? item.description.trim()
        : fallbackDescription,
    dueAt: typeof item.dueAt === 'string' ? item.dueAt : null,
    remindAt: typeof item.remindAt === 'string' ? item.remindAt : null,
    title: title.slice(0, 120),
  };
}

export function extractAssignee(segment: string): { assigneeName: string | null; text: string } {
  const match = [...segment.matchAll(ASSIGNEE_PATTERN)].at(-1);
  if (!match?.[1]) {
    return { assigneeName: null, text: segment };
  }

  const assigneeName = sentenceCase(match[1].trim());
  const text = segment
    .replace(ASSIGNEE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/[,\s]+$/g, '')
    .trim();

  return { assigneeName, text };
}

function splitTaskSegments(question: string): string[] {
  const trimmed = question.trim();
  if (!trimmed) {
    return [question];
  }

  const numberedParts = trimmed
    .split(/(?=\b\d+[\.\):-]\s+)/)
    .map((part) => part.replace(/^\d+[\.\):-]\s+/, '').trim())
    .map(stripIntroNoise)
    .map((part) => part.replace(/^[.\-,\s]+/, '').trim())
    .filter((part) => part.length > 0 && !isIntroOnly(part));

  if (numberedParts.length >= 2) {
    return numberedParts;
  }

  const tareaParaMatches = [...trimmed.matchAll(/\btarea\s+para\b/gi)];
  if (tareaParaMatches.length >= 2) {
    const parts: string[] = [];
    for (let index = 0; index < tareaParaMatches.length; index += 1) {
      const start = tareaParaMatches[index]!.index ?? 0;
      const end = tareaParaMatches[index + 1]?.index ?? trimmed.length;
      parts.push(trimmed.slice(start, end).replace(/^[,\s]+|[,\s]+$/g, '').trim());
    }

    const cleaned = parts.map(stripIntroNoise).filter((part) => part.length > 0 && !isIntroOnly(part));
    if (cleaned.length >= 2) {
      return cleaned;
    }
  }

  const multiHint = /\b(dos|2|tres|3|varias)\s+tareas\b/i.test(trimmed);
  if (multiHint) {
    const afterIntro = stripIntroNoise(trimmed);
    const splitOnY = afterIntro
      .split(/\s+y\s+(?=tarea\b|crear\b|mandar\b|enviar\b|hacer\b)/i)
      .map(stripIntroNoise)
      .filter((part) => part.length > 0 && !isIntroOnly(part));
    if (splitOnY.length >= 2) {
      return splitOnY;
    }
  }

  const single = stripIntroNoise(trimmed);
  return [single.length > 0 ? single : trimmed];
}

function isIntroOnly(text: string): boolean {
  return /^(hola\b.*)?(necesito\s+que\s+)?(creas?|creá|crear)\s+(dos|2|tres|3|varias|\d+)?\s*tareas?\.?$/i.test(
    text.trim(),
  );
}

function stripIntroNoise(text: string): string {
  return text
    .replace(
      /^(hola\s+copi[,!]?\s*)?(necesito\s+que\s+)?(creas?|creá|crear|recordá|recordar)\s+(dos|2|tres|3|varias|\d+)?\s*tareas?\s*[:.\-]?\s*/i,
      '',
    )
    .replace(/^(hola\s+copi[,!]?\s*)?/i, '')
    .replace(/^(necesito\s+que\s+)?(creas?|creá|crear)\s+(una\s+)?tarea\s+(para\s+)?/i, '')
    .replace(/^(que\s+)?creas?\s+/i, '')
    .trim();
}

function cleanTaskTitle(segment: string): string {
  let cleaned = stripIntroNoise(segment);

  cleaned = cleaned
    .replace(/^\d+[\.\):-]\s*/g, '')
    .replace(/^(una\s+)?tarea\s+para\s+/i, '')
    .replace(/^tarea\s+/i, '')
    .replace(/^(para\s+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip schedule hints without swallowing the rest of the title
  // (e.g. "Mañana por la mañana hacer pedido…" must not become "Mañana").
  cleaned = cleaned
    .replace(/\bpasado\s+mañana\b/gi, ' ')
    .replace(/\b(esta|por\s+la)\s+mañana\b/gi, ' ')
    .replace(/\b(esta|a\s+la|por\s+la)\s+tarde\b/gi, ' ')
    .replace(/\bantes\s+de\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\ba\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\bhoy\b/gi, ' ')
    .replace(/\bmañana\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,\s]+$/g, '')
    .trim();

  if (!cleaned) {
    return 'Tarea de Copi';
  }

  return sentenceCase(cleaned);
}

function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase('es-AR');
  const withFirst = lower.replace(/^[a-záéíóúñü]/i, (letter) => letter.toLocaleUpperCase('es-AR'));

  return withFirst.replace(/\b(para|a|de)\s+([a-záéíóúñü]+)\b/gi, (_match, prep: string, name: string) => {
    return `${prep} ${name.charAt(0).toLocaleUpperCase('es-AR')}${name.slice(1)}`;
  });
}

function inferTaskSchedule(
  segment: string,
  timezone: string,
): { dueAt: string | null; needsExactTime: boolean; remindAt: string | null } {
  const now = new Date();
  const local = zonedParts(now, timezone);
  let dayOffset = 0;
  let hour: number | null = null;
  let minute = 0;
  let needsExactTime = false;
  const morningOfDay = /\b(esta\s+mañana|por\s+la\s+mañana|a\s+la\s+mañana)\b/i.test(segment);
  const afternoonOfDay = /\b(tarde|esta\s+tarde|a\s+la\s+tarde|por\s+la\s+tarde)\b/i.test(segment);
  // Remove time-of-day phrases before detecting "mañana" = tomorrow.
  const withoutTimeOfDay = segment
    .replace(/\b(esta|por\s+la|a\s+la)\s+mañana\b/gi, ' ')
    .replace(/\b(esta|por\s+la|a\s+la)\s+tarde\b/gi, ' ');

  if (/\bpasado\s+mañana\b/i.test(withoutTimeOfDay)) {
    dayOffset = 2;
  } else if (/\bmañana\b/i.test(withoutTimeOfDay)) {
    dayOffset = 1;
  } else if (/\bhoy\b/i.test(segment)) {
    dayOffset = 0;
  }

  const beforeMatch = segment.match(
    /\bantes\s+de\s+las?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|hs|hrs|horas)?\b/i,
  );
  const clockMatch =
    beforeMatch ??
    segment.match(/\b(?:a\s+las?\s*)?(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|hs|hrs|horas)?\b/i);
  if (clockMatch) {
    let parsedHour = Number.parseInt(clockMatch[1]!, 10);
    const meridiem = clockMatch[3]?.toLocaleLowerCase('es-AR');
    if (meridiem === 'pm' && parsedHour < 12) {
      parsedHour += 12;
    }
    if (meridiem === 'am' && parsedHour === 12) {
      parsedHour = 0;
    }
    if (parsedHour >= 0 && parsedHour <= 23) {
      hour = parsedHour;
      minute = clockMatch[2] ? Number.parseInt(clockMatch[2], 10) : 0;
      // "antes de las 11" → due at 11:00 still; reminder stays 30m before.
      needsExactTime = false;
    }
  } else if (afternoonOfDay) {
    hour = 17;
    needsExactTime = true;
  } else if (morningOfDay) {
    hour = 10;
    needsExactTime = true;
  } else if (dayOffset > 0) {
    hour = 10;
    needsExactTime = true;
  }

  if (hour == null) {
    return { dueAt: null, needsExactTime: false, remindAt: null };
  }

  const dueLocal = {
    day: local.day + dayOffset,
    hour,
    minute,
    month: local.month,
    year: local.year,
  };

  const dueAt = wallTimeToUtcIso(dueLocal, timezone);
  if (!dueAt) {
    return { dueAt: null, needsExactTime, remindAt: null };
  }

  const remindAt = new Date(new Date(dueAt).getTime() - REMINDER_LEAD_MS).toISOString();
  return { dueAt, needsExactTime, remindAt };
}

function wallTimeToUtcIso(
  wall: { day: number; hour: number; minute: number; month: number; year: number },
  timezone: string,
): string | null {
  const pad = (value: number) => String(value).padStart(2, '0');
  const offset = resolveTimezoneOffset(timezone);
  const stamped = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:00${offset}`;
  const parsed = new Date(stamped);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function resolveTimezoneOffset(timezone: string): string {
  if (/Argentina|Buenos_Aires|Cordoba|Mendoza|Salta/i.test(timezone)) {
    return '-03:00';
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = raw.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
    if (!match) {
      return '-03:00';
    }

    const hours = Number.parseInt(match[1]!, 10);
    const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
    const sign = hours >= 0 ? '+' : '-';
    return `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return '-03:00';
  }
}

function zonedParts(
  date: Date,
  timezone: string,
): { day: number; hour: number; minute: number; month: number; year: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
      minute: 'numeric',
      month: 'numeric',
      timeZone: timezone,
      year: 'numeric',
    }).formatToParts(date);

    const read = (type: string): number =>
      Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);

    return {
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
      month: read('month'),
      year: read('year'),
    };
  } catch {
    return {
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
}

function formatDueHint(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'America/Argentina/Cordoba',
  });
}
