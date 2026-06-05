import { describe, expect, it, vi } from 'vitest';

import type { InventoryService } from '../src/domains/inventory/inventory.service';
import { TasksService } from '../src/domains/tasks/tasks.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

const organizationRows = [
  {
    ai_follow_up_delay_hours: 24,
    id: 'organization-1',
  },
];

const conversationRows = [
  {
    contact_id: 'contact-1',
    contacts: {
      display_name: 'Ana Customer',
      id: 'contact-1',
      lead_status: 'active',
      phone_number: '+15555550101',
    },
    customer_display_name: 'Ana Customer',
    external_contact_id: '+15555550101',
    id: 'conversation-1',
    last_message_at: '2026-06-04T12:00:00.000Z',
    organization_id: 'organization-1',
  },
];

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

function createService(params: {
  duplicateTask?: boolean;
  lowStockProducts?: typeof lowStockProduct[];
  ownerDeviceTokens?: Array<{ push_token: string }>;
} = {}): {
  contactUpdates: unknown[];
  inserts: Record<string, unknown[]>;
  notificationUpdates: unknown[];
  service: TasksService;
} {
  const inserts: Record<string, unknown[]> = {
    owner_notifications: [],
    owner_tasks: [],
  };
  const contactUpdates: unknown[] = [];
  const notificationUpdates: unknown[] = [];

  const supabaseService = {
    getServiceRoleClient: () => ({
      from: (table: string) => createQuery(table),
    }),
  } as unknown as SupabaseService;
  const inventoryService = {
    listLowStockProducts: vi.fn(async () => params.lowStockProducts ?? []),
  } as unknown as InventoryService;

  function createQuery(table: string): Record<string, unknown> {
    const query = {
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      insert: vi.fn((row: unknown) => {
        inserts[table]?.push(row);
        return query;
      }),
      lte: vi.fn(() => query),
      not: vi.fn(() => query),
      order: vi.fn(async () => {
        if (table === 'organizations') {
          return { data: organizationRows, error: null };
        }

        if (table === 'conversations') {
          return { data: conversationRows, error: null };
        }

        return { data: [], error: null };
      }),
      select: vi.fn(() => query),
      single: vi.fn(async () => {
        if (table === 'owner_tasks' && params.duplicateTask) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }

        return { data: { id: `${table}-id` }, error: null };
      }),
      then: (resolve: (value: unknown) => void) => {
        if (table === 'owner_device_tokens') {
          return Promise.resolve({
            data: params.ownerDeviceTokens ?? [],
            error: null,
          }).then(resolve);
        }

        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
      update: vi.fn((row: unknown) => {
        if (table === 'contacts') {
          contactUpdates.push(row);
        }

        if (table === 'owner_notifications') {
          notificationUpdates.push(row);
        }

        return query;
      }),
    };

    return query;
  }

  return {
    contactUpdates,
    inserts,
    notificationUpdates,
    service: new TasksService(supabaseService, inventoryService),
  };
}

describe('TasksService', () => {
  it('creates follow-up tasks for idle conversations and marks active leads cold', async () => {
    const { contactUpdates, inserts, service } = createService();

    await expect(
      service.runMaintenance({
        now: new Date('2026-06-05T18:00:00.000Z'),
        organizationId: 'organization-1',
      }),
    ).resolves.toEqual({
      followUpTasksCreated: 1,
      lowStockAlertsCreated: 0,
      pushNotificationsFailed: 0,
      pushNotificationsSent: 0,
    });

    expect(inserts.owner_tasks).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        conversation_id: 'conversation-1',
        organization_id: 'organization-1',
        source_key: 'follow_up:conversation-1:2026-06-04T12:00:00.000Z',
        title: 'Follow up with Ana Customer',
      }),
    ]);
    expect(contactUpdates).toEqual([{ lead_status: 'cold' }]);
  });

  it('does not recreate duplicate follow-up tasks for the same lead state', async () => {
    const { contactUpdates, service } = createService({ duplicateTask: true });

    await expect(
      service.runMaintenance({
        now: new Date('2026-06-05T18:00:00.000Z'),
        organizationId: 'organization-1',
      }),
    ).resolves.toMatchObject({
      followUpTasksCreated: 0,
    });

    expect(contactUpdates).toEqual([]);
  });

  it('creates low-stock alerts and sends Expo push notifications to owner devices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ data: [{ status: 'ok', id: 'expo-ticket-1' }] }),
      })),
    );
    const { inserts, notificationUpdates, service } = createService({
      lowStockProducts: [lowStockProduct],
      ownerDeviceTokens: [{ push_token: 'ExponentPushToken[test]' }],
    });

    await expect(
      service.runMaintenance({
        now: new Date('2026-06-05T18:00:00.000Z'),
        organizationId: 'organization-1',
      }),
    ).resolves.toMatchObject({
      lowStockAlertsCreated: 1,
      pushNotificationsFailed: 0,
      pushNotificationsSent: 1,
    });

    expect(inserts.owner_notifications).toEqual([
      expect.objectContaining({
        notification_type: 'low_stock',
        organization_id: 'organization-1',
        product_id: 'product-1',
        source_key: 'low_stock:product-1:stock:2:threshold:5',
      }),
    ]);
    expect(notificationUpdates).toEqual([
      expect.objectContaining({
        status: 'sent',
      }),
    ]);
  });
});
