import { describe, expect, it, vi } from 'vitest';

import { CopiOrchestratorService } from '../src/domains/ai/copi-orchestrator.service';
import { CopiPolicyService } from '../src/domains/ai/copi-policy.service';
import { CopiLlmPhraserService } from '../src/domains/ai/copi-llm-phraser.service';
import { CopiLlmToolSelectorService } from '../src/domains/ai/copi-llm-tool-selector.service';
import { CopiToolRegistry } from '../src/domains/ai/copi-tool-registry';
import { CopiSessionService } from '../src/domains/ai/copi-session.service';
import { CopiActionService } from '../src/domains/ai/copi-action.service';
import { InventoryService } from '../src/domains/inventory/inventory.service';
import { TasksService } from '../src/domains/tasks/tasks.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const lowStockProduct = {
  businessCenterId: 'business-center-1',
  currency: 'USD',
  description: null,
  id: 'product-1',
  isLowStock: true,
  name: 'Blue Shirt',
  organizationId: 'organization-1',
  reorderThreshold: 5,
  sku: 'SHIRT-BLUE',
  stockQuantity: 2,
  unitCode: 'unit',
  unitPriceCents: 2500,
};

function createOrchestrator(): {
  orchestrator: CopiOrchestratorService;
  queriedTables: string[];
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

  const tasksService = {
    listTasks: vi.fn(async () => [
      {
        assignedToUserId: null,
        contactId: null,
        conversationId: null,
        createdByUserId: null,
        description: null,
        dueAt: '2026-06-05T18:00:00.000Z',
        id: 'task-1',
        priority: 'normal',
        status: 'pending',
        taskType: 'follow_up',
        title: 'Follow up with Ana Customer',
      },
    ]),
  } as unknown as TasksService;

  const policyService = new CopiPolicyService(supabaseService);
  vi.spyOn(policyService, 'loadFeatureFlags').mockResolvedValue({
    copi_basic_reports: true,
    copi_custom_reports: false,
    copi_enabled: true,
    copi_freeform_questions: false,
    copi_pro_agent: false,
    copi_vision: false,
    copi_voice: false,
  });

  const sessionService = {
    appendMessage: vi.fn(async () => undefined),
    ensureSession: vi.fn(async () => 'session-1'),
  } as unknown as CopiSessionService;

  const actionService = {
    proposeAction: vi.fn(async () => null),
  } as unknown as CopiActionService;

  const toolRegistry = new CopiToolRegistry(supabaseService, inventoryService, tasksService);
  const toolSelectorService = new CopiLlmToolSelectorService();
  const phraserService = new CopiLlmPhraserService(policyService);

  return {
    orchestrator: new CopiOrchestratorService(
      supabaseService,
      policyService,
      toolRegistry,
      toolSelectorService,
      phraserService,
      sessionService,
      actionService,
    ),
    queriedTables,
  };
}

function createQuery(table: string): Record<string, unknown> {
  const query = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    insert: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => {
      if (table === 'organization_members') {
        return { data: { role: 'owner' }, error: null };
      }

      if (table === 'business_centers') {
        return { data: { id: 'business-center-1', timezone: 'America/Argentina/Buenos_Aires' }, error: null };
      }

      if (table === 'organizations') {
        return { data: { feature_flags: {} }, error: null };
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

      if (table === 'inventory_movements') {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }

      if (table === 'conversations') {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }

      return Promise.resolve({ count: 0, data: [], error: null }).then(resolve);
    },
  };

  return query;
}

describe('CopiOrchestratorService', () => {
  it('answers attention queries with tenant membership validation', async () => {
    const { orchestrator, queriedTables } = createOrchestrator();

    await expect(
      orchestrator.answerQuestion({
        authorizationHeader: 'Bearer test-token',
        organizationId: 'organization-1',
        question: 'What needs my attention?',
        now: new Date('2026-06-05T19:00:00.000Z'),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('Mensajes de hoy'),
        policyDecision: 'allowed',
        sessionId: 'session-1',
        tools: ['attention_summary'],
      }),
    );

    expect(queriedTables).toContain('organization_members');
  });

  it('routes low-stock questions to the matching tools', async () => {
    const { orchestrator } = createOrchestrator();

    await expect(
      orchestrator.answerQuestion({
        authorizationHeader: 'Bearer test-token',
        organizationId: 'organization-1',
        question: 'Show low stock',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('stock bajo'),
        tools: expect.arrayContaining(['low_stock']),
      }),
    );
  });
});
