import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  WhatsAppInboundMessageLog,
  WhatsAppWebhookPayload,
} from './whatsapp-webhook.types';

export class InvalidWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly seenMessageIds = new Set<string>();

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

          const duplicate = this.seenMessageIds.has(message.id);
          this.seenMessageIds.add(message.id);

          events.push({
            messageId: message.id,
            senderPhone: message.from,
            phoneNumberId,
            timestamp: this.toIsoTimestamp(message.timestamp),
            messageType: message.type ?? 'unknown',
            duplicate,
          });
        }
      }
    }

    return events;
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
