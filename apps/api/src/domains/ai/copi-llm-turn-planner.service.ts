import { Injectable, Logger } from '@nestjs/common';

import { resolveCopiModel } from './copi-model';
import type { CopiConversationTurn } from './copi-intent-router';
import type { CopiActionType, CopiToolName } from './copi.types';
import { OrganizationLlmCredentialsService } from './organization-llm-credentials.service';
import { buildCopiSystemPrompt } from './prompts/copi-prompt-composer';

export type CopiTurnPlanKind =
  | 'answer'
  | 'confirm_pending'
  | 'reject_pending'
  | 'propose_action'
  | 'revise_customer_reply'
  | 'clarify';

export type CopiTurnConfirmTarget = 'latest_pending' | 'customer_reply' | 'none';

export interface CopiTurnPlan {
  action: { payload: Record<string, unknown>; type: CopiActionType } | null;
  confirmTarget: CopiTurnConfirmTarget;
  kind: CopiTurnPlanKind;
  ownerNotes: string | null;
  toolArgs: Partial<Record<CopiToolName, Record<string, unknown>>>;
  tools: CopiToolName[];
}

const LIVE_TOOLS = new Set<CopiToolName>([
  'messages_today',
  'low_stock',
  'pending_follow_ups',
  'sales_summary',
  'sales_today',
  'sales_yesterday',
  'open_conversations',
  'pending_ai_drafts',
  'products_overview',
  'attention_summary',
  'expiring_lots',
  'tasks_overview',
  'tasks_due_today',
  'tasks_overdue',
  'tasks_by_contact',
  'my_tasks',
  'staff_roster',
  'appointments_upcoming',
  'appointments_today',
  'find_product',
  'cash_day',
  'cash_report',
  'conversation_thread',
  'list_presupuestos',
  'analyze_presupuesto',
]);

const LIVE_ACTIONS = new Set<CopiActionType>([
  'create_task',
  'create_presupuesto',
  'assign_task',
  'complete_task',
  'start_task',
  'snooze_task',
  'cancel_task',
  'reassign_task',
  'appointment_create',
  'appointment_update',
  'appointment_assign',
  'schedule_reminder',
  'navigate_to',
  'create_support_ticket',
  'save_custom_question',
  'add_stock',
  'create_product',
  'cash_ingreso',
  'cash_egreso',
  'propose_customer_reply',
  'assign_conversation_to_copi',
]);

const PLAN_KINDS = new Set<CopiTurnPlanKind>([
  'answer',
  'confirm_pending',
  'reject_pending',
  'propose_action',
  'revise_customer_reply',
  'clarify',
]);

@Injectable()
export class CopiLlmTurnPlannerService {
  private readonly logger = new Logger(CopiLlmTurnPlannerService.name);

  constructor(private readonly llmCredentials: OrganizationLlmCredentialsService) {}

  async planTurn(params: {
    history: CopiConversationTurn[];
    organizationId: string;
    pendingProposal: {
      actionType: CopiActionType;
      id: string;
      summary: string;
    } | null;
    question: string;
  }): Promise<CopiTurnPlan | null> {
    const apiKey = await this.llmCredentials.getApiKeyForOrganization(params.organizationId);
    if (!apiKey) {
      this.logger.warn('Copi turn planner skipped: no OpenAI API key.');
      return null;
    }

    const payload = {
      history: params.history.slice(-8),
      pendingProposal: params.pendingProposal,
      question: params.question,
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 700,
          messages: [
            {
              content: buildCopiSystemPrompt('planner'),
              role: 'system',
            },
            {
              content: JSON.stringify(payload),
              role: 'user',
            },
          ],
          model: resolveCopiModel('planner'),
          temperature: 0.1,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `Copi turn planner OpenAI failed (${response.status}). ${errorBody.slice(0, 400)}`,
        );
        return null;
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = body.choices?.[0]?.message?.content?.trim() ?? '';
      return parseCopiTurnPlan(raw);
    } catch (error) {
      this.logger.error(
        `Copi turn planner threw. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

export function parseCopiTurnPlan(raw: string): CopiTurnPlan | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? record.kind : '';
  if (!PLAN_KINDS.has(kind as CopiTurnPlanKind)) {
    return null;
  }

  const tools = Array.isArray(record.tools)
    ? record.tools.filter(
        (item): item is CopiToolName => typeof item === 'string' && LIVE_TOOLS.has(item as CopiToolName),
      )
    : [];

  const toolArgs: CopiTurnPlan['toolArgs'] = {};
  if (record.toolArgs && typeof record.toolArgs === 'object') {
    for (const [key, value] of Object.entries(record.toolArgs as Record<string, unknown>)) {
      if (LIVE_TOOLS.has(key as CopiToolName) && value && typeof value === 'object') {
        toolArgs[key as CopiToolName] = value as Record<string, unknown>;
      }
    }
  }

  let action: CopiTurnPlan['action'] = null;
  if (record.action && typeof record.action === 'object') {
    const actionRecord = record.action as Record<string, unknown>;
    const type = typeof actionRecord.type === 'string' ? actionRecord.type : '';
    if (LIVE_ACTIONS.has(type as CopiActionType)) {
      action = {
        payload:
          actionRecord.payload && typeof actionRecord.payload === 'object'
            ? (actionRecord.payload as Record<string, unknown>)
            : {},
        type: type as CopiActionType,
      };
    }
  }

  const confirmTargetRaw =
    typeof record.confirmTarget === 'string' ? record.confirmTarget : 'none';
  const confirmTarget: CopiTurnConfirmTarget =
    confirmTargetRaw === 'latest_pending' || confirmTargetRaw === 'customer_reply'
      ? confirmTargetRaw
      : 'none';

  const ownerNotes =
    typeof record.ownerNotes === 'string' && record.ownerNotes.trim()
      ? record.ownerNotes.trim()
      : null;

  return {
    action,
    confirmTarget,
    kind: kind as CopiTurnPlanKind,
    ownerNotes,
    toolArgs,
    tools,
  };
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}
