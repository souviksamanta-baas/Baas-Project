import { Injectable } from '@nestjs/common';

import { TasksService } from '../tasks/tasks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionProposal, CopiActionType, CopiQueryContext } from './copi.types';
import { detectProActionIntent } from './copi-intent-router';

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

    const actionType = inferActionType(context.question);
    const payload = buildActionPayload(context.question, actionType);
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

    const result = await this.executeAction({
      actionType: data.action_type,
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      payload: data.payload,
      userId: params.userId,
    });

    await client
      .from('copi_action_proposals')
      .update({
        executed_at: new Date().toISOString(),
        result,
        status: 'executed',
      })
      .eq('id', data.id);

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
        const task = await this.tasksService.createTask({
          assignedToUserId: (params.payload.assignedToUserId as string | undefined) ?? null,
          businessCenterId: params.businessCenterId,
          contactId: (params.payload.contactId as string | undefined) ?? null,
          conversationId: (params.payload.conversationId as string | undefined) ?? null,
          createdByUserId: params.userId,
          description: (params.payload.description as string | undefined) ?? null,
          dueAt: (params.payload.dueAt as string | undefined) ?? null,
          metadata: { copi: true },
          organizationId: params.organizationId,
          priority: (params.payload.priority as 'low' | 'normal' | 'high' | undefined) ?? 'normal',
          sourceKey: `copi:${params.userId}:${Date.now()}`,
          taskType: 'copi',
          title: String(params.payload.title ?? 'Tarea de Copi'),
        });
        return { taskId: task.id, title: task.title };
      }
      case 'assign_task':
      case 'reassign_task': {
        const task = await this.tasksService.assignTask({
          assignedToUserId: String(params.payload.assignedToUserId),
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          taskId: String(params.payload.taskId),
        });
        return { assignedToUserId: task.assignedToUserId, taskId: task.id };
      }
      case 'complete_task': {
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          completedByUserId: params.userId,
          organizationId: params.organizationId,
          status: 'completed',
          taskId: String(params.payload.taskId),
        });
        return { status: task.status, taskId: task.id };
      }
      case 'snooze_task': {
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          snoozedUntil: String(params.payload.snoozedUntil),
          status: 'snoozed',
          taskId: String(params.payload.taskId),
        });
        return { status: task.status, taskId: task.id };
      }
      case 'cancel_task': {
        const task = await this.tasksService.updateTaskStatus({
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          status: 'cancelled',
          taskId: String(params.payload.taskId),
        });
        return { status: task.status, taskId: task.id };
      }
      default:
        throw new Error(`Unsupported Copi action: ${params.actionType}`);
    }
  }
}

function inferActionType(question: string): CopiActionType {
  const normalized = question.toLocaleLowerCase();
  if (/\b(asign|assign|reassign|pásale|pasale)\b/.test(normalized)) {
    return /\b(reassign|pásale|pasale)\b/.test(normalized) ? 'reassign_task' : 'assign_task';
  }
  if (/\b(complet|hecha|done|marcá|marca)\b/.test(normalized)) {
    return 'complete_task';
  }
  if (/\b(pospon|snooze|mañana|later)\b/.test(normalized)) {
    return 'snooze_task';
  }
  if (/\b(cancel)\b/.test(normalized)) {
    return 'cancel_task';
  }
  return 'create_task';
}

function buildActionPayload(question: string, actionType: CopiActionType): Record<string, unknown> {
  if (actionType === 'create_task') {
    return {
      description: question,
      dueAt: inferDueDate(question),
      title: inferTaskTitle(question),
    };
  }

  return {
    question,
    taskId: null,
  };
}

function inferTaskTitle(question: string): string {
  const cleaned = question.replace(/^(crea|crear|creá|recordá|recordar)\s+(una\s+)?tarea\s+(para\s+)?/i, '').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'Tarea de Copi';
}

function inferDueDate(question: string): string | null {
  if (/\bmañana\b/i.test(question)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }

  return null;
}

function summarizeProposal(actionType: CopiActionType, payload: Record<string, unknown>): string {
  switch (actionType) {
    case 'create_task':
      return `Crear tarea: ${String(payload.title ?? 'Sin título')}`;
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
