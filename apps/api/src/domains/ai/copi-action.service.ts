import { Injectable, Optional } from '@nestjs/common';

import { AppointmentsService } from '../appointments/appointments.service';
import { CashService } from '../cash/cash.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { WhatsAppOutboundMessageService } from '../whatsapp/whatsapp-outbound-message.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionProposal, CopiActionType, CopiQueryContext } from './copi.types';
import {
  COPI_DEFAULT_PRODUCT_REORDER,
  COPI_SUPPORT_TICKET_SUBJECT,
  defaultTomorrowNineAmIso,
  softDefaultAssumptionsLine,
  todayYmd,
  truncateLabel,
} from './copi-defaults';
import {
  detectProActionIntent,
  mentionsAppointmentIntent,
  normalizeCopiQuestion,
} from './copi-intent-router';
import { SalesAiService } from './sales-ai.service';
import {
  buildCreateAppointmentPayload,
  buildCreateTaskPayload,
  parseCreatePresupuestoRequest,
  parseCreateTaskItems,
  readTaskItems,
  summarizeCreateAppointmentPayload,
  summarizeCreateTaskPayload,
  wantsCreatePresupuestoAction,
} from './copi-task-parse';

const DEFAULT_TIMEZONE = 'America/Argentina/Cordoba';

