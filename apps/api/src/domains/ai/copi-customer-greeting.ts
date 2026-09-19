import { normalizeTimeZone } from './copi-timezone.util';
import { ownerFirstName } from './copi-intent-router';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const LEADING_GREETING_PATTERN =
  /^(?:¡?\s*)?(?:hola(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{1,32})?|buenos?\s+d[ií]as?|buen\s+d[ií]a|buenas\s+(?:tardes?|noches?))[.!¡¿,;:]?\s*/iu;

export function hasOutboundWithinLastSixHours(params: {
  now?: Date;
  outboundCreatedAts: Array<string | Date | null | undefined>;
}): boolean {
  const nowMs = (params.now ?? new Date()).getTime();
  return params.outboundCreatedAts.some((value) => {
    if (!value) {
      return false;
    }
    const createdMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (Number.isNaN(createdMs)) {
      return false;
    }
    return nowMs - createdMs < SIX_HOURS_MS;
  });
}

export function timeOfDayGreeting(now: Date, timeZone?: string | null): string {
  const zone = normalizeTimeZone(timeZone);
  const hourText = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: zone,
  }).format(now);
  const hour = Number(hourText) === 24 ? 0 : Number(hourText);

  if (hour >= 20 || hour < 5) {
    return 'Buenas noches';
  }
  if (hour >= 13) {
    return 'Buenas tardes';
  }
  return 'Buenos días';
}

/** Builds e.g. "Hola Sandra. Buenos días." or "Buenos días." when name is missing. */
export function buildCustomerOutboundGreeting(params: {
  customerDisplayName?: string | null;
  now?: Date;
  timeZone?: string | null;
}): string {
  const firstName = ownerFirstName(params.customerDisplayName);
  const tod = timeOfDayGreeting(params.now ?? new Date(), params.timeZone);
  if (firstName) {
    return `Hola ${firstName}. ${tod}.`;
  }
  return `${tod}.`;
}

export function stripLeadingCustomerGreeting(body: string): string {
  let next = body.trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stripped = next.replace(LEADING_GREETING_PATTERN, '').trim();
    if (stripped === next) {
      break;
    }
    next = stripped;
  }
  return next;
}

/**
 * First org/Copi outbound to this client in 6h gets a personalized greeting.
 * Later replies strip accidental LLM greetings so they don't repeat.
 */
export function applyCustomerReplyGreeting(params: {
  body: string;
  customerDisplayName?: string | null;
  now?: Date;
  outboundCreatedAts: Array<string | Date | null | undefined>;
  timeZone?: string | null;
}): string {
  const cleaned = stripLeadingCustomerGreeting(params.body);
  if (!cleaned) {
    return params.body.trim();
  }

  if (hasOutboundWithinLastSixHours(params)) {
    return cleaned;
  }

  const greeting = buildCustomerOutboundGreeting({
    customerDisplayName: params.customerDisplayName,
    now: params.now,
    timeZone: params.timeZone,
  });
  return `${greeting}\n\n${cleaned}`;
}
