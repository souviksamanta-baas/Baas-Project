import type { CopiActionType } from './copi.types';
import { applyAppointmentContextFromHistory } from './copi-task-parse';

export type CopiHistoryTurn = { body: string; role: 'owner' | 'assistant' | 'system' };

/**
 * Compact brief of the ongoing Copi message chain for the planner / phraser.
 * Prefer this over re-asking the owner for facts already in history.
 */
export function buildChainContextBrief(history: CopiHistoryTurn[]): string {
  const recent = history.slice(-16);
  if (recent.length === 0) {
    return 'No prior Copi turns in this session.';
  }

  const quotes = extractQuotedSnippets(recent);
  const scheduleHints = recent
    .map((turn) => turn.body)
    .filter((body) =>
      /\b(mañana|hoy|pasado\s+mañana|a\s+las\s+\d|tarde|noche|\d{1,2}:\d{2})\b/i.test(body),
    )
    .slice(-3);

  const lines = [
    'Ongoing Copi chain (resolve este/ese/eso/esa/"ese mensaje"/"ese horario" from here before clarifying):',
    ...recent.map((turn) => `- ${turn.role}: ${truncate(turn.body.replace(/\s+/g, ' '), 220)}`),
  ];

  if (quotes.length > 0) {
    lines.push(`Latest quoted customer-facing text: «${truncate(quotes[quotes.length - 1]!, 280)}»`);
  }
  if (scheduleHints.length > 0) {
    lines.push(`Schedule hints in chain: ${truncate(scheduleHints[scheduleHints.length - 1]!, 200)}`);
  }

  return lines.join('\n');
}

/**
 * Apply deictic references from the Copi message chain to any write payload.
 * Appointment-specific enrichment lives in applyAppointmentContextFromHistory;
 * other actions get shared "ese mensaje" / description fill-ins.
 */
export function applyChainContextToActionPayload(params: {
  actionType: CopiActionType;
  history: CopiHistoryTurn[];
  payload: Record<string, unknown>;
  question: string;
  timezone: string;
}): Record<string, unknown> {
  if (params.actionType === 'appointment_create') {
    return applyAppointmentContextFromHistory({
      history: params.history,
      payload: params.payload,
      question: params.question,
      timezone: params.timezone,
    });
  }

  let next = { ...params.payload };
  const quotes = extractQuotedSnippets(params.history);
  const lastQuoted = quotes.length > 0 ? quotes[quotes.length - 1]! : null;
  const wantsPriorMessage = /\b(ese\s+mensaje|esa\s+respuesta|eso|esto|agrega\s+ese|añade\s+ese|en\s+notas)\b/i.test(
    params.question,
  );

  if (wantsPriorMessage && lastQuoted) {
    if (params.actionType === 'create_task' || params.actionType === 'schedule_reminder') {
      const description =
        typeof next.description === 'string' && next.description.trim()
          ? next.description.trim()
          : '';
      if (!description.includes(lastQuoted.slice(0, 40))) {
        next = {
          ...next,
          description: description
            ? `${description}\n\nContexto: ${lastQuoted}`
            : lastQuoted,
        };
      }
    }

    if (params.actionType === 'create_support_ticket') {
      const body = typeof next.body === 'string' ? next.body.trim() : '';
      if (!body.includes(lastQuoted.slice(0, 40))) {
        next = {
          ...next,
          body: body ? `${body}\n\n${lastQuoted}` : lastQuoted,
        };
      }
    }

    if (
      (params.actionType === 'cash_ingreso' || params.actionType === 'cash_egreso') &&
      typeof next.concept !== 'string'
    ) {
      next = { ...next, concept: truncate(lastQuoted, 80) };
    }
  }

  // Drop empty clarification lists noise; keep only non-empty strings.
  if (Array.isArray(next.clarificationQuestions)) {
    next = {
      ...next,
      clarificationQuestions: next.clarificationQuestions.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      ),
    };
  }

  return next;
}

export function extractQuotedSnippets(history: CopiHistoryTurn[]): string[] {
  const snippets: string[] = [];
  for (const turn of history.slice(-16)) {
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

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}
