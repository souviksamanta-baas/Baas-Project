import { Linking } from 'react-native';

import { apiFetchJson, getAccessToken } from './client';
import { normalizePhoneNumber } from '../services/phone';

export async function sendAppointmentInviteEmail(input: {
  endsAt: string;
  fromLabel?: string | null;
  notes?: string | null;
  startsAt: string;
  title: string;
  toEmail: string;
}): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetchJson<{ ok: true }>('/appointments/invite-email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export function buildAppointmentInviteMessage(input: {
  endsAt: string;
  fromLabel?: string | null;
  notes?: string | null;
  startsAt: string;
  title: string;
}): string {
  const starts = new Date(input.startsAt);
  const ends = new Date(input.endsAt);
  const when = Number.isNaN(starts.getTime())
    ? input.startsAt
    : starts.toLocaleString('es-AR', {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'long',
        weekday: 'long',
      });
  const endTime = Number.isNaN(ends.getTime())
    ? input.endsAt
    : ends.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return [
    `Hola! Te comparto un turno de Nexolia:`,
    input.title,
    `Cuándo: ${when} – ${endTime}`,
    input.fromLabel ? `Con: ${input.fromLabel}` : null,
    input.notes ? `Notas: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function openAppointmentWhatsAppInvite(input: {
  endsAt: string;
  fromLabel?: string | null;
  notes?: string | null;
  phone: string;
  startsAt: string;
  title: string;
}): Promise<void> {
  const normalized = normalizePhoneNumber(input.phone);
  if (!normalized) {
    throw new Error('Ingresá un teléfono válido (ej. +54911…).');
  }

  const digits = normalized.replace(/[^\d]/g, '');
  const text = encodeURIComponent(
    buildAppointmentInviteMessage({
      endsAt: input.endsAt,
      fromLabel: input.fromLabel,
      notes: input.notes,
      startsAt: input.startsAt,
      title: input.title,
    }),
  );
  const url = `https://wa.me/${digits}?text=${text}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('No se pudo abrir WhatsApp en este dispositivo.');
  }
  await Linking.openURL(url);
}
