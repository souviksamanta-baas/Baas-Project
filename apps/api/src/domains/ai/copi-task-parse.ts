export type ParsedTaskItem = {
  assigneeName: string | null;
  assignedToUserId: string | null;
  clarificationQuestion: string | null;
  description: string;
  dueAt: string | null;
  recurrenceFreq: 'daily' | 'weekly' | 'monthly' | null;
  recurrenceWeekday: number | null;
  remindAt: string | null;
  title: string;
};

const REMINDER_LEAD_MS = 30 * 60 * 1000;

// "asigna una tarea a Souv", "asignalo a Beto", "asígnale a Juli", …
const ASSIGNEE_PATTERN =
  /\b(?:y\s+)?(?:asign[aá](?:r)?\s+(?:(?:una|la|el|esta|este)\s+)?(?:tarea|task|seguimiento)\s+a|(?:asignarl[oa]s?|as[ií]gnal[oa]s?|asignar(?:la|lo|las|los)?|asignada?|pasale|pasársela|pasarsela|dale|que\s+lo\s+haga|para\s+que\s+lo\s+haga)\s+a)\s+([a-záéíóúñü][\wáéíóúñü'-]{0,40})\b/gi;

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
    const recurrence = inferRecurrence(segment);
    const clarificationQuestion =
      due.needsExactTime && title.length > 0
        ? `¿A qué hora exacta querés completar «${title}»?`
        : null;
    const description = buildTaskDescription(text, title);

    return {
      assigneeName,
      assignedToUserId: null,
      clarificationQuestion,
      description,
      dueAt: due.dueAt,
      recurrenceFreq: recurrence.freq,
      recurrenceWeekday: recurrence.weekday,
      remindAt: due.remindAt,
      title: title.length > 0 ? title.slice(0, 48) : 'Tarea de Copi',
    };
  });
}

export function buildCreateTaskPayload(
  question: string,
  timezone: string,
): Record<string, unknown> {
  const tasks = parseCreateTaskItems(question, timezone);
  const clarifications: string[] = [];
  for (const task of tasks) {
    if (task.clarificationQuestion) {
      clarifications.push(task.clarificationQuestion);
    }
    // KAN-401 mandatory fields: dueAt and assignee (creator is fallback).
    if (!task.dueAt) {
      clarifications.push(`¿Cuándo vence «${task.title}»?`);
    }
    if (!task.assigneeName && !task.assignedToUserId) {
      clarifications.push(
        `¿A quién asigno «${task.title}»? Si no me decís, te la asigno a vos.`,
      );
    }
  }

  return {
    clarificationQuestions: clarifications,
    description: tasks[0]?.description ?? question,
    dueAt: tasks[0]?.dueAt ?? null,
    recurrenceFreq: tasks[0]?.recurrenceFreq ?? null,
    recurrenceWeekday: tasks[0]?.recurrenceWeekday ?? null,
    remindAt: tasks[0]?.remindAt ?? null,
    tasks,
    title: tasks[0]?.title ?? 'Tarea de Copi',
  };
}

