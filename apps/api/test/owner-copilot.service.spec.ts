import { describe, expect, it, vi } from 'vitest';

import { InventoryService } from '../src/domains/inventory/inventory.service';
import { OwnerCopilotService } from '../src/domains/ai/owner-copilot.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const lowStockProduct = {
  currency: 'USD',
  description: null,
  id: 'product-1',
  isLowStock: true,
  name: 'Blue Shirt',
  organizationId: 'organization-1',
  reorderThreshold: 5,
  sku: 'SHIRT-BLUE',
  stockQuantity: 2,
  unitPriceCents: 2500,
};

function createService(): {
  queriedTables: string[];
  service: OwnerCopilotService;
} {
  const queriedTables: string[] = [];
  const supabaseService = {
    getServiceRoleClient: () => ({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      from: (table: string) => {
        queriedTables.push(table);
        return createQuery(table);
      },
    }),
  } as unknown as SupabaseService;
  const inventoryService = {
    listLowStockProducts: vi.fn(async () => [lowStockProduct]),
  } as unknown as InventoryService;

  return {
    queriedTables,
    service: new OwnerCopilotService(supabaseService, inventoryService),
  };
}

function createQuery(table: string): Record<string, unknown> {
  const query = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => {
      if (table === 'organization_members') {
        return { data: { role: 'owner' }, error: null };
      }

      return { data: null, error: null };
    }),
    then: (resolve: (value: unknown) => void) => {
      if (table === 'conversation_messages') {
        return Promise.resolve({
          data: [
            {
              body: 'Do you have blue shirts?',
              created_at: '2026-06-05T14:00:00.000Z',
              sender_phone: '+15555550101',
            },
          ],
          error: null,
        }).then(resolve);
      }

      if (table === 'owner_tasks') {
        return Promise.resolve({
          data: [
            {
              due_at: '2026-06-05T18:00:00.000Z',
              title: 'Follow up with Ana Customer',
            },
          ],
          error: null,
        }).then(resolve);
      }

      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };

  return query;
}

describe('OwnerCopilotService', () => {
  it('answers the full MVP query set with tenant membership validation', async () => {
    const { queriedTables, service } = createService();

    await expect(
      service.answerQuestion({
        authorizationHeader: 'Bearer test-token',
        organizationId: 'organization-1',
        question: 'What needs my attention?',
        now: new Date('2026-06-05T19:00:00.000Z'),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('Messages today: 1 inbound message'),
        tools: ['messages_today', 'low_stock', 'pending_follow_ups'],
      }),
    );

    expect(queriedTables).toContain('organization_members');
    expect(queriedTables).toContain('conversation_messages');
  });

  it('routes low-stock and follow-up questions to the matching tools', async () => {
    const { service } = createService();

    await expect(
      service.answerQuestion({
        authorizationHeader: 'Bearer test-token',
        organizationId: 'organization-1',
        question: 'Show low stock and pending follow ups',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('Blue Shirt'),
        tools: ['low_stock', 'pending_follow_ups'],
      }),
    );
  });
});