@Injectable()
export class CopiActionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly tasksService: TasksService,
    private readonly appointmentsService: AppointmentsService,
    private readonly inventoryService: InventoryService,
    private readonly cashService: CashService,
    private readonly whatsAppOutbound: WhatsAppOutboundMessageService,
    private readonly salesAiService: SalesAiService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async proposeAction(context: CopiQueryContext): Promise<CopiActionProposal | null> {
    if (!detectProActionIntent(context.question)) {
      return null;
    }

    const actionType = inferCopiActionType(context.question);
    const timezone = context.timezone || DEFAULT_TIMEZONE;
    let payload = buildActionPayload(context.question, actionType, timezone);
    if (actionType === 'add_stock') {
      payload = await this.enrichAddStockPayload(context, payload);
    }
    if (actionType === 'propose_customer_reply') {
      payload = await this.enrichCustomerReplyPayload(context, payload);
    }
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

    const proposal: CopiActionProposal = {
      actionType: data.action_type,
      id: data.id,
      payload: data.payload,
      summary: summarizeProposal(data.action_type, data.payload),
    };

    // Do not push "Copi necesita confirmación" immediately — chat already shows
    // the confirm card. A reminder is emitted after 5 minutes only if still pending
    // (see NotificationsService.notifyStaleCopiActionProposals).

    return proposal;
  }

  async updateProposalPayload(params: {
    actionId: string;
    organizationId: string;
    payload: Record<string, unknown>;
    userId: string;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client
      .from('copi_action_proposals')
      .update({ payload: params.payload })
      .eq('id', params.actionId)
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to update Copi action proposal: ${error.message}`);
    }
  }

  async findLatestPendingProposal(params: {
    businessCenterId: string;
    organizationId: string;
    sessionId?: string | null;
    userId: string;
  }): Promise<{ actionType: CopiActionType; id: string } | null> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('copi_action_proposals')
      .select('id, action_type, expires_at')
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('user_id', params.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (params.sessionId) {
      query = query.eq('session_id', params.sessionId);
    }

    const { data, error } = await query.maybeSingle<{
      action_type: CopiActionType;
      expires_at: string;
      id: string;
    }>();

    if (error || !data) {
      return null;
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      await client.from('copi_action_proposals').update({ status: 'expired' }).eq('id', data.id);
      return null;
    }

    return { actionType: data.action_type, id: data.id };
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

    if (this.notificationsService) {
      await this.notificationsService.dismissCopiActionNeeded(data.id);
    }

    return { result, status: 'executed' };
  }

  async rejectAction(params: {
    actionId: string;
    businessCenterId: string;
    organizationId: string;
    userId: string;
  }): Promise<{ status: 'rejected' }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_action_proposals')
      .select('id, status, expires_at')
      .eq('id', params.actionId)
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .single<{ expires_at: string; id: string; status: string }>();

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

    const { error: updateError } = await client
      .from('copi_action_proposals')
      .update({
        result: { rejected: true },
        status: 'rejected',
      })
      .eq('id', data.id);

    if (updateError) {
      throw new Error(`Failed to reject Copi action: ${updateError.message}`);
    }

    if (this.notificationsService) {
      await this.notificationsService.dismissCopiActionNeeded(data.id);
    }

    return { status: 'rejected' };
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
          const resolvedAssigneeId =
            readOptionalUuid(item.assignedToUserId) ??
            (item.assigneeName
              ? await this.resolveMemberUserId(params.organizationId, item.assigneeName)
              : null) ??
            fallbackAssigneeId;

          // KAN-401 mandatory fields: always resolve to an assignee (fallback: creator).
          const assignedToUserId = resolvedAssigneeId ?? params.userId;
          const assigneeFellBackToCreator = Boolean(
            !resolvedAssigneeId && assignedToUserId === params.userId,
          );

          // dueAt is mandatory server-side; default to +24h when Copi could not infer one.
          const dueAt =
            item.dueAt && item.dueAt.trim().length > 0
              ? item.dueAt
              : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const description =
            item.description && item.description.trim().length > 0
              ? item.description
              : item.title;

          // If remind_at already passed but due is still ahead, drop explicit remind so the
          // scheduler can use due−lead (avoids silent miss when task is created mid-window).
          let remindAt = item.remindAt ?? null;
          const nowMs = Date.now();
          const dueMs = new Date(dueAt).getTime();
          if (remindAt) {
            const remindMs = new Date(remindAt).getTime();
            if (Number.isFinite(remindMs) && remindMs < nowMs && dueMs > nowMs) {
              remindAt = null;
            }
          }

          const recurrenceFreq =
            (item as { recurrenceFreq?: 'daily' | 'weekly' | 'monthly' | null }).recurrenceFreq ??
            (params.payload.recurrenceFreq as 'daily' | 'weekly' | 'monthly' | null | undefined) ??
            null;
          const recurrenceWeekday =
            (item as { recurrenceWeekday?: number | null }).recurrenceWeekday ??
            (typeof params.payload.recurrenceWeekday === 'number'
              ? params.payload.recurrenceWeekday
              : null);
          const templateKey =
            typeof params.payload.templateKey === 'string' && params.payload.templateKey.trim()
              ? params.payload.templateKey.trim()
              : null;

          const task = await this.tasksService.createTask({
            assignedToUserId,
            businessCenterId: params.businessCenterId,
            contactId: readOptionalUuid(params.payload.contactId),
            conversationId: readOptionalUuid(params.payload.conversationId),
            createdByUserId: params.userId,
            description,
            dueAt,
            metadata: {
              ...(item.assigneeName ? { assigneeName: item.assigneeName } : {}),
              ...(assigneeFellBackToCreator && item.assigneeName
                ? {
                    assigneeFellBackToCreator: true,
                    clarificationQuestion: `No encontré a «${item.assigneeName}» en el equipo. Asigné «${item.title}» a vos.`,
                  }
                : item.clarificationQuestion
                  ? { clarificationQuestion: item.clarificationQuestion }
                  : {}),
              copi: true,
            },
            organizationId: params.organizationId,
            priority: (params.payload.priority as 'low' | 'normal' | 'high' | undefined) ?? 'normal',
            recurrenceFreq,
            recurrenceWeekday,
            remindAt,
            sourceKey: `copi:${params.userId}:${baseKey}:${index}`,
            taskType: 'copi',
            templateKey,
            title: item.title,
          });
          created.push({
            assignedToUserId,
            assigneeName: item.assigneeName,
            remindAt,
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
      case 'create_presupuesto': {
        const clientLabel =
          typeof params.payload.clientLabel === 'string' && params.payload.clientLabel.trim()
            ? params.payload.clientLabel.trim()
            : 'Estandar';
        const assigneeName =
          typeof params.payload.assigneeName === 'string' && params.payload.assigneeName.trim()
            ? params.payload.assigneeName.trim()
            : null;
        const title =
          typeof params.payload.title === 'string' && params.payload.title.trim()
            ? params.payload.title.trim()
            : `Presupuesto para ${clientLabel}`;
        const description =
          typeof params.payload.description === 'string' && params.payload.description.trim()
            ? params.payload.description.trim()
            : title;

        const quoteId = `PRES-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date().toISOString();
        const cart = await this.buildPresupuestoCart(
          params.organizationId,
          params.payload.lines,
        );
        const unresolvedProducts = cart
          .filter((line) => line.unresolved)
          .map((line) => line.productQuery);
        const draft = {
          cart: cart
            .filter((line) => !line.unresolved)
            .map((line) => ({
              id: line.id,
              name: line.name,
              productId: line.productId,
              quantity: line.quantity,
              soldByWeight: line.soldByWeight,
              unitPriceCents: line.unitPriceCents,
              weightGramsInput: line.weightGramsInput,
            })),
          clientLabel,
          discountMode: 'amount' as const,
          discountValue: 0,
          paymentMethod: 'efectivo' as const,
          receiptLabel: 'Estandar',
        };

        const client = this.supabaseService.getServiceRoleClient();
        const { error: quoteError } = await client.from('sell_quotes').insert({
          business_center_id: params.businessCenterId,
          created_at: now,
          created_by: params.userId,
          draft,
          id: quoteId,
          organization_id: params.organizationId,
          status: 'guardado',
          updated_at: now,
        });

        if (quoteError) {
          throw new Error(`No se pudo crear el presupuesto: ${quoteError.message}`);
        }

        const resolvedAssigneeId = assigneeName
          ? await this.resolveMemberUserId(params.organizationId, assigneeName)
          : null;
        const assignedToUserId = resolvedAssigneeId ?? params.userId;
        const assigneeFellBackToCreator = Boolean(assigneeName && !resolvedAssigneeId);

        const shortProduct = draft.cart[0]?.name
          ? draft.cart[0].name
              .replace(/\b(natural|crudo|cruda|granel|premium|extra|organico|orgánico)\b/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .split(/\s+/)
              .slice(0, 4)
              .join(' ')
          : null;
        const taskTitle = (shortProduct
          ? `Presupuesto · ${shortProduct}`
          : `Presupuesto ${quoteId}`
        ).slice(0, 48);
        const cartSummary = draft.cart
          .map((line) => {
            if (line.soldByWeight && line.weightGramsInput) {
              return `${line.weightGramsInput} g ${line.name}`;
            }
            return `${line.quantity}× ${line.name}`;
          })
          .join(', ');
        const taskDescription =
          cartSummary ||
          cleanPresupuestoTaskDescription(description) ||
          'Seguimiento del presupuesto';
        const task = await this.tasksService.createTask({
          assignedToUserId,
          businessCenterId: params.businessCenterId,
          createdByUserId: params.userId,
          description: taskDescription,
          metadata: {
            ...(assigneeName ? { assigneeName } : {}),
            ...(assigneeFellBackToCreator
              ? {
                  assigneeFellBackToCreator: true,
                  clarificationQuestion: `No encontré a «${assigneeName}» en el equipo. Asigné la tarea a vos.`,
                }
              : {}),
            copi: true,
            presupuestoId: quoteId,
          },
          organizationId: params.organizationId,
          priority: 'normal',
          sourceKey: `copi-presupuesto:${params.userId}:${quoteId}`,
          taskType: 'copi',
          title: taskTitle,
        });

        return {
          assignedToUserId,
          assigneeFellBackToCreator,
          assigneeName,
          clientLabel,
          productCount: draft.cart.length,
          quoteId,
          taskId: task.id,
          taskTitle: task.title,
          title,
          unresolvedProducts,
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
          actorUserId: params.userId,
          businessCenterId: params.businessCenterId,
          completedByUserId: params.userId,
          organizationId: params.organizationId,
          status: 'completed',
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      case 'start_task': {
        const taskId = readRequiredTaskId(params.payload.taskId, 'iniciar');
        const task = await this.tasksService.startTask({
          actorUserId: params.userId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      // KAN-401: snooze_task now maps to status='postponed' (posponer hasta).
      case 'snooze_task': {
        const taskId = readRequiredTaskId(
          params.payload.taskId,
          'posponer',
          'No hay una tarea concreta para posponer. Pedile a Copi que cree o identifique la tarea primero.',
        );
        const postponedUntil =
          (typeof params.payload.postponedUntil === 'string' && params.payload.postponedUntil.trim()
            ? params.payload.postponedUntil
            : null) ??
          (typeof params.payload.snoozedUntil === 'string' && params.payload.snoozedUntil.trim()
            ? params.payload.snoozedUntil
            : null) ??
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const task = await this.tasksService.postponeTask({
          actorUserId: params.userId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          postponedUntil,
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      case 'cancel_task': {
        const taskId = readRequiredTaskId(params.payload.taskId, 'cancelar');
        const task = await this.tasksService.updateTaskStatus({
          actorUserId: params.userId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
          status: 'cancelled',
          taskId,
        });
        return { status: task.status, taskId: task.id };
      }
      case 'appointment_create': {
        await this.assertAppointmentsEnabled(params.organizationId);
        const title =
          typeof params.payload.title === 'string' && params.payload.title.trim()
            ? params.payload.title.trim()
            : 'Nuevo turno';
        const startsAt =
          typeof params.payload.startsAt === 'string' && params.payload.startsAt.trim()
            ? readRequiredIsoDate(params.payload.startsAt, 'agendar')
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const endsAt =
          typeof params.payload.endsAt === 'string' && params.payload.endsAt.trim()
            ? params.payload.endsAt
            : new Date(new Date(startsAt).getTime() + 30 * 60 * 1000).toISOString();
        const attendeeEmail =
          typeof params.payload.attendeeEmail === 'string' &&
          params.payload.attendeeEmail.trim()
            ? params.payload.attendeeEmail.trim().toLowerCase()
            : null;
        const attendeePhone =
          typeof params.payload.attendeePhone === 'string' &&
          params.payload.attendeePhone.trim()
            ? params.payload.attendeePhone.trim()
            : null;
        if (!attendeeEmail && !attendeePhone) {
          throw new Error(
            'Falta el correo o teléfono de la persona (Para) para enviar la invitación del turno.',
          );
        }
        const notes =
          typeof params.payload.notes === 'string' ? params.payload.notes : null;
        const fromLabel = await this.resolveUserDisplayName(params.userId);
        let assignedToUserId = readOptionalUuid(params.payload.assignedToUserId);
        if (
          !assignedToUserId &&
          typeof params.payload.assigneeName === 'string' &&
          params.payload.assigneeName.trim()
        ) {
          assignedToUserId = await this.resolveMemberUserId(
            params.organizationId,
            params.payload.assigneeName,
          );
        }
        const appointment = await this.appointmentsService.createAppointment({
          assignedToUserId,
          businessCenterId: params.businessCenterId,
          contactId: readOptionalUuid(params.payload.contactId),
          createdByUserId: params.userId,
          endsAt,
          metadata: {
            attendeeEmail,
            attendeePhone,
            fromLabel,
          },
          notes,
          organizationId: params.organizationId,
          remindAt:
            typeof params.payload.remindAt === 'string' && params.payload.remindAt.trim()
              ? params.payload.remindAt
              : null,
          startsAt,
          title,
        });

        let inviteEmailSent = false;
        if (attendeeEmail) {
          try {
            await this.appointmentsService.sendInviteEmail({
              endsAt: appointment.endsAt,
              fromLabel,
              notes: appointment.notes,
              startsAt: appointment.startsAt,
              title: appointment.title,
              toEmail: attendeeEmail,
            });
            inviteEmailSent = true;
          } catch (error) {
            // Appointment is already created; surface invite failure in the result.
            return {
              appointmentId: appointment.id,
              attendeeEmail,
              attendeePhone,
              endsAt: appointment.endsAt,
              inviteEmailError:
                error instanceof Error ? error.message : 'No se pudo enviar la invitación.',
              inviteEmailSent: false,
              startsAt: appointment.startsAt,
              title: appointment.title,
            };
          }
        }

        return {
          appointmentId: appointment.id,
          attendeeEmail,
          attendeePhone,
          endsAt: appointment.endsAt,
          inviteEmailSent,
          startsAt: appointment.startsAt,
          title: appointment.title,
        };
      }
      case 'appointment_update': {
        await this.assertAppointmentsEnabled(params.organizationId);
        const appointmentId = readRequiredUuid(params.payload.appointmentId, 'actualizar turno');
        const appointment = await this.appointmentsService.updateAppointment({
          appointmentId,
          businessCenterId: params.businessCenterId,
          endsAt:
            typeof params.payload.endsAt === 'string' ? params.payload.endsAt : undefined,
          notes:
            typeof params.payload.notes === 'string' ? params.payload.notes : undefined,
          organizationId: params.organizationId,
          startsAt:
            typeof params.payload.startsAt === 'string' ? params.payload.startsAt : undefined,
          status:
            params.payload.status === 'scheduled' ||
            params.payload.status === 'completed' ||
            params.payload.status === 'cancelled'
              ? params.payload.status
              : undefined,
          title:
            typeof params.payload.title === 'string' ? params.payload.title : undefined,
        });
        return { appointmentId: appointment.id, status: appointment.status };
      }
      case 'appointment_assign': {
        await this.assertAppointmentsEnabled(params.organizationId);
        const appointmentId = readRequiredUuid(
          params.payload.appointmentId,
          'asignar el turno',
          'Falta el turno a asignar. Indicá cuál turno querés reasignar (o pedime crear uno nuevo).',
        );
        const assignedToUserId = readOptionalUuid(params.payload.assignedToUserId);
        if (!assignedToUserId) {
          throw new Error('Falta el usuario al que asignar el turno.');
        }
        const appointment = await this.appointmentsService.assignAppointment({
          appointmentId,
          assignedToUserId,
          businessCenterId: params.businessCenterId,
          organizationId: params.organizationId,
        });
        return {
          appointmentId: appointment.id,
          assignedToUserId: appointment.assignedToUserId,
        };
      }
      case 'schedule_reminder': {
        const title =
          typeof params.payload.title === 'string' && params.payload.title.trim()
            ? params.payload.title.trim()
            : 'Recordatorio';
        const remindAt =
          typeof params.payload.remindAt === 'string' && params.payload.remindAt.trim()
            ? params.payload.remindAt
            : defaultTomorrowNineAmIso(new Date());
        const recurrenceFreq =
          (params.payload.recurrenceFreq as 'daily' | 'weekly' | 'monthly' | null | undefined) ??
          null;
        const recurrenceWeekday =
          typeof params.payload.recurrenceWeekday === 'number'
            ? params.payload.recurrenceWeekday
            : null;
        const task = await this.tasksService.createTask({
          assignedToUserId: params.userId,
          businessCenterId: params.businessCenterId,
          createdByUserId: params.userId,
          description:
            typeof params.payload.description === 'string'
              ? params.payload.description
              : title,
          dueAt: remindAt,
          metadata: { copi: true, reminder: true },
          organizationId: params.organizationId,
          priority: 'normal',
          recurrenceFreq,
          recurrenceWeekday,
          remindAt,
          sourceKey: `copi:reminder:${params.userId}:${Date.now()}`,
          taskType: 'callback',
          title,
        });
        return { remindAt, taskId: task.id, title: task.title };
      }
      case 'navigate_to': {
        const route =
          typeof params.payload.route === 'string' && params.payload.route.trim()
            ? params.payload.route.trim()
            : '/(app)';
        const routeParams =
          params.payload.params && typeof params.payload.params === 'object'
            ? (params.payload.params as Record<string, unknown>)
            : {};
        return { navigate: true, params: routeParams, route };
      }
      case 'create_support_ticket': {
        const subject =
          typeof params.payload.subject === 'string' && params.payload.subject.trim()
            ? params.payload.subject.trim()
            : COPI_SUPPORT_TICKET_SUBJECT;
        const body =
          typeof params.payload.body === 'string' && params.payload.body.trim()
            ? params.payload.body.trim()
            : typeof params.payload.question === 'string'
              ? params.payload.question
              : subject;
        const client = this.supabaseService.getServiceRoleClient();
        const { data, error } = await client
          .from('copi_support_tickets')
          .insert({
            body,
            business_center_id: params.businessCenterId,
            metadata: { copi: true },
            organization_id: params.organizationId,
            session_id: readOptionalUuid(params.payload.sessionId),
            severity:
              typeof params.payload.severity === 'string' ? params.payload.severity : 'normal',
            subject,
            user_id: params.userId,
          })
          .select('id')
          .single<{ id: string }>();
        if (error || !data) {
          throw new Error(error?.message ?? 'No se pudo crear el ticket de soporte.');
        }
        return { subject, ticketId: data.id };
      }
      case 'save_custom_question': {
        const question =
          typeof params.payload.question === 'string' && params.payload.question.trim()
            ? params.payload.question.trim()
            : '';
        if (!question) {
          throw new Error('Falta la pregunta a guardar.');
        }
        const label =
          typeof params.payload.label === 'string' && params.payload.label.trim()
            ? params.payload.label.trim()
            : truncateLabel(question);
        const client = this.supabaseService.getServiceRoleClient();
        const { data, error } = await client
          .from('copi_custom_questions')
          .upsert(
            {
              business_center_id: params.businessCenterId,
              label,
              organization_id: params.organizationId,
              question,
              user_id: params.userId,
            },
            { onConflict: 'organization_id,user_id,question' },
          )
          .select('id')
          .single<{ id: string }>();
        if (error || !data) {
          throw new Error(error?.message ?? 'No se pudo guardar la pregunta.');
        }
        return { label, questionId: data.id };
      }
      case 'add_stock': {
        let productId = readOptionalUuid(params.payload.productId);
        const productQuery =
          typeof params.payload.productQuery === 'string'
            ? params.payload.productQuery.trim()
            : '';
        if (!productId && productQuery) {
          const resolved = await this.resolveProductByName(
            params.organizationId,
            productQuery,
          );
          productId = resolved?.id ?? null;
        }
        if (!productId) {
          const lookedUp = productQuery
            ? await this.inventoryService.lookupProducts({
                businessCenterId: params.businessCenterId,
                limit: 1,
                organizationId: params.organizationId,
                query: productQuery,
              })
            : [];
          productId = lookedUp[0]?.id ?? null;
        }
        if (!productId) {
          throw new Error(
            productQuery
              ? `No encontré el producto «${productQuery}». Indicá el nombre exacto o el id.`
              : 'Falta el producto. Indicá cuál producto querés reponer.',
          );
        }
        const quantity = Number(params.payload.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new Error('Falta la cantidad a agregar.');
        }
        const result = await this.inventoryService.addStock({
          businessCenterId: params.businessCenterId,
          costCents:
            typeof params.payload.costCents === 'number' ? params.payload.costCents : null,
          createdByUserId: params.userId,
          marginPercent:
            typeof params.payload.marginPercent === 'number'
              ? params.payload.marginPercent
              : null,
          organizationId: params.organizationId,
          productId,
          quantity: Math.trunc(quantity),
          receivedAt:
            typeof params.payload.receivedAt === 'string' ? params.payload.receivedAt : null,
          unitPriceCents:
            typeof params.payload.unitPriceCents === 'number'
              ? params.payload.unitPriceCents
              : null,
        });
        return { ...result, productId } as unknown as Record<string, unknown>;
      }
      case 'create_product': {
        const name =
          typeof params.payload.name === 'string' && params.payload.name.trim()
            ? params.payload.name.trim()
            : '';
        const category =
          typeof params.payload.category === 'string' && params.payload.category.trim()
            ? params.payload.category.trim()
            : '';
        if (!name || !category) {
          throw new Error('Faltan el nombre y la categoría del producto.');
        }
        const result = await this.inventoryService.createProduct({
          businessCenterId: params.businessCenterId,
          category,
          costCents:
            typeof params.payload.costCents === 'number' ? params.payload.costCents : 0,
          marginPercent:
            typeof params.payload.marginPercent === 'number'
              ? params.payload.marginPercent
              : 0,
          name,
          organizationId: params.organizationId,
          reorderThreshold:
            typeof params.payload.reorderThreshold === 'number'
              ? params.payload.reorderThreshold
              : COPI_DEFAULT_PRODUCT_REORDER,
          stockQuantity:
            typeof params.payload.stockQuantity === 'number'
              ? params.payload.stockQuantity
              : 0,
          unitPriceCents:
            typeof params.payload.unitPriceCents === 'number'
              ? params.payload.unitPriceCents
              : 0,
        });
        return result as unknown as Record<string, unknown>;
      }
      case 'cash_ingreso':
      case 'cash_egreso': {
        const entryType = params.actionType === 'cash_ingreso' ? 'ingreso' : 'egreso';
        const amountCents = Number(params.payload.amountCents);
        const concept =
          typeof params.payload.concept === 'string' ? params.payload.concept.trim() : '';
        if (!Number.isFinite(amountCents) || amountCents < 1 || !concept) {
          throw new Error('Faltan el monto y el concepto del movimiento de caja.');
        }
        const entry = await this.cashService.createManualEntryForUser({
          amountCents: Math.round(amountCents),
          businessCenterId: params.businessCenterId,
          concept,
          entryDate:
            typeof params.payload.entryDate === 'string' && params.payload.entryDate.trim()
              ? params.payload.entryDate
              : todayYmd(new Date(), DEFAULT_TIMEZONE),
          entryType,
          organizationId: params.organizationId,
          userId: params.userId,
        });
        return { entryId: entry.id, entryType: entry.entryType };
      }
      case 'propose_customer_reply': {
        let conversationId = readOptionalUuid(params.payload.conversationId);
        if (!conversationId) {
          const client = this.supabaseService.getServiceRoleClient();
          const { data: assigned } = await client
            .from('conversations')
            .select('id')
            .eq('organization_id', params.organizationId)
            .eq('assigned_to_copi_user_id', params.userId)
            .not('assigned_to_copi_at', 'is', null)
            .order('assigned_to_copi_at', { ascending: false })
            .limit(1)
            .maybeSingle<{ id: string }>();
          conversationId = assigned?.id ?? null;
        }
        if (!conversationId) {
          throw new Error(
            'Falta la conversación. Asigná un chat a Copi primero o indicá el id del chat.',
          );
        }
        const body =
          typeof params.payload.body === 'string' ? params.payload.body.trim() : '';
        const replyBody =
          body ||
          (await this.draftCustomerReplyBody({
            businessCenterId: params.businessCenterId,
            conversationId,
            organizationId: params.organizationId,
          }));
        if (!replyBody) {
          throw new Error('Falta el texto de la respuesta al cliente.');
        }
        const client = this.supabaseService.getServiceRoleClient();
        const { data: conversation, error } = await client
          .from('conversations')
          .select('id, external_contact_id, business_center_id, organization_id')
          .eq('id', conversationId)
          .eq('organization_id', params.organizationId)
          .maybeSingle<{
            business_center_id: string;
            external_contact_id: string;
            id: string;
            organization_id: string;
          }>();
        if (error || !conversation) {
          throw new Error('No se encontró la conversación.');
        }
        const sent = await this.whatsAppOutbound.sendTextMessage({
          body: replyBody,
          businessCenterId: conversation.business_center_id,
          conversationId,
          organizationId: conversation.organization_id,
          recipientPhone: conversation.external_contact_id,
        });
        return {
          body: replyBody,
          conversationId,
          externalMessageId: sent.externalMessageId,
          status: sent.status,
        };
      }
      case 'assign_conversation_to_copi': {
        const conversationId = readRequiredUuid(
          params.payload.conversationId,
          'asignar a Copi',
          'Falta el id de la conversación.',
        );
        const client = this.supabaseService.getServiceRoleClient();
        const { error } = await client
          .from('conversations')
          .update({
            assigned_to_copi_at: new Date().toISOString(),
            assigned_to_copi_user_id: params.userId,
          })
          .eq('id', conversationId)
          .eq('organization_id', params.organizationId);
        if (error) {
          throw new Error(`No se pudo asignar el chat a Copi: ${error.message}`);
        }
        return { assigned: true, conversationId };
      }
      default:
        throw new Error(`Unsupported Copi action: ${params.actionType}`);
    }
  }

  private async assertAppointmentsEnabled(organizationId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('feature_flags')
      .eq('id', organizationId)
      .single<{ feature_flags: Record<string, unknown> | null }>();

    if (error || !data) {
      throw new Error('No se pudo verificar la disponibilidad de la Agenda.');
    }

    if (!(data.feature_flags ?? {}).appointments) {
      throw new Error('La Agenda no está habilitada para esta organización.');
    }
  }

  private async resolveUserDisplayName(userId: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return null;
    }
    const metadata = (data.user.user_metadata ?? {}) as {
      full_name?: unknown;
      preferred_name?: unknown;
    };
    const preferred =
      typeof metadata.preferred_name === 'string' ? metadata.preferred_name.trim() : '';
    const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
    return preferred || fullName || data.user.email || null;
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

  private async buildPresupuestoCart(
    organizationId: string,
    rawLines: unknown,
  ): Promise<
    Array<{
      id: string;
      name: string;
      productId: string;
      productQuery: string;
      quantity: number;
      soldByWeight: boolean;
      unitPriceCents: number;
      unresolved: boolean;
      weightGramsInput: string | null;
    }>
  > {
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return [];
    }

    const cart: Array<{
      id: string;
      name: string;
      productId: string;
      productQuery: string;
      quantity: number;
      soldByWeight: boolean;
      unitPriceCents: number;
      unresolved: boolean;
      weightGramsInput: string | null;
    }> = [];

    for (const [index, raw] of rawLines.entries()) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const line = raw as Record<string, unknown>;
      const productQuery = String(line.productQuery ?? '').trim();
      if (!productQuery) {
        continue;
      }

      const grams =
        typeof line.grams === 'number' && Number.isFinite(line.grams) ? line.grams : null;
      const quantity =
        typeof line.quantity === 'number' && Number.isFinite(line.quantity) ? line.quantity : null;

      const product = await this.resolveProductByName(organizationId, productQuery);
      if (!product) {
        cart.push({
          id: `unresolved-${index}`,
          name: productQuery,
          productId: '',
          productQuery,
          quantity: quantity ?? 1,
          soldByWeight: grams != null,
          unitPriceCents: 0,
          unresolved: true,
          weightGramsInput: grams != null ? String(Math.round(grams)) : null,
        });
        continue;
      }

      const soldByWeight = product.soldByWeight || grams != null;
      cart.push({
        id: `${product.id}-${Date.now()}-${index}`,
        name: product.name,
        productId: product.id,
        productQuery,
        quantity: soldByWeight ? 1 : Math.max(1, Math.round(quantity ?? 1)),
        soldByWeight,
        unitPriceCents: product.unitPriceCents,
        unresolved: false,
        weightGramsInput: soldByWeight
          ? String(Math.round(grams ?? (quantity != null && quantity < 20 ? quantity * 1000 : 1000)))
          : null,
      });
    }

    return cart;
  }

  private async enrichAddStockPayload(
    context: CopiQueryContext,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const productId = readOptionalUuid(payload.productId);
    if (productId) {
      return payload;
    }
    const productQuery =
      typeof payload.productQuery === 'string' ? payload.productQuery.trim() : '';
    if (!productQuery) {
      return payload;
    }
    const resolved = await this.resolveProductByName(context.organizationId, productQuery);
    if (resolved) {
      return {
        ...payload,
        productId: resolved.id,
        productName: resolved.name,
        productQuery,
      };
    }
    const lookedUp = await this.inventoryService.lookupProducts({
      businessCenterId: context.businessCenterId,
      limit: 1,
      organizationId: context.organizationId,
      query: productQuery,
    });
    if (lookedUp[0]) {
      return {
        ...payload,
        productId: lookedUp[0].id,
        productName: lookedUp[0].name,
        productQuery,
      };
    }
    return payload;
  }

  private async enrichCustomerReplyPayload(
    context: CopiQueryContext,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const existing =
      typeof payload.body === 'string' && payload.body.trim() ? payload.body.trim() : '';
    let conversationId = readOptionalUuid(payload.conversationId);
    if (!conversationId) {
      const client = this.supabaseService.getServiceRoleClient();
      const { data: assigned } = await client
        .from('conversations')
        .select('id')
        .eq('organization_id', context.organizationId)
        .eq('assigned_to_copi_user_id', context.userId)
        .not('assigned_to_copi_at', 'is', null)
        .order('assigned_to_copi_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      conversationId = assigned?.id ?? null;
    }
    if (!conversationId) {
      return payload;
    }
    const body =
      existing ||
      null;
    return {
      ...payload,
      body,
      conversationId,
    };
  }

  /** Last-resort body if a proposal was confirmed without text (LLM path should usually fill it). */
  private async draftCustomerReplyBody(params: {
    businessCenterId: string;
    conversationId: string;
    organizationId: string;
  }): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const { data: sameDayRows } = await client
      .from('conversation_messages')
      .select('body, direction, created_at')
      .eq('organization_id', params.organizationId)
      .eq('conversation_id', params.conversationId)
      .gte('created_at', dayStart.toISOString())
      .order('created_at', { ascending: true })
      .limit(40);

    const rows =
      sameDayRows && sameDayRows.length > 0
        ? sameDayRows
        : (
            await client
              .from('conversation_messages')
              .select('body, direction, created_at')
              .eq('organization_id', params.organizationId)
              .eq('conversation_id', params.conversationId)
              .order('created_at', { ascending: false })
              .limit(12)
          ).data?.slice().reverse() ?? [];

    const lastInbound = [...rows]
      .reverse()
      .find((row) => row.direction === 'inbound' && String(row.body ?? '').trim());
    const messageBody = String(lastInbound?.body ?? '').trim();
    if (!messageBody) {
      return null;
    }

    try {
      const draft = await this.salesAiService.generateDraft({
        businessCenterId: params.businessCenterId,
        messageBody,
        organizationId: params.organizationId,
      });
      const matched = draft.catalogContext?.matchedProducts ?? [];
      if (matched.length > 0) {
        return formatStockFactsReply(matched);
      }
      const drafted = typeof draft.body === 'string' ? draft.body.trim() : '';
      if (drafted && !looksLikeEnglishCustomerReply(drafted)) {
        return drafted;
      }
    } catch {
      // Fall through to inventory lookup.
    }

    const productQuery = extractCustomerProductQuery(messageBody);
    if (productQuery) {
      try {
        const lookedUp = await this.inventoryService.lookupProducts({
          businessCenterId: params.businessCenterId,
          limit: 8,
          organizationId: params.organizationId,
          query: productQuery,
        });
        if (lookedUp.length > 0) {
          return formatStockFactsReply(
            lookedUp.map((product) => ({
              name: product.name,
              stockQuantity: product.stockQuantity,
              unitPriceCents: product.unitPriceCents,
            })),
          );
        }
      } catch {
        // Fall through.
      }
    }

    return '¡Hola! Gracias por tu mensaje. Enseguida te paso la información que pediste.';
  }

  private async resolveProductByName(
    organizationId: string,
    productQuery: string,
  ): Promise<{ id: string; name: string; soldByWeight: boolean; unitPriceCents: number } | null> {
    const needle = normalizePersonName(productQuery);
    if (!needle) {
      return null;
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('products')
      .select(
        'id, name, unit_price_cents, base_unit_code, pricing_unit_code, parent_product_id, is_active',
      )
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(200);

    if (error) {
      throw new Error(`Failed to resolve product: ${error.message}`);
    }

    let best: {
      id: string;
      name: string;
      soldByWeight: boolean;
      unitPriceCents: number;
      score: number;
    } | null = null;

    for (const row of data ?? []) {
      const name = String(row.name ?? '').trim();
      const normalizedName = normalizePersonName(name);
      if (!normalizedName) {
        continue;
      }

      let score = 0;
      if (normalizedName === needle) {
        score = 100;
      } else if (normalizedName.includes(needle) || needle.includes(normalizedName)) {
        score = 80;
      } else {
        const tokens = needle.split(/\s+/).filter((token) => token.length > 2);
        const hits = tokens.filter((token) => normalizedName.includes(token)).length;
        if (hits === 0) {
          continue;
        }
        score = 40 + hits * 10;
      }

      const unit = String(row.base_unit_code ?? row.pricing_unit_code ?? 'unit');
      const candidate = {
        id: String(row.id),
        name,
        soldByWeight: unit === 'kg' && row.parent_product_id == null,
        unitPriceCents: Number(row.unit_price_cents ?? 0) || 0,
        score,
      };

      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }

    return best
      ? {
          id: best.id,
          name: best.name,
          soldByWeight: best.soldByWeight,
          unitPriceCents: best.unitPriceCents,
        }
      : null;
  }
}

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function formatStockFactsReply(
  products: Array<{
    name: string;
    stockQuantity: number;
    unitPriceCents: number;
  }>,
): string {
  const lines = products.slice(0, 8).map((product) => {
    const stock =
      product.stockQuantity > 0 ? `${product.stockQuantity} u. en stock` : 'sin stock ahora';
    return `• ${product.name} — ${stock} — ${formatArsCents(product.unitPriceCents)}`;
  });
  return [
    '¡Hola! Según nuestro stock:',
    ...lines,
    '¿Te interesa alguno?',
  ].join('\n');
}

function extractCustomerProductQuery(message: string): string {
  const stop = new Set([
    'hola',
    'buenas',
    'buen',
    'dias',
    'dia',
    'tardes',
    'noches',
    'tenes',
    'tene',
    'tienen',
    'hay',
    'algun',
    'alguna',
    'algunas',
    'algunos',
    'tipo',
    'tipos',
    'stock',
    'disponible',
    'disponibles',
    'por',
    'favor',
    'me',
    'pasas',
    'pasar',
    'podrias',
    'podes',
    'quiero',
    'necesito',
    'busco',
    'de',
    'del',
    'la',
    'las',
    'los',
    'el',
    'un',
    'una',
    'en',
    'con',
    'para',
    'que',
    'como',
  ]);
  const tokens = normalizePersonName(message)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token));
  return tokens.slice(0, 4).join(' ');
}

function formatArsCents(cents: number): string {
  const amount = (cents / 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return `$${amount}`;
}

function looksLikeEnglishCustomerReply(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (/[áéíóúñ¿¡]/i.test(normalized)) {
    return false;
  }
  return (
    /\b(thanks for reaching|i can help|which product|i don't see|let me confirm|reaching out)\b/.test(
      normalized,
    ) || /\b(the|you|our|please|thanks|availability|pricing)\b/.test(normalized)
  );
}

export function extractSpanishQuotedReply(answer: string): string | null {
  const patterns = [
    /[«"]([^«»"\n]{16,})[»"]/,
    /'([^'\n]{16,})'/,
    /respuesta:\s*[«"']?([^«"'»\n]{16,})/i,
  ];
  for (const pattern of patterns) {
    const match = answer.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !looksLikeEnglishCustomerReply(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function inferCopiActionType(question: string): CopiActionType {
  const normalized = normalizeCopiQuestion(question);

  if (wantsCreatePresupuestoAction(question)) {
    return 'create_presupuesto';
  }

  if (
    /\b(asign\w*|assign\w*)(?:\s+\w+){0,6}\s+(a\s+)?copi\b/.test(normalized) ||
    /\b(asign\w*|assign\w*).{0,48}\b(chat|conversacion|inbox|mensaje)\b.{0,24}\bcopi\b/.test(
      normalized,
    ) ||
    /\bcopi\s+(analiz|revis|tome|toma)\b/.test(normalized)
  ) {
    return 'assign_conversation_to_copi';
  }

  if (
    /\b(respond[eé]|responder|respuesta|contest[aá]|contestar)\b/.test(normalized) &&
    /\b(cliente|whatsapp|chat|mensaje|conversacion|hilo)\b/.test(normalized)
  ) {
    return 'propose_customer_reply';
  }

  if (
    /\b(avisame|avisame|recordame|recordar|recordatorio|alerta)\b/.test(normalized) &&
    !/\btareas?\b/.test(normalized)
  ) {
    return 'schedule_reminder';
  }

  if (/\b(llevame|abr[ií]|abrir|ir a|navega|mostrame la pantalla)\b/.test(normalized)) {
    return 'navigate_to';
  }

  if (/\b(ticket|soporte|ayuda nexolia|reportar (un )?problema)\b/.test(normalized)) {
    return 'create_support_ticket';
  }

  if (/\b(guardar|guarda)\b/.test(normalized) && /\b(pregunta|chip)\b/.test(normalized)) {
    return 'save_custom_question';
  }

  if (
    /\b(agregar|sumar|reponer|ingresar)\b/.test(normalized) &&
    /\b(stock|unidades?|inventario)\b/.test(normalized) &&
    !/\btareas?\b/.test(normalized)
  ) {
    return 'add_stock';
  }

  if (
    /\b(crear|crea|creame|nuevo|nueva)\b/.test(normalized) &&
    /\b(producto)\b/.test(normalized) &&
    !/\btareas?\b/.test(normalized)
  ) {
    return 'create_product';
  }

  if (/\b(ingreso|egreso)\b/.test(normalized) && /\b(caja|efectivo|plata)\b/.test(normalized)) {
    return /\begreso\b/.test(normalized) ? 'cash_egreso' : 'cash_ingreso';
  }
  if (/\b(anot[aá]|registrar|registra)\b/.test(normalized) && /\bcaja\b/.test(normalized)) {
    return /\begreso|gaste|pague|pagué\b/.test(normalized) ? 'cash_egreso' : 'cash_ingreso';
  }

  const mentionsAppointment = mentionsAppointmentIntent(question);
  if (mentionsAppointment) {
    const wantsCreateAppointment =
      /\b(crea|crear|creas|creame|agend|program|nuevo|nueva)\b/.test(normalized);
    if (
      /\b(asign\w*|assign\w*|reassign|pasale)\b/.test(normalized) &&
      !wantsCreateAppointment
    ) {
      return 'appointment_assign';
    }
    if (
      /\b(reagenda|reagendar|reprograma|reprogramar|actualiza|actualizar|modifica|modificar|cambia|cambiar|cancel|completa|completar|marca)\b/.test(
        normalized,
      ) &&
      !wantsCreateAppointment
    ) {
      return 'appointment_update';
    }
    return 'appointment_create';
  }

  const mentionsTask = /\btareas?\b/.test(normalized);
  const isAssignNewTask =
    /\b(?:asign\w*|assign\w*)\s+(?:una\s+|a\s+)?(?:nueva\s+)?(?:tarea|task|seguimiento)\b/.test(
      normalized,
    );
  const isCreate =
    isAssignNewTask ||
    (mentionsTask &&
      /\b(crea|crear|creas|creame|necesito\s+que\s+creas?|recorda|recordar|anota|anotar)\b/.test(
        normalized,
      ));

  if (isCreate) {
    return 'create_task';
  }

  if (/\b(asign\w*|assign\w*|reassign|pasale)\b/.test(normalized)) {
    return /\b(reassign|reasign\w*|pasale)\b/.test(normalized) ? 'reassign_task' : 'assign_task';
  }
  if (/\b(empez|empeza|empezar|comenz|comenza|comenzar|iniciar|inicia|arranc|start|starting)\b/.test(normalized) && mentionsTask) {
    return 'start_task';
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

  if (actionType === 'create_presupuesto') {
    const parsed = parseCreatePresupuestoRequest(question);
    return {
      assigneeName: parsed.assigneeName,
      clientLabel: parsed.clientLabel,
      description: parsed.description,
      lines: parsed.lines,
      question,
      timezone,
      title: parsed.title,
    };
  }

  if (actionType === 'appointment_create') {
    return buildCreateAppointmentPayload(question, timezone);
  }

  if (actionType === 'appointment_update' || actionType === 'appointment_assign') {
    return {
      appointmentId: null,
      question,
      timezone,
    };
  }

  if (actionType === 'schedule_reminder') {
    const parsed = parseCreateTaskItems(question, timezone)[0];
    const remindAt =
      parsed?.remindAt ??
      parsed?.dueAt ??
      defaultTomorrowNineAmIso(new Date(), timezone);
    const assumptions = softDefaultAssumptionsLine([
      `aviso ${remindAt}`,
      'asignado a vos',
      ...(parsed?.recurrenceFreq ? [`repite ${parsed.recurrenceFreq}`] : []),
    ]);
    return {
      assumptions,
      description: parsed?.description ?? question,
      question,
      recurrenceFreq: parsed?.recurrenceFreq ?? null,
      recurrenceWeekday: parsed?.recurrenceWeekday ?? null,
      remindAt,
      title: parsed?.title || truncateLabel(question, 60) || 'Recordatorio',
      timezone,
    };
  }

  if (actionType === 'navigate_to') {
    return {
      params: {},
      question,
      route: inferNavigateRoute(question),
      timezone,
    };
  }

  if (actionType === 'create_support_ticket') {
    return {
      body: question,
      question,
      severity: 'normal',
      subject: COPI_SUPPORT_TICKET_SUBJECT,
      timezone,
    };
  }

  if (actionType === 'save_custom_question') {
    return {
      label: truncateLabel(question),
      question,
      timezone,
    };
  }

  if (actionType === 'add_stock') {
    return {
      productId: null,
      productQuery: extractProductQuery(question),
      quantity: extractPositiveInt(question),
      question,
      receivedAt: todayYmd(new Date(), timezone),
      timezone,
    };
  }

  if (actionType === 'create_product') {
    return {
      category: extractCategoryHint(question) ?? 'General',
      name: extractProductNameForCreate(question),
      question,
      reorderThreshold: COPI_DEFAULT_PRODUCT_REORDER,
      stockQuantity: 0,
      timezone,
    };
  }

  if (actionType === 'cash_ingreso' || actionType === 'cash_egreso') {
    return {
      amountCents: extractAmountCents(question),
      concept: truncateLabel(question, 80) || (actionType === 'cash_ingreso' ? 'Ingreso' : 'Egreso'),
      entryDate: todayYmd(new Date(), timezone),
      question,
      timezone,
    };
  }

  if (actionType === 'propose_customer_reply' || actionType === 'assign_conversation_to_copi') {
    const conversationIdMatch = question.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    return {
      body: null,
      conversationId: conversationIdMatch?.[0] ?? null,
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

function inferNavigateRoute(question: string): string {
  const normalized = normalizeCopiQuestion(question);
  if (/\b(caja|balances|efectivo)\b/.test(normalized)) return '/(app)/cash';
  if (/\b(agenda|turno|cita)\b/.test(normalized)) return '/(app)/appointments';
  if (/\b(producto|stock|inventario)\b/.test(normalized)) return '/(app)/inventory/manage-stock';
  if (/\b(chat|inbox|whatsapp|mensaje)\b/.test(normalized)) return '/inbox';
  if (/\b(presupuesto|facturacion)\b/.test(normalized)) return '/(app)/billing';
  if (/\b(tarea|seguimiento)\b/.test(normalized)) return '/(app)/tasks';
  return '/(app)';
}

function extractAmountCents(question: string): number | null {
  const match = question.match(
    /\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/,
  );
  if (!match?.[1]) {
    return null;
  }
  let normalized = match[1].trim();
  if (normalized.includes(',') && normalized.includes('.')) {
    // 1.250,50 → 1250.50
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

function extractPositiveInt(question: string): number | null {
  const match = question.match(/\b(\d{1,6})\b/);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractProductQuery(question: string): string | null {
  const match = question.match(
    /(?:stock|producto|de)\s+([a-záéíóúñ0-9][\wáéíóúñ\s-]{1,40})/i,
  );
  return match?.[1]?.trim() || null;
}

function extractProductNameForCreate(question: string): string | null {
  const match = question.match(
    /(?:producto|llamado|llamada)\s+["“]?([a-záéíóúñ0-9][\wáéíóúñ\s-]{1,40})["”]?/i,
  );
  return match?.[1]?.trim() || null;
}

function extractCategoryHint(question: string): string | null {
  const match = question.match(/categor[ií]a\s+([a-záéíóúñ0-9][\wáéíóúñ\s-]{1,30})/i);
  return match?.[1]?.trim() || null;
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
  if (actionType === 'create_presupuesto') {
    return { actionType, payload };
  }

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

  if (actionType === 'appointment_create') {
    const question = readProposalQuestion(payload);
    const timezone =
      typeof payload.timezone === 'string' && payload.timezone.trim()
        ? payload.timezone
        : DEFAULT_TIMEZONE;
    if (!question) {
      return { actionType, payload };
    }
    // Rebuild from the original question when older proposals only stored placeholders.
    if (
      typeof payload.startsAt !== 'string' ||
      !payload.startsAt.trim() ||
      typeof payload.title !== 'string' ||
      !payload.title.trim()
    ) {
      return {
        actionType,
        payload: {
          ...payload,
          ...buildCreateAppointmentPayload(question, timezone),
        },
      };
    }
    return { actionType, payload };
  }

  const question = readProposalQuestion(payload);
  if (!question) {
    return { actionType, payload };
  }

  const inferred = inferCopiActionType(question);
  if (inferred === 'create_presupuesto') {
    const timezone =
      typeof payload.timezone === 'string' && payload.timezone.trim()
        ? payload.timezone
        : DEFAULT_TIMEZONE;
    const parsed = parseCreatePresupuestoRequest(question);
    return {
      actionType: 'create_presupuesto',
      payload: {
        assigneeName: parsed.assigneeName,
        clientLabel: parsed.clientLabel,
        description: parsed.description,
        lines: parsed.lines,
        question,
        timezone,
        title: parsed.title,
      },
    };
  }

  if (inferred === 'appointment_create') {
    const timezone =
      typeof payload.timezone === 'string' && payload.timezone.trim()
        ? payload.timezone
        : DEFAULT_TIMEZONE;
    return {
      actionType: 'appointment_create',
      payload: {
        ...payload,
        ...buildCreateAppointmentPayload(question, timezone),
      },
    };
  }

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

function readRequiredUuid(value: unknown, verb: string, customMessage?: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id === 'null' || id === 'undefined' || !isValidUuid(id)) {
    throw new Error(customMessage ?? `Falta el ID para ${verb}.`);
  }
  return id;
}

function readRequiredIsoDate(value: unknown, verb: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    throw new Error(`Falta la fecha/hora para ${verb}.`);
  }
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Fecha inválida para ${verb}.`);
  }
  return new Date(timestamp).toISOString();
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

/** Keep presupuesto task notes free of glue words and inline PRES codes. */
function cleanPresupuestoTaskDescription(value: string): string {
  return value
    .replace(/\b(?:también|tambien)\b/gi, ' ')
    .replace(/\b(?:también\s+)?presupuesto\s*[:·-]?\s*PRES-[A-Z0-9]+\b/gi, ' ')
    .replace(/\bPRES-[A-Z0-9]+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:·-]+|[\s.,;:·-]+$/g, '')
    .trim();
}

function summarizeProposal(actionType: CopiActionType, payload: Record<string, unknown>): string {
  switch (actionType) {
    case 'create_task':
      return summarizeCreateTaskPayload(payload);
    case 'create_presupuesto': {
      const title = String(payload.title ?? 'Nuevo presupuesto');
      const assignee =
        typeof payload.assigneeName === 'string' && payload.assigneeName.trim()
          ? ` (asignado a ${payload.assigneeName.trim()})`
          : ' (asignado a vos)';
      return `Crear presupuesto: ${title}${assignee}`;
    }
    case 'assign_task':
    case 'reassign_task':
      return 'Asignar tarea';
    case 'start_task':
      return 'Iniciar tarea (en progreso)';
    case 'complete_task':
      return 'Marcar tarea como completada';
    case 'snooze_task':
      return 'Posponer tarea';
    case 'cancel_task':
      return 'Cancelar tarea';
    case 'appointment_create':
      return summarizeCreateAppointmentPayload(payload);
    case 'appointment_update':
      return 'Actualizar turno';
    case 'appointment_assign':
      return 'Asignar turno';
    case 'schedule_reminder':
      return `Programar recordatorio: ${String(payload.title ?? 'Recordatorio')}`;
    case 'navigate_to':
      return `Abrir pantalla: ${String(payload.route ?? 'home')}`;
    case 'create_support_ticket':
      return `Crear ticket: ${String(payload.subject ?? COPI_SUPPORT_TICKET_SUBJECT)}`;
    case 'save_custom_question':
      return `Guardar pregunta: ${String(payload.label ?? payload.question ?? '')}`;
    case 'add_stock':
      return `Agregar stock: ${String(payload.productName ?? payload.productQuery ?? 'producto')} (${String(payload.quantity ?? '?')} u.)`;
    case 'create_product':
      return `Crear producto: ${String(payload.name ?? 'Nuevo producto')}`;
    case 'cash_ingreso':
      return `Registrar ingreso de caja`;
    case 'cash_egreso':
      return `Registrar egreso de caja`;
    case 'propose_customer_reply':
      return typeof payload.body === 'string' && payload.body.trim()
        ? `Enviar respuesta al cliente: «${truncateLabel(payload.body, 72)}»`
        : 'Enviar respuesta al cliente por WhatsApp';
    case 'assign_conversation_to_copi':
      return 'Asignar conversación a Copi';
    default:
      return 'Acción de Copi';
  }
}