const APPOINTMENT_DURATION_MS = 30 * 60 * 1000;
const EMAIL_PATTERN = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/;
const APPOINTMENT_ASSIGNEE_PATTERN =
  /\b(?:asignad[oa]|asignar|asignalo|asignala|as[ií]gnalo|as[ií]gnala)\s+a\s+([a-záéíóúñü][\wáéíóúñü'.-]{0,40})\b/i;

export type ParsedAppointmentRequest = {
  assigneeName: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  clarificationQuestions: string[];
  endsAt: string | null;
  startsAt: string | null;
  title: string;
};

/**
 * Parses a Copi "create appointment" message into title, schedule, and Para contact.
 */
export function parseCreateAppointmentRequest(
  question: string,
  timezone: string,
): ParsedAppointmentRequest {
  const attendeeEmail = extractAttendeeEmail(question);
  const attendeePhone = attendeeEmail ? null : extractAttendeePhone(question);
  const assigneeMatch = question.match(APPOINTMENT_ASSIGNEE_PATTERN);
  const assigneeName = assigneeMatch?.[1]?.trim() ?? null;
  const schedule = inferTaskSchedule(question, timezone);
  const startsAt = schedule.dueAt;
  const endsAt = startsAt
    ? new Date(new Date(startsAt).getTime() + APPOINTMENT_DURATION_MS).toISOString()
    : null;
  const title = cleanAppointmentTitle(question, attendeeEmail);
  const clarificationQuestions: string[] = [];

  if (!startsAt || schedule.needsExactTime) {
    clarificationQuestions.push(
      startsAt
        ? `¿A qué hora exacta es el turno «${title}»?`
        : `¿Para cuándo agendo «${title}»?`,
    );
  }
  if (!attendeeEmail && !attendeePhone) {
    clarificationQuestions.push(
      `¿Cuál es el correo o teléfono de la persona (Para) para enviar la invitación de «${title}»?`,
    );
  }

  return {
    assigneeName,
    attendeeEmail,
    attendeePhone,
    clarificationQuestions,
    endsAt,
    startsAt,
    title,
  };
}

export function buildCreateAppointmentPayload(
  question: string,
  timezone: string,
): Record<string, unknown> {
  const parsed = parseCreateAppointmentRequest(question, timezone);
  return {
    assigneeName: parsed.assigneeName,
    attendeeEmail: parsed.attendeeEmail,
    attendeePhone: parsed.attendeePhone,
    clarificationQuestions: parsed.clarificationQuestions,
    endsAt: parsed.endsAt,
    question,
    startsAt: parsed.startsAt,
    timezone,
    title: parsed.title,
  };
}

export function summarizeCreateAppointmentPayload(payload: Record<string, unknown>): string {
  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'Nuevo turno';
  const startsAt =
    typeof payload.startsAt === 'string' && payload.startsAt.trim()
      ? ` · ${formatDueHint(payload.startsAt)}`
      : ' · horario a confirmar';
  const email =
    typeof payload.attendeeEmail === 'string' && payload.attendeeEmail.trim()
      ? payload.attendeeEmail.trim().toLowerCase()
      : null;
  const phone = normalizeAttendeePhone(
    typeof payload.attendeePhone === 'string' ? payload.attendeePhone : null,
  );
  const para = email
    ? ` · Para: ${email}`
    : phone
      ? ` · Para: ${phone}`
      : ' · falta correo o teléfono (Para)';
  const assignee =
    typeof payload.assigneeName === 'string' && payload.assigneeName.trim()
      ? ` · De: ${payload.assigneeName.trim()}`
      : '';
  return `Crear turno: ${title}${startsAt}${para}${assignee}`;
}

/**
 * Rebuild clarifications from the *final* payload so planner/history overrides
 * do not leave stale questions about fields that are already filled.
 */
export function reconcileAppointmentClarifications(
  payload: Record<string, unknown>,
): string[] {
  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'Nuevo turno';
  const startsAt =
    typeof payload.startsAt === 'string' && payload.startsAt.trim()
      ? payload.startsAt.trim()
      : null;
  const hasEmail =
    typeof payload.attendeeEmail === 'string' && Boolean(payload.attendeeEmail.trim());
  const hasPhone = Boolean(normalizeAttendeePhone(
    typeof payload.attendeePhone === 'string' ? payload.attendeePhone : null,
  ));
  const questions: string[] = [];

  if (!startsAt) {
    questions.push(`¿Para cuándo agendo «${title}»?`);
  }
  if (!hasEmail && !hasPhone) {
    questions.push(
      `¿Cuál es el correo o teléfono de la persona (Para) para enviar la invitación de «${title}»?`,
    );
  }
  return questions;
}

/**
 * When the owner refers to "ese horario" / "ese mensaje", pull schedule + notes
 * from recent Copi/customer chat turns instead of asking again.
 */
export function applyAppointmentContextFromHistory(params: {
  history: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
  payload: Record<string, unknown>;
  question: string;
  timezone: string;
}): Record<string, unknown> {
  const question = params.question;
  const wantsNotes = /\b(nota|notas|ese\s+mensaje|agrega\s+ese|añade\s+ese)\b/i.test(question);
  const wantsSchedule = /\b(ese\s+horario|ese\s+turno|para\s+ese|ese\s+día|esa\s+hora)\b/i.test(
    question,
  );

  const quoted = extractRecentQuotedSnippets(params.history);
  const lastQuoted = quoted.length > 0 ? quoted[quoted.length - 1]! : null;
  const scheduleSource =
    lastQuoted ||
    findRecentScheduleHint(params.history) ||
    (typeof params.payload.notes === 'string' ? params.payload.notes : null);

  let next: Record<string, unknown> = { ...params.payload };

  if (wantsNotes && lastQuoted && !String(next.notes ?? '').trim()) {
    next = { ...next, notes: lastQuoted };
  } else if (wantsNotes && lastQuoted) {
    // Prefer the latest customer-facing draft as notes when owner says "ese mensaje".
    next = { ...next, notes: lastQuoted };
  }

  const existingStartsAt =
    typeof next.startsAt === 'string' && next.startsAt.trim() ? next.startsAt.trim() : null;
  const startsAtIsStale =
    existingStartsAt != null && isAppointmentStartsAtStale(existingStartsAt);
  const wantsSameTime = /\b(misma\s+hora|mismo\s+horario|a\s+la\s+misma)\b/i.test(question);
  const ambiguousScheduleWord = findAmbiguousScheduleWord(question);
  const questionHasWeekday =
    !ambiguousScheduleWord &&
    nextWeekdayOffset(question, zonedParts(new Date(), params.timezone)) != null;
  const questionHasRelativeDay =
    /\b(hoy|mañana|pasado\s+mañana)\b/i.test(question) || questionHasWeekday;
  // Drop stale planner clarifications; rebuild from forced + reconcile.
  const forcedClarifications: string[] = [];

  // Ambiguous day-like tokens (e.g. "marte") → ask; never guess a weekday/year.
  if (ambiguousScheduleWord) {
    forcedClarifications.push(
      `No entendí «${ambiguousScheduleWord}». ¿A qué día te referís?`,
    );
    next = {
      ...next,
      endsAt: null,
      startsAt: null,
    };
  } else if (
    wantsSchedule ||
    !existingStartsAt ||
    startsAtIsStale ||
    questionHasRelativeDay ||
    wantsSameTime
  ) {
    const questionSchedule = inferTaskSchedule(question, params.timezone);
    const historySchedule = scheduleSource
      ? inferTaskSchedule(scheduleSource, params.timezone)
      : { dueAt: null as string | null, needsExactTime: false, remindAt: null };

    let resolvedStartsAt: string | null = null;

    if (wantsSameTime && questionSchedule.dueAt && historySchedule.dueAt) {
      const dayWall = zonedParts(new Date(questionSchedule.dueAt), params.timezone);
      const timeWall = zonedParts(new Date(historySchedule.dueAt), params.timezone);
      resolvedStartsAt = wallTimeToUtcIso(
        {
          day: dayWall.day,
          hour: timeWall.hour,
          minute: timeWall.minute,
          month: dayWall.month,
          year: dayWall.year,
        },
        params.timezone,
      );
    } else if (
      questionSchedule.dueAt &&
      (questionHasRelativeDay || !existingStartsAt || startsAtIsStale) &&
      (!questionSchedule.needsExactTime || wantsSchedule || startsAtIsStale || !existingStartsAt)
    ) {
      resolvedStartsAt = questionSchedule.dueAt;
    } else if (
      historySchedule.dueAt &&
      (wantsSchedule || !existingStartsAt || startsAtIsStale) &&
      (!historySchedule.needsExactTime || startsAtIsStale)
    ) {
      resolvedStartsAt = historySchedule.dueAt;
    } else if (existingStartsAt) {
      resolvedStartsAt = existingStartsAt;
    }

    const sanitized = sanitizeAppointmentStartsAt(
      resolvedStartsAt,
      params.timezone,
    );
    if (sanitized.startsAt) {
      next = {
        ...next,
        endsAt: new Date(
          new Date(sanitized.startsAt).getTime() + APPOINTMENT_DURATION_MS,
        ).toISOString(),
        startsAt: sanitized.startsAt,
      };
    } else {
      next = {
        ...next,
        endsAt: null,
        startsAt: null,
      };
      if (sanitized.clarification) {
        forcedClarifications.push(sanitized.clarification);
      }
    }
  } else if (existingStartsAt) {
    const sanitized = sanitizeAppointmentStartsAt(
      existingStartsAt,
      params.timezone,
    );
    if (sanitized.startsAt) {
      next = {
        ...next,
        endsAt:
          typeof next.endsAt === 'string' && next.endsAt.trim()
            ? next.endsAt
            : new Date(
                new Date(sanitized.startsAt).getTime() + APPOINTMENT_DURATION_MS,
              ).toISOString(),
        startsAt: sanitized.startsAt,
      };
    } else {
      next = {
        ...next,
        endsAt: null,
        startsAt: null,
      };
      if (sanitized.clarification) {
        forcedClarifications.push(sanitized.clarification);
      }
    }
  }

  // Prefer a concrete title from notes/history over a mangled owner-instruction title.
  const title =
    typeof next.title === 'string' && next.title.trim() ? next.title.trim() : '';
  if (!title || looksLikeInstructionTitle(title)) {
    const fromNotes =
      typeof next.notes === 'string' ? inferAppointmentTitleFromNotes(next.notes) : null;
    if (fromNotes) {
      next = { ...next, title: fromNotes };
    }
  }

  next = {
    ...next,
    clarificationQuestions: mergeClarificationQuestions(
      forcedClarifications,
      reconcileAppointmentClarifications(next),
    ),
  };
  return next;
}

function mergeClarificationQuestions(
  existing: unknown,
  extra: string[],
): string[] {
  const prior = Array.isArray(existing)
    ? existing.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const merged: string[] = [];
  for (const item of [...prior, ...extra]) {
    if (!merged.some((seen) => seen.toLocaleLowerCase('es-AR') === item.toLocaleLowerCase('es-AR'))) {
      merged.push(item);
    }
  }
  return merged;
}

function extractRecentQuotedSnippets(
  history: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>,
): string[] {
  const snippets: string[] = [];
  for (const turn of history.slice(-12)) {
    const matches = turn.body.matchAll(/[«"]([^»"]{8,500})[»"]/g);
    for (const match of matches) {
      const text = match[1]?.trim();
      if (text) {
        snippets.push(text);
      }
    }
  }
  return snippets;
}

function findRecentScheduleHint(
  history: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>,
): string | null {
  for (const turn of [...history].reverse().slice(0, 12)) {
    if (/\b(mañana|hoy|pasado\s+mañana|a\s+las\s+\d|tarde|noche|\d{1,2}:\d{2})\b/i.test(turn.body)) {
      return turn.body;
    }
  }
  return null;
}

function isAppointmentStartsAtStale(startsAtIso: string): boolean {
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return true;
  }
  // More than ~36h in the past → almost certainly a bad LLM year/date.
  return startsAt.getTime() < Date.now() - 36 * 60 * 60 * 1000;
}

/**
 * When a date is in the past (missing/wrong year), keep month/day/time and
 * advance year until the next upcoming occurrence.
 */
export function resolveUpcomingAppointmentStartsAt(
  startsAtIso: string,
  timezone: string,
  now: Date = new Date(),
): string | null {
  const starts = new Date(startsAtIso);
  if (Number.isNaN(starts.getTime())) {
    return null;
  }
  if (starts.getTime() >= now.getTime() - 60 * 60 * 1000) {
    return starts.toISOString();
  }

  const wall = zonedParts(starts, timezone);
  let year = wall.year;
  const nowWall = zonedParts(now, timezone);
  if (year < nowWall.year) {
    year = nowWall.year;
  }
  for (let guard = 0; guard < 6; guard += 1) {
    const candidate = wallTimeToUtcIso({ ...wall, year }, timezone);
    if (candidate && new Date(candidate).getTime() >= now.getTime() - 60 * 60 * 1000) {
      return candidate;
    }
    year += 1;
  }
  return null;
}

/**
 * Normalize appointment startsAt: invalid → clarify; past → next occurrence of
 * the same month/day/time (current year, else next year, …).
 */
export function sanitizeAppointmentStartsAt(
  startsAtIso: string | null | undefined,
  timezone: string = 'America/Argentina/Cordoba',
  now: Date = new Date(),
): { clarification: string | null; startsAt: string | null } {
  if (typeof startsAtIso !== 'string' || !startsAtIso.trim()) {
    return { clarification: null, startsAt: null };
  }
  const starts = new Date(startsAtIso);
  if (Number.isNaN(starts.getTime())) {
    return {
      clarification: 'No pude interpretar la fecha. ¿Para qué día y hora agendo el turno?',
      startsAt: null,
    };
  }
  if (starts.getTime() >= now.getTime() - 36 * 60 * 60 * 1000) {
    return { clarification: null, startsAt: starts.toISOString() };
  }

  const upcoming = resolveUpcomingAppointmentStartsAt(startsAtIso, timezone, now);
  if (upcoming) {
    return { clarification: null, startsAt: upcoming };
  }
  return {
    clarification:
      'No pude interpretar bien la fecha. ¿Para qué día y hora agendo el turno?',
    startsAt: null,
  };
}

/**
 * Near-miss weekday tokens (e.g. "marte" ≈ martes) — ask; do not guess.
 */
export function findAmbiguousScheduleWord(question: string): string | null {
  const normalized = question
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const tokens = normalized.match(/\b[a-záéíóúñü]{4,14}\b/gi) ?? [];
  const weekdays = [
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'sabados',
    'domingo',
    'domingos',
  ];
  const ignore = new Set([
    'hora',
    'horario',
    'misma',
    'mismo',
    'turno',
    'cita',
    'agenda',
    'agendar',
    'crear',
    'crea',
    'por',
    'favor',
    'con',
    'para',
    'una',
    'unos',
    'este',
    'esta',
    'ese',
    'esa',
    'hoy',
    'manana',
    'tarde',
    'noche',
    'despues',
  ]);

  for (const raw of tokens) {
    const token = raw
      .toLocaleLowerCase('es-AR')
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (ignore.has(token) || weekdays.includes(token)) {
      continue;
    }
    for (const day of weekdays) {
      if (editDistanceOne(token, day)) {
        return raw;
      }
    }
  }
  return null;
}

function editDistanceOne(left: string, right: string): boolean {
  if (left === right) {
    return false;
  }
  const a = left.length >= right.length ? left : right;
  const b = left.length >= right.length ? right : left;
  if (a.length - b.length > 1) {
    return false;
  }
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        diffs += 1;
        if (diffs > 1) {
          return false;
        }
      }
    }
    return diffs === 1;
  }
  // one insertion/deletion
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) {
      return false;
    }
    skipped = true;
    i += 1;
  }
  return true;
}

