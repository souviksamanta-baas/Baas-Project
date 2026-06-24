import { describe, expect, it } from 'vitest';

import { WhatsAppMessageEventRepository } from '../src/webhooks/whatsapp/whatsapp-message-event.repository';
import {
  InvalidWebhookSignatureError,
  WhatsAppWebhookService,
} from '../src/webhooks/whatsapp/whatsapp-webhook.service';
import {
  WhatsAppInboundMessageLog,
  WhatsAppWebhookPayload,
} from '../src/webhooks/whatsapp/whatsapp-webhook.types';

function createPayload(messageId = 'wamid.test-message'): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-test',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'phone-number-id-1',
              },
              contacts: [
                {
                  wa_id: '15557654321',
                  profile: {
                    name: 'Test Sender',
                  },
                },
              ],
              messages: [
                {
                  id: messageId,
                  from: '15557654321',
                  timestamp: '1717243200',
                  type: 'text',
                  text: {
                    body: 'Hello',
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('WhatsAppWebhookService', () => {
  it('returns the Meta challenge for a valid verification request', () => {
    const service = new WhatsAppWebhookService();

    expect(
      service.verifyMetaChallenge({
        mode: 'subscribe',
        verifyToken: 'expected-token',
        challenge: 'challenge-value',
        expectedVerifyToken: 'expected-token',
      }),
    ).toBe('challenge-value');
  });

  it('rejects an invalid verification token', () => {
    const service = new WhatsAppWebhookService();

    expect(
      service.verifyMetaChallenge({
        mode: 'subscribe',
        verifyToken: 'wrong-token',
        challenge: 'challenge-value',
        expectedVerifyToken: 'expected-token',
      }),
    ).toBeNull();
  });

  it('validates the x-hub-signature-256 header', () => {
    const service = new WhatsAppWebhookService();
    const rawBody = Buffer.from(JSON.stringify(createPayload()));
    const signature = service.createSignature(rawBody, 'app-secret');

    expect(() =>
      service.assertValidSignature({
        rawBody,
        signatureHeader: signature,
        appSecret: 'app-secret',
      }),
    ).not.toThrow();

    expect(() =>
      service.assertValidSignature({
        rawBody,
        signatureHeader: 'sha256=invalid',
        appSecret: 'app-secret',
      }),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('extracts safe log fields without relying on in-memory dedupe', () => {
    const service = new WhatsAppWebhookService();
    const payload = createPayload();

    expect(service.parseInboundMessages(payload)).toEqual([
      {
        messageId: 'wamid.test-message',
        senderPhone: '15557654321',
        senderDisplayName: 'Test Sender',
        phoneNumberId: 'phone-number-id-1',
        timestamp: '2024-06-01T12:00:00.000Z',
        messageType: 'text',
        textBody: 'Hello',
        duplicate: false,
      },
    ]);

    expect(service.parseInboundMessages(payload)[0]?.duplicate).toBe(false);
  });

  it('extracts message status updates from Meta webhook payloads', () => {
    const service = new WhatsAppWebhookService();
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-test',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'phone-number-id-1',
                },
                statuses: [
                  {
                    id: 'wamid.outbound-1',
                    recipient_id: '15557654321',
                    status: 'delivered',
                    timestamp: '1717243300',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(service.parseMessageStatusUpdates(payload)).toEqual([
      {
        externalMessageId: 'wamid.outbound-1',
        messageStatus: 'delivered',
        phoneNumberId: 'phone-number-id-1',
        recipientPhone: '15557654321',
        timestamp: '2024-06-01T12:01:40.000Z',
      },
    ]);
  });

  it('uses persistent event storage as the durable dedupe boundary', async () => {
    const seenEventKeys = new Set<string>();
    const repository = {
      recordInboundMessages: async (events: WhatsAppInboundMessageLog[]) =>
        events.map((event) => {
          const eventKey = `${event.phoneNumberId}:${event.messageId}`;
          const duplicate = seenEventKeys.has(eventKey);
          seenEventKeys.add(eventKey);
          return { ...event, duplicate };
        }),
    } as unknown as WhatsAppMessageEventRepository;

    const firstServiceInstance = new WhatsAppWebhookService(repository);
    const secondServiceInstance = new WhatsAppWebhookService(repository);
    const firstEvents = firstServiceInstance.parseInboundMessages(createPayload());
    const secondEvents = secondServiceInstance.parseInboundMessages(createPayload());

    await expect(firstServiceInstance.persistInboundMessages(firstEvents)).resolves.toMatchObject([
      { messageId: 'wamid.test-message', duplicate: false },
    ]);
    await expect(secondServiceInstance.persistInboundMessages(secondEvents)).resolves.toMatchObject([
      { messageId: 'wamid.test-message', duplicate: true },
    ]);
  });
});
