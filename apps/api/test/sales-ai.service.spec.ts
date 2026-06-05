import { describe, expect, it, vi } from 'vitest';

import { InventoryService } from '../src/domains/inventory/inventory.service';
import { SalesAiService } from '../src/domains/ai/sales-ai.service';
import { WhatsAppOutboundMessageService } from '../src/domains/whatsapp/whatsapp-outbound-message.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const products = [
  {
    currency: 'USD',
    description: 'Cotton shirt',
    id: 'product-1',
    isLowStock: false,
    name: 'Blue Shirt',
    organizationId: 'organization-1',
    reorderThreshold: 3,
    sku: 'SHIRT-BLUE',
    stockQuantity: 8,
    unitPriceCents: 2500,
  },
];

function createService(): SalesAiService {
  const inventoryService = {
    listActiveProducts: vi.fn(async () => products),
  } as unknown as InventoryService;

  return new SalesAiService(
    {} as SupabaseService,
    inventoryService,
    {} as WhatsAppOutboundMessageService,
  );
}

describe('SalesAiService', () => {
  it('generates a catalog-backed stock and price reply without inventing facts', async () => {
    const service = createService();

    await expect(
      service.generateDraft({
        messageBody: 'Do you have blue shirt in stock and what is the price?',
        organizationId: 'organization-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        autoSendEligible: true,
        draftType: 'reply',
        reason: 'catalog_backed_reply',
        body: expect.stringContaining('Blue Shirt'),
      }),
    );
  });

  it('uses a safe fallback when a catalog question has no verified product', async () => {
    const service = createService();

    await expect(
      service.generateDraft({
        messageBody: 'What is the price for red shoes?',
        organizationId: 'organization-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        autoSendEligible: false,
        reason: 'catalog_question_without_verified_product',
        body: expect.stringContaining("don't see that item"),
      }),
    );
  });

  it('generates a text-only quote from matched catalog products for review', async () => {
    const service = createService();

    await expect(
      service.generateDraft({
        messageBody: 'Please send a quote for SHIRT-BLUE',
        organizationId: 'organization-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        autoSendEligible: false,
        draftType: 'quote',
        reason: 'quote_requires_owner_review',
        body: expect.stringContaining('Quote:'),
      }),
    );
  });
});