function looksLikeInstructionTitle(title: string): boolean {
  return /\b(ese\s+horario|agrega\s+ese|en\s+nuestra|por\s+favor|mensaje\s+en\s+notas)\b/i.test(
    title,
  );
}

function inferAppointmentTitleFromNotes(notes: string): string | null {
  if (/\bdegust/i.test(notes) && /\bcaf[eé]/i.test(notes)) {
    return 'Degustación de café';
  }
  if (/\bdegust/i.test(notes)) {
    return 'Degustación';
  }
  return null;
}

function extractAttendeeEmail(question: string): string | null {
  const match = question.match(EMAIL_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim().toLowerCase();
}

function extractAttendeePhone(question: string): string | null {
  const withoutEmail = question.replace(EMAIL_PATTERN, ' ');
  const match = withoutEmail.match(PHONE_PATTERN);
  if (!match?.[0]) {
    return null;
  }
  return normalizeAttendeePhone(match[0]);
}

/**
 * Accept only real phone digits. Reject LLM placeholders like
 * "Souvik's phone number from WhatsApp contact".
 */
export function normalizeAttendeePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  // Placeholder / prose — not a phone number.
  if (/[a-záéíóúñü]{3,}/i.test(trimmed) && (trimmed.match(/\d/g) ?? []).length < 8) {
    return null;
  }
  if (/phone number|whatsapp contact|correo|tel[eé]fono del|número del/i.test(trimmed)) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  return digits;
}

