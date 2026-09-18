import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionType, OwnerCopilotResponse } from './copi.types';
import { CopiActionService, extractSpanishQuotedReply, inferCopiActionType } from './copi-action.service';
import {
  detectProActionIntent,
  isCopiActionAffirmative,
  isCopiActionNegative,
  isCustomerReplyFollowUp,
  isUnclearCopiQuestion,
  unclearCopiReply,
  wantsExplicitCreateTask,
  wantsPendingDraftsList,
} from './copi-intent-router';
import { CopiLlmPhraserService } from './copi-llm-phraser.service';
import { CopiLlmToolSelectorService } from './copi-llm-tool-selector.service';
import {
  CopiLlmTurnPlannerService,
  type CopiTurnPlan,
} from './copi-llm-turn-planner.service';
import { CopiPolicyService } from './copi-policy.service';
import { formatCopiPresupuestoLink } from './copi-product-link.util';
import { CopiSessionService } from './copi-session.service';
import { CopiToolRegistry } from './copi-tool-registry';

interface MembershipRow {
  role: 'owner' | 'staff';
}

// KAN-401: task mutations always propose + confirm; only presupuesto auto-executes.
const AUTO_EXECUTE_ACTIONS = new Set<CopiActionType>(['create_presupuesto']);

@Injectable()
export class CopiOrchestratorService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly policyService: CopiPolicyService,
    private readonly toolRegistry: CopiToolRegistry,
    private readonly toolSelectorService: CopiLlmToolSelectorService,
    private readonly phraserService: CopiLlmPhraserService,
    private readonly turnPlannerService: CopiLlmTurnPlannerService,
    private readonly sessionService: CopiSessionService,
    private readonly actionService: CopiActionService,
  ) {}

  async answerQuestion(params: {
    authorizationHeader: string | undefined;
    businessCenterId?: string;
    documentContext?: string;
    imageContext?: string;
    now?: Date;
    organizationId: string;
    question: string;
    sessionId?: string;
  }): Promise<OwnerCopilotResponse> {
    const startedAt = Date.now();
    const member = await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });
    const flags = await this.policyService.loadFeatureFlags(params.organizationId);
    const enabledDecision = this.policyService.assertCopiEnabled(flags);
    if (enabledDecision === 'policy_denied') {
      return this.buildDeniedResponse(startedAt, 'Copi no está habilitado para esta organización.');
    }

    const businessCenter = await this.getBusinessCenter(params.organizationId, params.businessCenterId);
    const businessCenterId = businessCenter.id;
    const now = params.now ?? new Date();
    const sessionId = await this.sessionService.ensureSession({
      businessCenterId,
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      userId: member.userId,
    });

    const conversationHistory = (
      await this.sessionService.listMessages(sessionId, params.organizationId, member.userId)
    )
      .filter((message) => message.role !== 'system')
      .slice(-8)
      .map((message) => ({ body: message.body, role: message.role }));

    const imageContext = params.imageContext?.trim();
    const documentContext = params.documentContext?.trim();
    let reasoningQuestion = params.question.trim();
    if (imageContext) {
      reasoningQuestion = `${reasoningQuestion}\n\nContexto de la imagen adjunta:\n${imageContext}`;
    }
    if (documentContext) {
      reasoningQuestion = `${reasoningQuestion}\n\nContexto del documento adjunto:\n${documentContext}`;
    }

    const context = {
      authorizationHeader: params.authorizationHeader,
      businessCenterId,
      conversationHistory,
      now,
      organizationId: params.organizationId,
      ownerDisplayName: member.displayName,
      question: reasoningQuestion,
      sessionId,
      timezone: businessCenter.timezone,
      userId: member.userId,
    };

    await this.sessionService.appendMessage({
      body: params.question,
      organizationId: params.organizationId,
      role: 'owner',
      sessionId,
    });

    const pending = await this.actionService.findLatestPendingProposal({
      businessCenterId,
      organizationId: params.organizationId,
      sessionId,
      userId: member.userId,
    });

    const useLlm = this.policyService.canUseFreeformQuestions(flags);
    if (useLlm) {
      const plan = await this.turnPlannerService.planTurn({
        history: conversationHistory,
        organizationId: params.organizationId,
        pendingProposal: pending
          ? {
              actionType: pending.actionType,
              id: pending.id,
              summary: pending.summary,
            }
          : null,
        question: reasoningQuestion,
      });

      if (plan) {
        const planned = await this.executeTurnPlan({
          businessCenterId,
          context,
          memberUserId: member.userId,
          ownerDisplayName: member.displayName,
          pending,
          plan,
          reasoningQuestion,
          sessionId,
          startedAt,
          useLlm,
        });
        if (planned) {
          return planned;
        }
      }
    }

    // Fallback when planner unavailable or failed — regex short-circuits (no tier_required).
    if (isCopiActionAffirmative(params.question)) {
      if (pending) {
        const executed = await this.actionService.confirmAction({
          actionId: pending.id,
          businessCenterId,
          organizationId: params.organizationId,
          userId: member.userId,
        });
        const answer =
          pending.actionType === 'propose_customer_reply'
            ? formatCustomerReplyConfirmed(executed.result)
            : `Listo. Acción confirmada (${executed.status}).`;
        await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
        return {
          answer,
          policyDecision: 'allowed',
          proposedAction: null,
          responseTimeMs: Date.now() - startedAt,
          sessionId,
          tier: 'pro',
          tokenUsage: this.policyService.emptyUsage(),
          tools: [],
        };
      }
    }

    if (isCopiActionNegative(params.question)) {
      if (pending) {
        await this.actionService.rejectAction({
          actionId: pending.id,
          businessCenterId,
          organizationId: params.organizationId,
          userId: member.userId,
        });
        const answer =
          pending.actionType === 'propose_customer_reply'
            ? 'Listo. No envío nada al cliente.'
            : 'Listo. Cancelé esa acción.';
        await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
        return {
          answer,
          policyDecision: 'allowed',
          proposedAction: null,
          responseTimeMs: Date.now() - startedAt,
          sessionId,
          tier: 'pro',
          tokenUsage: this.policyService.emptyUsage(),
          tools: [],
        };
      }
    }

    if (wantsPendingDraftsList(params.question, conversationHistory)) {
      const toolResults = await this.toolRegistry.executeTools(context, ['pending_ai_drafts']);
      const draftResult = toolResults.find((item) => item.key === 'pending_ai_drafts');
      const answer =
        draftResult?.summary?.trim() ||
        'No hay borradores IA pendientes para mostrar.';
      await this.persistAssistantMessage(params.organizationId, sessionId, answer, [
        'pending_ai_drafts',
      ]);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools: ['pending_ai_drafts'],
      };
    }

    const wantsProAction = detectProActionIntent(reasoningQuestion);

    if (!wantsProAction && isUnclearCopiQuestion(reasoningQuestion)) {
      const answer = unclearCopiReply();
      await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    const inferredAction = wantsProAction ? inferCopiActionType(reasoningQuestion) : null;
    const shouldAutoExecute =
      inferredAction != null && AUTO_EXECUTE_ACTIONS.has(inferredAction);

    if (shouldAutoExecute) {
      const proposedAction = await this.actionService.proposeAction(context);
      if (proposedAction) {
        const executed = await this.actionService.confirmAction({
          actionId: proposedAction.id,
          businessCenterId,
          organizationId: params.organizationId,
          userId: member.userId,
        });
        const answer = formatAutoExecutedAnswer(proposedAction.actionType, executed.result);
        await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
        return {
          answer,
          policyDecision: 'allowed',
          proposedAction: null,
          responseTimeMs: Date.now() - startedAt,
          sessionId,
          tier: 'pro',
          tokenUsage: this.policyService.emptyUsage(),
          tools: [],
        };
      }
    }

    // Customer-reply follow-up (fallback when planner missed revise).
    const pendingForFollowUp = pending;
    const followUpCustomerReply =
      !wantsExplicitCreateTask(reasoningQuestion) &&
      (inferredAction === 'propose_customer_reply' ||
        pendingForFollowUp?.actionType === 'propose_customer_reply' ||
        isCustomerReplyFollowUp(reasoningQuestion, conversationHistory));

    if (followUpCustomerReply) {
      const customerReply = await this.runCustomerReplyDraft({
        context,
        memberUserId: member.userId,
        organizationId: params.organizationId,
        reasoningQuestion,
        sessionId,
        startedAt,
        useLlm,
      });
      if (customerReply) {
        return customerReply;
      }
    }

    const selected = await this.toolSelectorService.selectTools({
      enabled: useLlm,
      history: conversationHistory,
      organizationId: params.organizationId,
      question: reasoningQuestion,
    });
    const tools = selected.tools;
    const toolResults = await this.toolRegistry.executeTools(context, tools);
    const phrased = await this.phraserService.phraseAnswer({
      enabled: useLlm,
      history: conversationHistory,
      locale: 'es-AR',
      organizationId: params.organizationId,
      ownerDisplayName: member.displayName,
      question: reasoningQuestion,
      tier: 'pro',
      toolResults,
    });

    let proposedAction = null;
    let answer = phrased.answer;
    if (wantsProAction && inferredAction && inferredAction !== 'propose_customer_reply') {
      proposedAction = await this.actionService.proposeAction(context);
      if (proposedAction) {
        if (proposedAction.actionType === 'propose_customer_reply') {
          const extracted = extractSpanishQuotedReply(phrased.answer);
          const currentBody =
            typeof proposedAction.payload.body === 'string'
              ? proposedAction.payload.body.trim()
              : '';
          const body = extracted || currentBody;
          if (body) {
            proposedAction = {
              ...proposedAction,
              payload: { ...proposedAction.payload, body },
              summary: `Enviar respuesta al cliente: «${body.slice(0, 72)}${body.length > 72 ? '…' : ''}»`,
            };
            await this.actionService.updateProposalPayload({
              actionId: proposedAction.id,
              organizationId: params.organizationId,
              payload: proposedAction.payload,
              userId: member.userId,
            });
          }
          answer = body
            ? `Te propongo enviar este mensaje al cliente por WhatsApp:\n\n«${body}»\n\n¿Lo envío? Respondeme sí o no.`
            : `${proposedAction.summary}.\n\n¿Lo hago? Respondeme sí o no.`;
        } else {
          const clarifications = Array.isArray(proposedAction.payload.clarificationQuestions)
            ? proposedAction.payload.clarificationQuestions.filter(
                (item): item is string => typeof item === 'string' && item.trim().length > 0,
              )
            : [];
          const clarificationBlock =
            clarifications.length > 0
              ? `\n\n${clarifications.map((item) => `• ${item}`).join('\n')}\n(Si confirmás ahora, uso un horario estimado y después lo podemos ajustar.)`
              : '';
          answer = `${answer}\n\n${proposedAction.summary}.${clarificationBlock}\n\n¿Lo hago? Respondeme sí o no.`;
        }
      }
    }

    await this.persistAssistantMessage(params.organizationId, sessionId, answer, tools, phrased.tokenUsage);

    return {
      answer,
      policyDecision: 'allowed',
      proposedAction,
      responseTimeMs: Date.now() - startedAt,
      sessionId,
      tier: 'pro',
      tokenUsage: phrased.tokenUsage,
      tools,
    };
  }

  private async executeTurnPlan(params: {
    businessCenterId: string;
    context: {
      authorizationHeader: string | undefined;
      businessCenterId: string;
      conversationHistory: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
      now: Date;
      organizationId: string;
      ownerDisplayName: string | null;
      question: string;
      sessionId: string;
      timezone: string;
      userId: string;
    };
    memberUserId: string;
    ownerDisplayName: string | null;
    pending: { actionType: CopiActionType; id: string; summary: string } | null;
    plan: CopiTurnPlan;
    reasoningQuestion: string;
    sessionId: string;
    startedAt: number;
    useLlm: boolean;
  }): Promise<OwnerCopilotResponse | null> {
    const {
      businessCenterId,
      context,
      memberUserId,
      ownerDisplayName,
      pending,
      plan,
      reasoningQuestion,
      sessionId,
      startedAt,
      useLlm,
    } = params;
    const organizationId = context.organizationId;

    if (plan.kind === 'confirm_pending') {
      if (!pending) {
        return null;
      }
      const executed = await this.actionService.confirmAction({
        actionId: pending.id,
        businessCenterId,
        organizationId,
        userId: memberUserId,
      });
      const answer =
        pending.actionType === 'propose_customer_reply'
          ? formatCustomerReplyConfirmed(executed.result)
          : `Listo. Acción confirmada (${executed.status}).`;
      await this.persistAssistantMessage(organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    if (plan.kind === 'reject_pending') {
      if (!pending) {
        return null;
      }
      await this.actionService.rejectAction({
        actionId: pending.id,
        businessCenterId,
        organizationId,
        userId: memberUserId,
      });
      const answer =
        pending.actionType === 'propose_customer_reply'
          ? 'Listo. No envío nada al cliente.'
          : 'Listo. Cancelé esa acción.';
      await this.persistAssistantMessage(organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    if (plan.kind === 'clarify') {
      const answer =
        plan.ownerNotes?.trim() ||
        'No estoy seguro de lo que necesitás. ¿Podés aclararme un poco más?';
      await this.persistAssistantMessage(organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    if (plan.kind === 'revise_customer_reply') {
      return this.runCustomerReplyDraft({
        context,
        memberUserId,
        organizationId,
        reasoningQuestion,
        sessionId,
        startedAt,
        useLlm,
        toolArgs: plan.toolArgs,
      });
    }

    const toolContext = enrichContextWithToolArgs(context, plan.toolArgs);
    const tools =
      plan.tools.length > 0
        ? plan.tools
        : plan.kind === 'answer'
          ? (
              await this.toolSelectorService.selectTools({
                enabled: useLlm,
                history: context.conversationHistory,
                organizationId,
                question: reasoningQuestion,
              })
            ).tools
          : [];

    if (plan.kind === 'answer') {
      const toolResults = await this.toolRegistry.executeTools(toolContext, tools);
      const phrased = await this.phraserService.phraseAnswer({
        enabled: useLlm,
        history: context.conversationHistory,
        locale: 'es-AR',
        organizationId,
        ownerDisplayName,
        ownerNotes: plan.ownerNotes,
        question: reasoningQuestion,
        tier: 'pro',
        toolResults,
      });
      await this.persistAssistantMessage(
        organizationId,
        sessionId,
        phrased.answer,
        tools,
        phrased.tokenUsage,
      );
      return {
        answer: phrased.answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: phrased.tokenUsage,
        tools,
      };
    }

    if (plan.kind === 'propose_action') {
      const actionType = plan.action?.type ?? null;
      if (actionType === 'propose_customer_reply') {
        return this.runCustomerReplyDraft({
          context: toolContext,
          memberUserId,
          organizationId,
          reasoningQuestion,
          sessionId,
          startedAt,
          useLlm,
          toolArgs: plan.toolArgs,
        });
      }

      if (actionType && AUTO_EXECUTE_ACTIONS.has(actionType)) {
        const proposedAction = await this.actionService.proposeAction(toolContext, {
          forcedActionType: actionType,
          payloadOverrides: plan.action?.payload,
        });
        if (proposedAction) {
          const executed = await this.actionService.confirmAction({
            actionId: proposedAction.id,
            businessCenterId,
            organizationId,
            userId: memberUserId,
          });
          const answer = formatAutoExecutedAnswer(proposedAction.actionType, executed.result);
          await this.persistAssistantMessage(organizationId, sessionId, answer, tools);
          return {
            answer,
            policyDecision: 'allowed',
            proposedAction: null,
            responseTimeMs: Date.now() - startedAt,
            sessionId,
            tier: 'pro',
            tokenUsage: this.policyService.emptyUsage(),
            tools,
          };
        }
      }

      if (tools.length > 0) {
        await this.toolRegistry.executeTools(toolContext, tools);
      }

      const proposedAction = await this.actionService.proposeAction(toolContext, {
        forcedActionType: actionType ?? undefined,
        payloadOverrides: plan.action?.payload,
      });
      if (!proposedAction) {
        return null;
      }

      const clarifications = Array.isArray(proposedAction.payload.clarificationQuestions)
        ? proposedAction.payload.clarificationQuestions.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          )
        : [];
      const clarificationBlock =
        clarifications.length > 0
          ? `\n\n${clarifications.map((item) => `• ${item}`).join('\n')}\n(Si confirmás ahora, uso un horario estimado y después lo podemos ajustar.)`
          : '';
      const answer = `${proposedAction.summary}.${clarificationBlock}\n\n¿Lo hago? Respondeme sí o no.`;
      await this.persistAssistantMessage(organizationId, sessionId, answer, tools);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'pro',
        tokenUsage: this.policyService.emptyUsage(),
        tools,
      };
    }

    return null;
  }

  private async runCustomerReplyDraft(params: {
    context: {
      authorizationHeader: string | undefined;
      businessCenterId: string;
      conversationHistory: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
      now: Date;
      organizationId: string;
      ownerDisplayName: string | null;
      question: string;
      sessionId: string;
      timezone: string;
      userId: string;
    };
    memberUserId: string;
    organizationId: string;
    reasoningQuestion: string;
    sessionId: string;
    startedAt: number;
    toolArgs?: CopiTurnPlan['toolArgs'];
    useLlm: boolean;
  }): Promise<OwnerCopilotResponse | null> {
    const customerReplyTools = ['conversation_thread', 'find_product'] as const;
    const toolContext = enrichContextWithToolArgs(params.context, params.toolArgs);
    let toolResults = await this.toolRegistry.executeTools(toolContext, [...customerReplyTools]);

    const thread = toolResults.find((result) => result.key === 'conversation_thread');
    const findProduct = toolResults.find((result) => result.key === 'find_product');
    const products = Array.isArray(findProduct?.payload?.products)
      ? findProduct.payload.products
      : [];
    if (products.length === 0 && thread?.payload) {
      const lastInbound = extractLastInboundFromThreadPayload(thread.payload);
      if (lastInbound) {
        const enrichedContext = {
          ...toolContext,
          question: `${params.reasoningQuestion}\n\nMensaje del cliente: ${lastInbound}`,
        };
        const productOnly = await this.toolRegistry.executeTools(enrichedContext, ['find_product']);
        toolResults = [
          ...toolResults.filter((result) => result.key !== 'find_product'),
          ...productOnly,
        ];
      }
    }

    const drafted = await this.phraserService.phraseCustomerWhatsAppReply({
      enabled: params.useLlm,
      organizationId: params.organizationId,
      question: params.reasoningQuestion,
      tier: 'pro',
      toolResults,
    });

    let proposedAction = await this.actionService.proposeAction(
      {
        ...toolContext,
        question: /respond[eé]/i.test(params.reasoningQuestion)
          ? params.reasoningQuestion
          : `Respondé al cliente por WhatsApp. Instrucciones del dueño: ${params.reasoningQuestion}`,
      },
      { forcedActionType: 'propose_customer_reply' },
    );
    if (!proposedAction) {
      return null;
    }

    const body = drafted.body.trim();
    if (body) {
      proposedAction = {
        ...proposedAction,
        payload: { ...proposedAction.payload, body },
        summary: `Enviar respuesta al cliente: «${body.slice(0, 72)}${body.length > 72 ? '…' : ''}»`,
      };
      await this.actionService.updateProposalPayload({
        actionId: proposedAction.id,
        organizationId: params.organizationId,
        payload: proposedAction.payload,
        userId: params.memberUserId,
      });
    }
    const answer = body
      ? `Te propongo enviar este mensaje al cliente por WhatsApp:\n\n«${body}»\n\n¿Lo envío? Respondeme sí o no.`
      : `${proposedAction.summary}.\n\n¿Lo hago? Respondeme sí o no.`;
    await this.persistAssistantMessage(params.organizationId, params.sessionId, answer, [
      ...customerReplyTools,
    ]);
    return {
      answer,
      policyDecision: 'allowed',
      proposedAction,
      responseTimeMs: Date.now() - params.startedAt,
      sessionId: params.sessionId,
      tier: 'pro',
      tokenUsage: drafted.tokenUsage,
      tools: [...customerReplyTools],
    };
  }

  private async persistAssistantMessage(
    organizationId: string,
    sessionId: string,
    answer: string,
    tools: string[],
    tokenUsage?: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    await this.sessionService.appendMessage({
      body: answer,
      organizationId,
      role: 'assistant',
      sessionId,
      tokenUsage: tokenUsage ?? {},
      toolsUsed: tools,
    });
  }

  private buildDeniedResponse(startedAt: number, answer: string): OwnerCopilotResponse {
    return {
      answer,
      policyDecision: 'policy_denied',
      proposedAction: null,
      responseTimeMs: Date.now() - startedAt,
      sessionId: '',
      tier: 'basic',
      tokenUsage: this.policyService.emptyUsage(),
      tools: [],
    };
  }

  private async getBusinessCenter(
    organizationId: string,
    businessCenterId?: string,
  ): Promise<{ id: string; timezone: string }> {
    const client = this.supabaseService.getServiceRoleClient();
    let query = client
      .from('business_centers')
      .select('id, timezone')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (businessCenterId) {
      query = query.eq('id', businessCenterId);
    } else {
      query = query.eq('is_default', true);
    }

    const { data, error } = await query.single<{ id: string; timezone: string | null }>();

    if (error) {
      throw new Error(`Failed to load business center for copilot: ${error.message}`);
    }

    return {
      id: data.id,
      timezone: data.timezone?.trim() || 'America/Argentina/Buenos_Aires',
    };
  }

  private async assertMember(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<{ displayName: string | null; userId: string }> {
    const token = params.authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new Error('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error('Invalid bearer token');
    }

    const { data, error } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', userData.user.id)
      .single<MembershipRow>();

    if (error || !data) {
      throw new Error('User is not a member of this organization');
    }

    const metadata = userData.user.user_metadata as { full_name?: unknown } | null | undefined;
    const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : null;

    return {
      displayName: fullName?.trim() || null,
      userId: userData.user.id,
    };
  }
}

function formatAutoExecutedAnswer(
  actionType: CopiActionType,
  result: Record<string, unknown>,
): string {
  if (actionType === 'create_presupuesto') {
    const quoteId = String(result.quoteId ?? '').trim();
    const taskTitle = String(result.taskTitle ?? 'Tarea de presupuesto').trim();
    const assigneeName =
      typeof result.assigneeName === 'string' && result.assigneeName.trim()
        ? result.assigneeName.trim()
        : null;
    const assigneeFellBack = Boolean(result.assigneeFellBackToCreator);
    const unresolved = Array.isArray(result.unresolvedProducts)
      ? result.unresolvedProducts.filter((item): item is string => typeof item === 'string')
      : [];

    const link = quoteId
      ? formatCopiPresupuestoLink(quoteId, `Abrir presupuesto ${quoteId}`)
      : 'el presupuesto';
    const assigneeLine = assigneeName
      ? assigneeFellBack
        ? `Tarea creada y asignada a vos (no encontré a «${assigneeName}» en el equipo): ${taskTitle}.`
        : `Tarea creada y asignada a ${assigneeName}: ${taskTitle}.`
      : `Tarea creada y asignada a vos: ${taskTitle}.`;
    const unresolvedLine =
      unresolved.length > 0
        ? `\nNo encontré en el catálogo: ${unresolved.join(', ')}. Podés completarlos en Facturación.`
        : '';

    return `Listo.\n${link}\n${assigneeLine}${unresolvedLine}`;
  }

  if (actionType === 'create_task') {
    const titles = Array.isArray(result.titles)
      ? result.titles.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        )
      : [];
    const assigneeNames = Array.isArray(result.assigneeNames) ? result.assigneeNames : [];

    if (titles.length === 0) {
      return 'Listo. Creé la tarea.';
    }

    if (titles.length === 1) {
      const assignee = typeof assigneeNames[0] === 'string' ? assigneeNames[0] : null;
      return assignee
        ? `Listo. Creé la tarea «${titles[0]}» y la asigné a ${assignee}.`
        : `Listo. Creé la tarea «${titles[0]}».`;
    }

    return `Listo. Creé ${titles.length} tareas:\n${titles.map((title) => `• ${title}`).join('\n')}`;
  }

  return 'Listo. Acción completada.';
}

function formatCustomerReplyConfirmed(result: Record<string, unknown>): string {
  const body = typeof result.body === 'string' ? result.body.trim() : '';
  if (body) {
    return `Listo. Envié al cliente por WhatsApp:\n\n«${body}»`;
  }
  return 'Listo. Envié la respuesta al cliente por WhatsApp.';
}

function extractLastInboundFromThreadPayload(payload: Record<string, unknown>): string | null {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const row = messages[index] as { body?: unknown; direction?: unknown } | null;
    if (!row || row.direction !== 'inbound') {
      continue;
    }
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (body) {
      return body;
    }
  }
  return null;
}

function enrichContextWithToolArgs<T extends { question: string }>(
  context: T,
  toolArgs?: CopiTurnPlan['toolArgs'],
): T {
  if (!toolArgs) {
    return context;
  }
  const findProduct = toolArgs.find_product;
  const query =
    findProduct && typeof findProduct.query === 'string' ? findProduct.query.trim() : '';
  if (!query) {
    return context;
  }
  if (context.question.toLocaleLowerCase('es-AR').includes(query.toLocaleLowerCase('es-AR'))) {
    return context;
  }
  return {
    ...context,
    question: `${context.question}\n\nProducto a buscar: ${query}`,
  };
}
