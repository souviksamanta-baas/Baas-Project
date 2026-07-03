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
  return (
    conversation.contact.displayName ??
    conversation.contact.phoneNumber ??
    conversation.externalContactId
  );
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
  const body = conversation.latestMessage?.body?.trim();
  return body || 'Sin mensajes todavía';
}

export function leadStatusLabel(
  status: InboxConversationSummary['contact']['leadStatus'],
): string | undefined {
  switch (status) {
    case 'new':
      return 'Nuevo lead';
    case 'active':
      return 'Seguimiento';
    case 'cold':
      return 'Frío';
    case 'won':
      return 'Ganado';
    case 'lost':
      return 'Perdido';
    default:
      return undefined;
  }
}

export function messageBubbleTime(message: WhatsAppMessagePreview): string {
  return formatConversationTime(message.createdAt);
}

export function messageBubbleText(message: WhatsAppMessagePreview): string {
  return message.body?.trim() || 'Mensaje sin texto';
}

export function openConversationCount(conversations: InboxConversationSummary[]): number {
  return conversations.filter((conversation) => conversation.status === 'open').length;
}