function cleanAppointmentTitle(question: string, attendeeEmail: string | null): string {
  let cleaned = question
    .replace(
      /^(hola\s+copi[,!]?\s*)?(necesito\s+que\s+)?(agend[aáe]|crear|creá|creas|anotá|anotar|program[aáe])\s+(un\s+|una\s+)?(turno|cita|reunión|reunion)\s*/i,
      '',
    )
    .replace(/^(hola\s+copi[,!]?\s*)?/i, '')
    .replace(/\b(turno|cita|reunión|reunion|agenda)\b/gi, ' ')
    .replace(EMAIL_PATTERN, ' ')
    .replace(/\b(correo|email|mail|e-mail)\b/gi, ' ')
    .replace(/\bpara\s*$/i, ' ')
    .trim();

  if (attendeeEmail) {
    cleaned = cleaned.replace(attendeeEmail, ' ').trim();
  }

  cleaned = cleanTaskTitle(cleaned || question);
  cleaned = cleaned
    .replace(/\b(con|para)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Nuevo turno';
  }

  const capped = cleaned.slice(0, 80);
  return capped.charAt(0).toLocaleUpperCase('es-AR') + capped.slice(1);
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
      recurrenceFreq: readRecurrenceFreq(payload.recurrenceFreq),
      recurrenceWeekday: readRecurrenceWeekday(payload.recurrenceWeekday),
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
    recurrenceFreq: readRecurrenceFreq(item.recurrenceFreq),
    recurrenceWeekday: readRecurrenceWeekday(item.recurrenceWeekday),
    remindAt: typeof item.remindAt === 'string' ? item.remindAt : null,
    title: title.slice(0, 48),
  };
}

