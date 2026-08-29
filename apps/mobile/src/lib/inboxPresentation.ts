import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatConversationTime(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const dayDiff =
    (startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) / (24 * 60 * 60 * 1000);

  if (dayDiff === 0) {
    return date.toLocaleTimeString('es-AR', {
      hour: 'numeric',
      hour12: true,
      minute: '2-digit',
    });
  }

  if (dayDiff === 1) {
    return 'Ayer';
  }

  if (dayDiff < 7) {
    return date.toLocaleDateString('es-AR', { weekday: 'short' });
  }

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  });
}

export function conversationDisplayName(conversation: InboxConversationSummary): string {
  const named = conversation.contact.displayName?.trim();
  if (named) {
    return named;
  }

  if (conversation.channel === 'whatsapp') {
    const phone = conversation.contact.phoneNumber?.trim();
    if (phone) {
      return phone;
    }
  }

  if (conversation.channel === 'instagram') {
    return 'Cliente de Instagram';
  }

  return conversation.contact.phoneNumber?.trim() || conversation.externalContactId || 'Sin nombre';
}

export function conversationAvatarLabel(conversation: InboxConversationSummary): string {
  const label = conversationDisplayName(conversation);
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'WA';
}

export function conversationPreview(conversation: InboxConversationSummary): string {
  const latest = conversation.latestMessage;
  if (!latest) {
    return 'Sin mensajes todavía';
  }
  const body = latest.body?.trim();
  if (body) {
    return body;
  }
  if (latest.messageType === 'image' || latest.mediaUrl || latest.mediaStoragePath) {
    return '📷 Foto';
  }
  return 'Sin mensajes todavía';
}

export function leadStatusLabel(
  status: InboxConversationSummary['contact']['leadStatus'],
): string | undefined {
  switch (status) {
    case 'new':
      return 'Nuevo';
    case 'opportunity':
      return 'Oportunidad';
    case 'active':
      return 'Seguimiento pendiente';
    case 'cold':
      // Hidden in UI — cold is for Oportunidad calculation only.
      return undefined;
    case 'won':
      return 'Ganado';
    case 'lost':
      return 'Perdido';
    case 'finished':
      return 'Terminado';
    default:
      return undefined;
  }
}

export function messageBubbleTime(message: WhatsAppMessagePreview): string {
  return formatConversationTime(message.createdAt);
}

export function messageBubbleText(message: WhatsAppMessagePreview): string {
  const body = message.body?.trim();
  if (body) {
    return body;
  }
  if (
    message.messageType === 'audio' ||
    (message.mediaMimeType?.startsWith('audio/') ?? false)
  ) {
    return '🎤 Nota de voz';
  }
  if (message.messageType === 'image' || message.mediaUrl || message.mediaStoragePath) {
    return '';
  }
  return 'Mensaje sin texto';
}

export function messageHasImage(message: WhatsAppMessagePreview): boolean {
  if (
    message.messageType === 'audio' ||
    (message.mediaMimeType?.startsWith('audio/') ?? false)
  ) {
    return false;
  }
  return Boolean(
    message.messageType === 'image' || message.mediaUrl || message.mediaStoragePath,
  );
}

export function openConversationCount(conversations: InboxConversationSummary[]): number {
  return conversations.filter((conversation) => conversation.status === 'open').length;
}
