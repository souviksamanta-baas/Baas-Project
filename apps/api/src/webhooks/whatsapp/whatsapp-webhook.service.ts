import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  WhatsAppInboundMessageLog,
  WhatsAppMessageStatusLog,
  WhatsAppWebhookPayload,
} from './whatsapp-webhook.types';
import { WhatsAppMessageEventRepository } from './whatsapp-message-event.repository';
import { WhatsAppConversationMessageRepository } from '../../domains/whatsapp/whatsapp-conversation-message.repository';

export class InvalidWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

@Injectable()
export class WhatsAppWebhookService {
  constructor(
    private readonly eventRepository?: WhatsAppMessageEventRepository,
    private readonly conversationMessageRepository?: WhatsAppConversationMessageRepository,
  ) {}

  verifyMetaChallenge(params: {
    mode?: string;
    verifyToken?: string;
    challenge?: string;
    expectedVerifyToken?: string;
  }): string | null {
    if (
      params.mode === 'subscribe' &&
      params.challenge &&
      params.verifyToken &&
      params.expectedVerifyToken &&
      params.verifyToken === params.expectedVerifyToken
    ) {
      return params.challenge;
    }

    return null;
  }

  assertValidSignature(params: {
    rawBody?: Buffer;
    signatureHeader?: string;
    appSecret: string;
  }): void {
    if (!params.rawBody || params.rawBody.length === 0) {
      throw new InvalidWebhookSignatureError('Missing raw request body');
    }

    if (!params.signatureHeader) {
      throw new InvalidWebhookSignatureError('Missing x-hub-signature-256 header');
    }

    const expected = this.createSignature(params.rawBody, params.appSecret);
    const actual = params.signatureHeader.trim();

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new InvalidWebhookSignatureError('Invalid WhatsApp webhook signature');
    }
  }

  createSignature(rawBody: Buffer, appSecret: string): string {
    const digest = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return `sha256=${digest}`;
  }

  parseInboundMessages(payload: WhatsAppWebhookPayload): WhatsAppInboundMessageLog[] {
    const events: WhatsAppInboundMessageLog[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;

        for (const message of change.value?.messages ?? []) {
          if (!message.id || !message.from || !phoneNumberId) {
            continue;
          }

          const contact = change.value?.contacts?.find((candidate) => candidate.wa_id === message.from);

          events.push({
            messageId: message.id,
            senderPhone: message.from,
            senderDisplayName: contact?.profile?.name ?? null,
            phoneNumberId,
            timestamp: this.toIsoTimestamp(message.timestamp),
            messageType: message.type ?? 'unknown',
            textBody: message.text?.body ?? null,
            duplicate: false,
          });
        }
      }
    }

    return events;
  }

  parseMessageStatusUpdates(payload: WhatsAppWebhookPayload): WhatsAppMessageStatusLog[] {
    const events: WhatsAppMessageStatusLog[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;

        for (const status of change.value?.statuses ?? []) {
          if (!status.id || !phoneNumberId) {
            continue;
          }

          const mappedStatus = this.mapMetaStatus(status.status);
          if (!mappedStatus) {
            continue;
          }

          events.push({
            externalMessageId: status.id,
            messageStatus: mappedStatus,
            phoneNumberId,
            recipientPhone: status.recipient_id ?? null,
            timestamp: this.toIsoTimestamp(status.timestamp),
          });
        }
      }
    }

    return events;
  }

  async persistMessageStatusUpdates(
    events: WhatsAppMessageStatusLog[],
  ): Promise<number> {
    if (!this.conversationMessageRepository) {
      return 0;
    }

    let updatedCount = 0;

    for (const event of events) {
      const updated = await this.conversationMessageRepository.updateMessageStatusByExternalId({
        externalMessageId: event.externalMessageId,
        messageStatus: event.messageStatus,
        timestamp: event.timestamp,
      });

      if (updated) {
        updatedCount += 1;
      }
    }

    return updatedCount;
  }

  private mapMetaStatus(
    status?: string,
  ): WhatsAppMessageStatusLog['messageStatus'] | null {
    switch (status) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return null;
    }
  }

  async persistInboundMessages(
    events: WhatsAppInboundMessageLog[],
  ): Promise<WhatsAppInboundMessageLog[]> {
    if (!this.eventRepository) {
      return events;
    }

    return this.eventRepository.recordInboundMessages(events);
  }

  private toIsoTimestamp(timestamp?: string): string | null {
    if (!timestamp) {
      return null;
    }

    const epochSeconds = Number(timestamp);
    if (!Number.isFinite(epochSeconds)) {
      return null;
    }

    return new Date(epochSeconds * 1000).toISOString();
  }
}