function readRecurrenceFreq(value: unknown): 'daily' | 'weekly' | 'monthly' | null {
  return value === 'daily' || value === 'weekly' || value === 'monthly' ? value : null;
}

function readRecurrenceWeekday(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 6) {
    return null;
  }
  return value;
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

export type ParsedPresupuestoLine = {
  grams: number | null;
  productQuery: string;
  quantity: number | null;
};

export type ParsedPresupuestoRequest = {
  assigneeName: string | null;
  clientLabel: string;
  description: string;
  lines: ParsedPresupuestoLine[];
  title: string;
};

/**
 * Parses “crear presupuesto …” requests into lines, client, and optional assignee.
 * Explicit “creá un presupuesto …” wins even if the same message also asks for a task.
 */
export function parseCreatePresupuestoRequest(question: string): ParsedPresupuestoRequest {
  const { assigneeName, text } = extractAssignee(question);

  // Drop the follow-up “crea una tarea…” clause; assignment already extracted.
  let cleaned = text
    .replace(
      /[.\s]*(?:y\s+)?(?:creas?|creá|crear|creame)\s+(?:una\s+)?tarea\b[\s\S]*$/i,
      ' ',
    )
    .replace(/^(hola\s+copi[,!]?\s*)?/i, '')
    .replace(/^(necesito\s+que\s+)?(creas?|creá|crear|creame)\s+(un\s+|una\s+)?/i, '')
    .replace(/\bpresupuestos?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let clientLabel = 'Estandar';
  const clientMatch = cleaned.match(/\bpara\s+([a-záéíóúñü][\wáéíóúñü]*)\b(?!\s+trabajar)/i);
  if (clientMatch?.[1] && !/^(trabajar|completar|hacer|el|la|los|las)$/i.test(clientMatch[1])) {
    clientLabel = sentenceCase(clientMatch[1]);
    cleaned = cleaned
      .replace(clientMatch[0], ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const lines = extractPresupuestoLines(cleaned);
  const detail = cleaned
    .replace(/\bcon\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-,\s]+|[.\-,\s]+$/g, '')
    .trim();

  const lineSummary =
    lines.length > 0
      ? lines
          .map((line) => {
            if (line.grams != null) {
              return `${line.grams} g ${sentenceCase(line.productQuery)}`;
            }
            if (line.quantity != null) {
              return `${line.quantity}× ${sentenceCase(line.productQuery)}`;
            }
            return sentenceCase(line.productQuery);
          })
          .join(', ')
      : '';

  const title =
    lineSummary.length > 0
      ? `Presupuesto: ${lineSummary}`.slice(0, 120)
      : clientLabel !== 'Estandar'
        ? `Presupuesto para ${clientLabel}`
        : detail
          ? sentenceCase(detail).slice(0, 120)
          : 'Nuevo presupuesto';

  return {
    assigneeName,
    clientLabel,
    description: lineSummary || cleanPresupuestoDetail(detail) || question.trim(),
    lines,
    title,
  };
}

/** Drop leftover glue words from presupuesto request leftovers. */
function cleanPresupuestoDetail(detail: string): string {
  return detail
    .replace(/\b(?:también|tambien|y)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:·-]+|[\s.,;:·-]+$/g, '')
    .trim();
}

function extractPresupuestoLines(text: string): ParsedPresupuestoLine[] {
  const lines: ParsedPresupuestoLine[] = [];
  const weightPattern =
    /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos?)\s+(?:de\s+)?([a-záéíóúñü0-9][\wáéíóúñü0-9\s-]{1,60}?)(?=(?:,|\.|$|\s+y\s+|\s+crea))/gi;
  const qtyPattern =
    /(\d+(?:[.,]\d+)?)\s*(?:x|×|unidades?|uds?\.?)?\s+(?:de\s+)?([a-záéíóúñü0-9][\wáéíóúñü0-9\s-]{1,60}?)(?=(?:,|\.|$|\s+y\s+|\s+crea))/gi;

  for (const match of text.matchAll(weightPattern)) {
    const grams = Number.parseFloat((match[1] ?? '').replace(',', '.'));
    const productQuery = (match[2] ?? '').trim().replace(/\s+/g, ' ');
    if (Number.isFinite(grams) && grams > 0 && productQuery.length > 1) {
      lines.push({ grams, productQuery, quantity: null });
    }
  }

  if (lines.length > 0) {
    return lines;
  }

  for (const match of text.matchAll(qtyPattern)) {
    const quantity = Number.parseFloat((match[1] ?? '').replace(',', '.'));
    const productQuery = (match[2] ?? '').trim().replace(/\s+/g, ' ');
    if (Number.isFinite(quantity) && quantity > 0 && productQuery.length > 1) {
      lines.push({ grams: null, productQuery, quantity });
    }
  }

  const conMatch = text.match(/\bcon\s+(.+)$/i);
  if (lines.length === 0 && conMatch?.[1]) {
    const productQuery = conMatch[1]
      .replace(/\b(creas?|creá|crear|creame)\s+(?:una\s+)?tarea\b[\s\S]*$/i, '')
      .trim();
    if (productQuery.length > 1) {
      lines.push({ grams: null, productQuery, quantity: 1 });
    }
  }

  return lines;
}

