import { Injectable } from '@nestjs/common';

import { TasksService } from '../tasks/tasks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionProposal, CopiActionType, CopiQueryContext } from './copi.types';
import { detectProActionIntent, normalizeCopiQuestion } from './copi-intent-router';
import {
  buildCreateTaskPayload,
  readTaskItems,
  summarizeCreateTaskPayload,
} from './copi-task-parse';

const DEFAULT_TIMEZONE = 'America/Argentina/Cordoba';

@Injectable()
export class CopiActionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly tasksService: TasksService,
  ) {}

  async proposeAction(context: CopiQueryContext): Promise<CopiActionProposal | null> {
    if (!detectProActionIntent(context.question)) {
      return null;
    }

    const actionType = inferCopiActionType(context.question);
    const timezone = context.timezone || DEFAULT_TIMEZONE;
    const payload = buildActionPayload(context.question, actionType, timezone);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_action_proposals')
      .insert({
        action_type: actionType,
        business_center_id: context.businessCenterId,
        organization_id: context.organizationId,
        payload,
        session_id: context.sessionId ?? null,
        status: 'pending',
        user_id: context.userId,
      })
      .select('id, action_type, payload')
      .single<{ action_type: CopiActionType; id: string; payload: Record<string, unknown> }>();

    if (error) {
      throw new Error(`Failed to create Copi action proposal: ${error.message}`);
    }

    return {
      actionType: data.action_type,
      id: data.id,
      payload: data.payload,
      summary: summarizeProposal(data.action_type, data.payload),
    };
  }

  async confirmAction(params: {
    actionId: string;
    businessCenterId: string;
    organizationId: string;
    userId: string;
  }): Promise<{ result: Record<string, unknown>; status: 'executed' }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_action_proposals')
      .select('id, action_type, payload, status, expires_at')
      .eq('id', params.actionId)
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .single<{
        action_type: CopiActionType;
        expires_at: string;
        id: string;
        payload: Record<string, unknown>;
        status: string;
      }>();

    if (error || !data) {
      throw new Error('Copi action proposal not found');
    }

    if (data.status !== 'pending') {
      throw new Error(`Copi action is already ${data.status}`);
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      await client.from('copi_action_proposals').update({ status: 'expired' }).eq('id', data.id);
      throw new Error('Copi action proposal expired');
    }

    // Recover proposals misclassified as snooze/complete/etc. when the owner
    // clearly asked to create tasks (e.g. "mañana" falsely matching snooze).
    const { actionType, payload } = recoverCreateTaskProposal(data.action_type, data.payload);

    const result = await this.executeAction({
      actionType,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload,
      userId: params.userId,
    });

    const { error: updateError } = await client
      .from('copi_action_proposals')
      .update({
        action_type: actionType,
        executed_at: new Date().toISOString(),
        payload,
        result,
        status: 'executed',
      })
      .eq('id', data.id);

    if (updateError) {
      throw new Error(`Failed to mark Copi action as executed: ${updateError.message}`);
    }

    return { result, status: 'executed' };
  }

  private async executeAction(params: {
    actionType: CopiActionType;
    businessCenterId: string;
    organizationId: string;
    payload: Record<string, unknown>;
    userId: string;
  }): Promise<Record<string, unknown>> {
    switch (params.actionType) {
      case 'create_task': {
        const items = readTaskItems(params.payload);
        if (items.length === 0) {
          throw new Error('No se encontraron tareas para crear en la propuesta.');
        }

        const created: Array<{
          assignedToUserId: string | null;
          assigneeName: string | null;
          remindAt: string | null;
          taskId: string;
          title: string;
        }> = [];
        const baseKey = Date.now();
        const fallbackAssigneeId = readOptionalUuid(params.payload.assignedToUserId);

        for (const [index, item] of items.entries()) {
          const assignedToUserId =
            readOptionalUuid(item.assignedToUserId) ??
            (item.assigneeName
              ? await this.resolveMemberUserId(params.organizationId, item.assigneeName)
              : null) ??
            fallbackAssigneeId;

          const task = await this.tasksService.createTask({
            assignedToUserId,
            businessCenterId: params.businessCenterId,
            contactId: readOptionalUuid(params.payload.contactId),
            conversationId: readOptionalUuid(params.payload.conversationId),
            createdByUserId: params.userId,
            description: item.description,
            dueAt: item.dueAt,
            metadata: {
              ...(item.assigneeName ? { assigneeName: item.assigneeName } : {}),
              ...(item.assigneeName && !assignedToUserId
                ? {
                    assigneeUnresolved: true,
                    clarificationQuestion: `No encontré a «${item.assigneeName}» en el equipo. ¿A quién querés asignarle «${item.title}»?`,
                  }
                : item.clarificationQuestion
                  ? { clarificationQuestion: item.clarificationQuestion }
                  : {}),
              copi: true,
              ...(item.remindAt ? { remindAt: item.remindAt } : {}),
            },
            organizationId: params.organizationId,
            priority: (params.payload.priority as 'low' | 'normal' | 'high' | undefined) ?? 'normal',
            sourceKey: `copi:${params.userId}:${baseKey}:${index}`,
            taskType: 'copi',
            title: item.title,
          });
          created.push({
            assignedToUserId,
            assigneeName: item.assigneeName,
            remindAt: item.remindAt,
            taskId: task.id,
            title: task.title,
          });
        }

        return {
          assignedToUserIds: created.map((item) => item.assignedToUserId),
          assigneeNames: created.map((item) => item.assigneeName),
          taskId: created[0]?.taskId ?? null,
          taskIds: created.map((item) => item.taskId),
          titles: created.map((item) => item.title),
        };
      }
      case 'assign_task':
      case 'reassign_task': {
        const taskId = readRequiredTaskId(params.payload.taskId, 'asignar');
        const assignedToUserId = readOptionalUuid(params.payload.assignedToUserId);
        if (!assignedToUserId) {
          throw new Error('Falta el usuario al que asignar la tarea.');
        }
        const task = await this.tasksService.assignTask({
          assignedToUserId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          taskId,
        });
        return { assignedToUserId: task.assignedToUserId, taskId: task.id };
      }
      case 'complete_task': {
        const taskId = readRequiredTaskId(params.payload.taskId, 'completar');
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          completedByUserId: params.userId,
          organizationId: params.organizationId,
          status: 'completed',
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      case 'snooze_task': {
        const taskId = readRequiredTaskId(
          params.payload.taskId,
          'posponer',
          'No hay una tarea concreta para posponer. Pedile a Copi que cree o identifique la tarea primero.',
        );
        const snoozedUntil =
          typeof params.payload.snoozedUntil === 'string' && params.payload.snoozedUntil.trim()
            ? params.payload.snoozedUntil
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          snoozedUntil,
          status: 'snoozed',
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      case 'cancel_task': {
        const taskId = readRequiredTaskId(params.payload.taskId, 'cancelar');
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          status: 'cancelled',
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      default:
        throw new Error(`Unsupported Copi action: ${params.actionType}`);
    }
  }

  private async resolveMemberUserId(
    organizationId: string,
    assigneeName: string,
  ): Promise<string | null> {
    const needle = normalizePersonName(assigneeName);
    if (!needle) {
      return null;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId);

    if (error) {
      throw new Error(`Failed to resolve assignee: ${error.message}`);
    }

    for (const row of data ?? []) {
      const userId = typeof row.user_id === 'string' ? row.user_id : null;
      if (!userId) {
        continue;
      }

      const { data: userData, error: userError } = await client.auth.admin.getUserById(userId);
      if (userError || !userData.user) {
        continue;
      }

      const metadata = (userData.user.user_metadata ?? {}) as {
        full_name?: unknown;
        preferred_name?: unknown;
      };
      const candidates = [
        String(metadata.preferred_name ?? ''),
        String(metadata.full_name ?? ''),
        String(metadata.preferred_name ?? '').split(/\s+/)[0] ?? '',
        String(metadata.full_name ?? '').split(/\s+/)[0] ?? '',
      ]
        .map(normalizePersonName)
        .filter((value) => value.length > 0);

      if (candidates.some((candidate) => candidate === needle || candidate.startsWith(needle))) {
        return userId;
      }
    }

    return null;
  }
}

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function inferCopiActionType(question: string): CopiActionType {
  const normalized = normalizeCopiQuestion(question);
  const mentionsTask = /\btareas?\b/.test(normalized);
  const isCreate =
    mentionsTask &&
    /\b(crea|crear|creas|creame|necesito\s+que\s+creas?|recorda|recordar|anota|anotar)\b/.test(
      normalized,
    );

  // Creating tasks always wins — phrases like "mañana" must not become snooze.
  if (isCreate) {
    return 'create_task';
  }

  if (/\b(asign|assign|reassign|pasale)\b/.test(normalized)) {
    return /\b(reassign|pasale)\b/.test(normalized) ? 'reassign_task' : 'assign_task';
  }
  if (/\b(complet|hecha|done|marca)\b/.test(normalized) && mentionsTask) {
    return 'complete_task';
  }
  if (/\b(pospon|snooze|later|pospone|aplaza)\b/.test(normalized) && mentionsTask) {
    return 'snooze_task';
  }
  if (/\b(cancel)\b/.test(normalized) && mentionsTask) {
    return 'cancel_task';
  }
  return 'create_task';
}

function buildActionPayload(
  question: string,
  actionType: CopiActionType,
  timezone: string,
): Record<string, unknown> {
  if (actionType === 'create_task') {
    return {
      ...buildCreateTaskPayload(question, timezone),
      question,
      timezone,
    };
  }

  return {
    question,
    taskId: null,
    timezone,
  };
}

/**
 * Rewrites misclassified snooze/complete/cancel proposals back to create_task
 * when the stored question clearly asks to create tasks.
 *
 * Handles payloads that only have `description` (legacy) or `question`.
 */
export function recoverCreateTaskProposal(
  actionType: CopiActionType,
  payload: Record<string, unknown>,
): { actionType: CopiActionType; payload: Record<string, unknown> } {
  if (actionType === 'create_task') {
    // Ensure older single-title payloads still expose a question for auditing.
    if (typeof payload.question !== 'string' && typeof payload.description === 'string') {
      return {
        actionType,
        payload: { ...payload, question: payload.description },
      };
    }
    return { actionType, payload };
  }

  const question = readProposalQuestion(payload);
  if (!question) {
    return { actionType, payload };
  }

  const inferred = inferCopiActionType(question);
  const missingTaskId = !isValidUuid(payload.taskId);
  const shouldRecover =
    inferred === 'create_task' ||
    // Defensive: snooze/complete/cancel with no concrete task + create verbs in text.
    (missingTaskId &&
      /\btareas?\b/.test(normalizeCopiQuestion(question)) &&
      /\b(crea|crear|creas|creame|recorda|recordar|anota|anotar)\b/.test(
        normalizeCopiQuestion(question),
      ));

  if (!shouldRecover) {
    return { actionType, payload };
  }

  const timezone =
    typeof payload.timezone === 'string' && payload.timezone.trim()
      ? payload.timezone
      : DEFAULT_TIMEZONE;

  return {
    actionType: 'create_task',
    payload: {
      ...buildCreateTaskPayload(question, timezone),
      question,
      timezone,
    },
  };
}

function readProposalQuestion(payload: Record<string, unknown>): string {
  if (typeof payload.question === 'string' && payload.question.trim()) {
    return payload.question.trim();
  }
  if (typeof payload.description === 'string' && payload.description.trim()) {
    return payload.description.trim();
  }
  if (typeof payload.title === 'string' && payload.title.trim() && /\btareas?\b/i.test(payload.title)) {
    return payload.title.trim();
  }
  return '';
}

function readRequiredTaskId(
  value: unknown,
  verb: string,
  customMessage?: string,
): string {
  const taskId = typeof value === 'string' ? value.trim() : '';
  if (!taskId || taskId === 'null' || taskId === 'undefined' || !isValidUuid(taskId)) {
    throw new Error(customMessage ?? `Falta el ID de la tarea a ${verb}.`);
  }
  return taskId;
}

function readOptionalUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || !isValidUuid(trimmed)) {
    return null;
  }
  return trimmed;
}

function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function summarizeProposal(actionType: CopiActionType, payload: Record<string, unknown>): string {
  switch (actionType) {
    case 'create_task':
      return summarizeCreateTaskPayload(payload);
    case 'assign_task':
    case 'reassign_task':
      return 'Asignar tarea';
    case 'complete_task':
      return 'Marcar tarea como completada';
    case 'snooze_task':
      return 'Posponer tarea';
    case 'cancel_task':
      return 'Cancelar tarea';
    default:
      return 'Acción de Copi';
  }
}
