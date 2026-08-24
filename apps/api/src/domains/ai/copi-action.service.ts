import { Injectable, Optional } from '@nestjs/common';

import { AppointmentsService } from '../appointments/appointments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionProposal, CopiActionType, CopiQueryContext } from './copi.types';
import {
  detectProActionIntent,
  mentionsAppointmentIntent,
  normalizeCopiQuestion,
} from './copi-intent-router';
import {
  buildCreateTaskPayload,
  parseCreatePresupuestoRequest,
  readTaskItems,
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
    @Optional() private readonly notificationsService?: NotificationsService,
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

    const proposal: CopiActionProposal = {
      actionType: data.action_type,
      id: data.id,
      payload: data.payload,
      summary: summarizeProposal(data.action_type, data.payload),
    };

    if (this.notificationsService) {
      await this.notificationsService.notifyCopiActionNeeded({
        actionId: proposal.id,
        businessCenterId: context.businessCenterId,
        organizationId: context.organizationId,
        summary: proposal.summary,
        userId: context.userId,
      });
    }

    return proposal;
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
        const startsAt = readRequiredIsoDate(params.payload.startsAt, 'agendar');
        const endsAt =
          typeof params.payload.endsAt === 'string' && params.payload.endsAt.trim()
            ? params.payload.endsAt
            : new Date(new Date(startsAt).getTime() + 30 * 60 * 1000).toISOString();
        const appointment = await this.appointmentsService.createAppointment({
          assignedToUserId: readOptionalUuid(params.payload.assignedToUserId),
          businessCenterId: params.businessCenterId,
          contactId: readOptionalUuid(params.payload.contactId),
          createdByUserId: params.userId,
          endsAt,
          notes:
            typeof params.payload.notes === 'string' ? params.payload.notes : null,
          organizationId: params.organizationId,
          startsAt,
          title,
        });
        return {
          appointmentId: appointment.id,
          endsAt: appointment.endsAt,
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
        const appointmentId = readRequiredUuid(params.payload.appointmentId, 'asignar turno');
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

export function inferCopiActionType(question: string): CopiActionType {
  const normalized = normalizeCopiQuestion(question);

  // Standalone presupuesto creation (not “crear tarea para presupuesto”).
  if (wantsCreatePresupuestoAction(question)) {
    return 'create_presupuesto';
  }

  const mentionsAppointment = mentionsAppointmentIntent(question);
  if (mentionsAppointment) {
    if (/\b(asign\w*|assign\w*|reassign|pasale)\b/.test(normalized)) {
      return 'appointment_assign';
    }
    if (
      /\b(reagenda|reagendar|reprograma|reprogramar|actualiza|actualizar|modifica|modificar|cambia|cambiar|cancel|completa|completar|marca)\b/.test(
        normalized,
      )
    ) {
      return 'appointment_update';
    }
    return 'appointment_create';
  }

  const mentionsTask = /\btareas?\b/.test(normalized);
  // "asigna una tarea a X para…" is create+assign, not reassign of an existing task.
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

  // Creating tasks always wins — phrases like "mañana" must not become snooze.
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

  if (
    actionType === 'appointment_create' ||
    actionType === 'appointment_update' ||
    actionType === 'appointment_assign'
  ) {
    return {
      appointmentId: null,
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

function readRequiredUuid(value: unknown, verb: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id === 'null' || id === 'undefined' || !isValidUuid(id)) {
    throw new Error(`Falta el ID para ${verb}.`);
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
      return 'Crear turno en la agenda';
    case 'appointment_update':
      return 'Actualizar turno';
    case 'appointment_assign':
      return 'Asignar turno';
    default:
      return 'Acción de Copi';
  }
}