export function wantsCreatePresupuestoAction(question: string): boolean {
  const normalized = question
    .trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (!/\bpresupuestos?\b/.test(normalized)) {
    return false;
  }

  if (!/\b(crea|crear|creas|creame|crea)\b/.test(normalized)) {
    return false;
  }

  // Explicit “crear un/una presupuesto …” or “presupuesto con …”.
  // Require un/una so “tarea para crear presupuesto” stays task-only.
  if (
    /\b(crea|crear|creas|creame|crea)\s+(un|una)\s+presupuesto\b/.test(normalized) ||
    /\bpresupuesto\s+con\b/.test(normalized)
  ) {
    return true;
  }

  // “crear tarea para crear presupuesto …” stays a task-only action.
  if (/\btareas?\b/.test(normalized)) {
    return false;
  }

  return true;
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
  let cleaned = text.trim();

  // Greetings / politeness (may repeat).
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned
      .replace(
        /^(hola(\s+copi)?|buen(?:o|a|os|as)?\s+(?:d[ií]as?|tardes?|noches?)|hey|hi)[,!]?\s*/i,
        '',
      )
      .replace(/^(por\s+favor|please)[,!]?\s*/i, '')
      .trim();
    if (next === cleaned) {
      break;
    }
    cleaned = next;
  }

  cleaned = cleaned
    .replace(
      /^(necesito\s+que\s+)?(creas?|creá|crear|recordá|recordar)\s+(dos|2|tres|3|varias|\d+)?\s*tareas?\s*[:.\-]?\s*/i,
      '',
    )
    .replace(
      /^(necesito\s+que\s+)?(creas?|creá|crear)\s+(una\s+)?tarea\s+(por\s+favor\s+)?(para\s+)?/i,
      '',
    )
    .replace(/^(que\s+)?creas?\s+/i, '')
    .replace(/\bpor\s+favor\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
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
    .replace(/\bde\s+la\s+(mañana|tarde|noche)\b/gi, ' ')
    .replace(/\b(esta|por\s+la)\s+mañana\b/gi, ' ')
    .replace(/\b(esta|a\s+la|por\s+la)\s+tarde\b/gi, ' ')
    .replace(/\bantes\s+de\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\ba\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\b\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)\b/gi, ' ')
    .replace(/\bhoy\b/gi, ' ')
    .replace(/\bmañana\b/gi, ' ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[:.\-\s]+/, '')
    .replace(/[.,\s]+$/g, '')
    .trim();

  if (!cleaned) {
    return 'Tarea de Copi';
  }

  const titled = sentenceCase(cleaned);
  if (titled.length <= 48) {
    return titled;
  }

  // Prefer a short noun-phrase title; keep the rest in description.
  const cut = titled.slice(0, 48);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trimEnd()}`;
}

/** Subject line for the task body — intent text, not the raw owner utterance. */
function buildTaskDescription(segment: string, title: string): string {
  let cleaned = stripIntroNoise(segment)
    .replace(/^(una\s+)?tarea\s+para\s+/i, '')
    .replace(/^tarea\s+/i, '')
    .replace(/^(para\s+)/i, '')
    .replace(/\bpasado\s+mañana\b/gi, ' ')
    .replace(/\bde\s+la\s+(mañana|tarde|noche)\b/gi, ' ')
    .replace(/\b(esta|por\s+la)\s+mañana\b/gi, ' ')
    .replace(/\b(esta|a\s+la|por\s+la)\s+tarde\b/gi, ' ')
    .replace(/\bantes\s+de\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\ba\s+las?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)?\b/gi, ' ')
    .replace(/\b\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|hs|hrs|horas)\b/gi, ' ')
    .replace(/\bhoy\b/gi, ' ')
    .replace(/\bmañana\b/gi, ' ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[:.\-\s]+/, '')
    .replace(/[.,\s]+$/g, '')
    .trim();

  if (!cleaned) {
    return title;
  }

  return sentenceCase(cleaned).slice(0, 280);
}

function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase('es-AR');
  const withFirst = lower.replace(/^[a-záéíóúñü]/i, (letter) => letter.toLocaleUpperCase('es-AR'));

  return withFirst.replace(/\b(para|a|de|con)\s+([a-záéíóúñü]+)\b/gi, (_match, prep: string, name: string) => {
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
  let absoluteRemindOnly = false;
  const morningOfDay = /\b(esta\s+mañana|por\s+la\s+mañana|a\s+la\s+mañana|de\s+la\s+mañana)\b/i.test(
    segment,
  );
  const afternoonOfDay = /\b(tarde|esta\s+tarde|a\s+la\s+tarde|por\s+la\s+tarde|de\s+la\s+tarde)\b/i.test(
    segment,
  );
  const eveningOfDay = /\b(noche|esta\s+noche|a\s+la\s+noche|de\s+la\s+noche)\b/i.test(segment);
  // Remove time-of-day phrases before detecting "mañana" = tomorrow.
  const withoutTimeOfDay = segment
    .replace(/\b(esta|por\s+la|a\s+la|de\s+la)\s+mañana\b/gi, ' ')
    .replace(/\b(esta|por\s+la|a\s+la|de\s+la)\s+tarde\b/gi, ' ')
    .replace(/\b(esta|por\s+la|a\s+la|de\s+la)\s+noche\b/gi, ' ');

  if (/\bpasado\s+mañana\b/i.test(withoutTimeOfDay)) {
    dayOffset = 2;
  } else if (/\bmañana\b/i.test(withoutTimeOfDay)) {
    dayOffset = 1;
  } else if (/\bhoy\b/i.test(segment)) {
    dayOffset = 0;
  }

  const weekdayOffset = nextWeekdayOffset(segment, local);
  if (weekdayOffset != null) {
    dayOffset = weekdayOffset;
  }

  const absoluteDate = parseAbsoluteDateHint(segment, local);
  if (absoluteDate) {
    dayOffset = absoluteDate.dayOffset;
  }

  const beforeMatch = segment.match(
    /\bantes\s+de\s+las?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|hs|hrs|horas)?\b/i,
  );
  const clockMatch =
    beforeMatch ??
    segment.match(/\ba\s+las?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|hs|hrs|horas)?\b/i) ??
    segment.match(/\b(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|hs|hrs|horas)\b/i) ??
    segment.match(/\b(\d{1,2})\s+de\s+la\s+(mañana|tarde|noche)\b/i);
  if (clockMatch) {
    let parsedHour = Number.parseInt(clockMatch[1]!, 10);
    const meridiemOrPeriod = (clockMatch[3] ?? '').toLocaleLowerCase('es-AR');
    const meridiem = ['am', 'pm', 'hs', 'hrs', 'horas'].includes(meridiemOrPeriod)
      ? meridiemOrPeriod
      : null;
    const periodWord =
      meridiemOrPeriod === 'mañana' || meridiemOrPeriod === 'tarde' || meridiemOrPeriod === 'noche'
        ? meridiemOrPeriod
        : null;

    if (meridiem === 'pm' && parsedHour < 12) {
      parsedHour += 12;
    }
    if (meridiem === 'am' && parsedHour === 12) {
      parsedHour = 0;
    }
    if (!meridiem) {
      // "4 de la tarde" / "... a las 4 ... tarde" → 16:00, not 04:00.
      if (
        (periodWord === 'tarde' || afternoonOfDay) &&
        parsedHour >= 1 &&
        parsedHour <= 11
      ) {
        parsedHour += 12;
      } else if (
        (periodWord === 'noche' || eveningOfDay) &&
        parsedHour >= 1 &&
        parsedHour <= 11
      ) {
        parsedHour += 12;
      }
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
  } else if (eveningOfDay) {
    hour = 20;
    needsExactTime = true;
  } else if (dayOffset > 0 || weekdayOffset != null || absoluteDate) {
    hour = 10;
    needsExactTime = true;
  }

  // Absolute remind phrases: "avisame a las 15", "recordame el viernes"
  if (
    hour == null &&
    /\b(avisame|avisá|avisa|recordame|recordá|recuerdame)\b/i.test(segment)
  ) {
    hour = 9;
    needsExactTime = dayOffset === 0 && weekdayOffset == null && !absoluteDate;
    absoluteRemindOnly = true;
    if (dayOffset === 0 && weekdayOffset == null && !absoluteDate) {
      dayOffset = 1; // default mañana 09:00
    }
  }

  if (hour == null) {
    return { dueAt: null, needsExactTime: false, remindAt: null };
  }

  const dueAnchor = new Date(
    Date.UTC(local.year, local.month - 1, local.day + dayOffset, 12, 0, 0),
  );
  const dueLocal = {
    day: dueAnchor.getUTCDate(),
    hour,
    minute,
    month: dueAnchor.getUTCMonth() + 1,
    year: dueAnchor.getUTCFullYear(),
  };

  const dueAt = wallTimeToUtcIso(dueLocal, timezone);
  if (!dueAt) {
    return { dueAt: null, needsExactTime, remindAt: null };
  }

  const remindAt = absoluteRemindOnly
    ? dueAt
    : new Date(new Date(dueAt).getTime() - REMINDER_LEAD_MS).toISOString();
  return { dueAt, needsExactTime, remindAt };
}

function inferRecurrence(segment: string): {
  freq: 'daily' | 'weekly' | 'monthly' | null;
  weekday: number | null;
} {
  const normalized = segment
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (/\bcada\s+(dia|d[ií]a)\b/.test(normalized) || /\bdiario\b/.test(normalized)) {
    return { freq: 'daily', weekday: null };
  }
  if (/\bcada\s+semana\b/.test(normalized) || /\bsemanal\b/.test(normalized)) {
    const weekday = weekdayFromText(normalized);
    return { freq: 'weekly', weekday };
  }
  if (/\bcada\s+mes\b/.test(normalized) || /\bmensual\b/.test(normalized)) {
    return { freq: 'monthly', weekday: null };
  }

  const weekday = weekdayFromText(normalized);
  if (weekday != null && /\bcada\b/.test(normalized)) {
    return { freq: 'weekly', weekday };
  }

  return { freq: null, weekday: null };
}

const WEEKDAY_NAMES: Array<{ day: number; pattern: RegExp }> = [
  { day: 0, pattern: /\bdomingos?\b/ },
  { day: 1, pattern: /\blunes\b/ },
  { day: 2, pattern: /\bmartes\b/ },
  { day: 3, pattern: /\bmiercoles\b/ },
  { day: 4, pattern: /\bjueves\b/ },
  { day: 5, pattern: /\bviernes\b/ },
  { day: 6, pattern: /\bsabados?\b/ },
];

function weekdayFromText(normalized: string): number | null {
  for (const entry of WEEKDAY_NAMES) {
    if (entry.pattern.test(normalized)) {
      return entry.day;
    }
  }
  return null;
}

function nextWeekdayOffset(
  segment: string,
  local: { day: number; hour: number; minute: number; month: number; year: number },
): number | null {
  const normalized = segment
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const weekday = weekdayFromText(normalized);
  if (weekday == null) {
    return null;
  }
  // Approximate "current weekday" from a noon UTC stamp of local Y-M-D.
  const stamp = new Date(Date.UTC(local.year, local.month - 1, local.day, 12, 0, 0));
  const current = stamp.getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0 && !/\bhoy\b/.test(normalized)) {
    delta = 7;
  }
  return delta;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function parseAbsoluteDateHint(
  segment: string,
  local: { day: number; month: number; year: number },
): { dayOffset: number } | null {
  const normalized = segment
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  const numeric = segment.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  const named = normalized.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{2,4}))?\b/,
  );

  let day: number;
  let month: number;
  let yearRaw: string | undefined;
  if (named) {
    day = Number.parseInt(named[1]!, 10);
    month = SPANISH_MONTHS[named[2]!] ?? 0;
    yearRaw = named[3];
  } else if (numeric) {
    day = Number.parseInt(numeric[1]!, 10);
    month = Number.parseInt(numeric[2]!, 10);
    yearRaw = numeric[3];
  } else {
    return null;
  }

  const yearWasExplicit = Boolean(yearRaw);
  let year = yearRaw ? Number.parseInt(yearRaw, 10) : local.year;
  if (year < 100) {
    year += 2000;
  }
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const today = Date.UTC(local.year, local.month - 1, local.day, 12, 0, 0);
  let target = Date.UTC(year, month - 1, day, 12, 0, 0);
  let dayOffset = Math.round((target - today) / (24 * 60 * 60 * 1000));

  // No year given (or inferred as current year) and that date is already past → next year.
  if (!yearWasExplicit && dayOffset < 0) {
    year += 1;
    target = Date.UTC(year, month - 1, day, 12, 0, 0);
    dayOffset = Math.round((target - today) / (24 * 60 * 60 * 1000));
  }

  if (dayOffset < -1 || dayOffset > 400) {
    return null;
  }
  return { dayOffset };
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

  const timeZone = 'America/Argentina/Cordoba';
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const day = read('day');
  const month = read('month').replace(/\./g, '').toLocaleLowerCase('es-AR');
  const year = read('year');
  const hour = read('hour');
  const minute = read('minute');
  const dayPeriod = read('dayPeriod');
  const time = dayPeriod ? `${hour}:${minute} ${dayPeriod}` : `${hour}:${minute}`;
  return `${day}-${month}-${year}, ${time}`;
}
