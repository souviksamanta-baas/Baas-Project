import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import type { CopiActionType, OwnerCopilotResponse } from './copi.types';
import { CopiActionService, inferCopiActionType } from './copi-action.service';
import { detectProActionIntent, isUnclearCopiQuestion, unclearCopiReply } from './copi-intent-router';
import { CopiLlmPhraserService } from './copi-llm-phraser.service';
import { CopiLlmToolSelectorService } from './copi-llm-tool-selector.service';
import { CopiPolicyService } from './copi-policy.service';
import { formatCopiPresupuestoLink } from './copi-product-link.util';
import { CopiSessionService } from './copi-session.service';
import { CopiToolRegistry } from './copi-tool-registry';

interface MembershipRow {
  role: 'owner' | 'staff';
}

const AUTO_EXECUTE_ACTIONS = new Set<CopiActionType>(['create_task', 'create_presupuesto']);

@Injectable()
export class CopiOrchestratorService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly policyService: CopiPolicyService,
    private readonly toolRegistry: CopiToolRegistry,
    private readonly toolSelectorService: CopiLlmToolSelectorService,
    private readonly phraserService: CopiLlmPhraserService,
    private readonly sessionService: CopiSessionService,
    private readonly actionService: CopiActionService,
  ) {}

  async answerQuestion(params: {
    authorizationHeader: string | undefined;
    businessCenterId?: string;
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
    const reasoningQuestion = imageContext
      ? `${params.question.trim()}\n\nContexto de la imagen adjunta:\n${imageContext}`
      : params.question;

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

    const wantsProAction = detectProActionIntent(reasoningQuestion);
    if (wantsProAction && !this.policyService.canUseProAgent(flags)) {
      const answer =
        'Esta acción requiere Copi Pro. Activá el add-on para crear tareas, asignaciones y automatizaciones.';
      await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'tier_required',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: 'basic',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    if (!wantsProAction && isUnclearCopiQuestion(reasoningQuestion)) {
      const answer = unclearCopiReply();
      await this.persistAssistantMessage(params.organizationId, sessionId, answer, []);
      return {
        answer,
        policyDecision: 'allowed',
        proposedAction: null,
        responseTimeMs: Date.now() - startedAt,
        sessionId,
        tier: this.policyService.canUseProAgent(flags) ? 'pro' : 'basic',
        tokenUsage: this.policyService.emptyUsage(),
        tools: [],
      };
    }

    const inferredAction = wantsProAction ? inferCopiActionType(reasoningQuestion) : null;
    const shouldAutoExecute =
      inferredAction != null &&
      AUTO_EXECUTE_ACTIONS.has(inferredAction) &&
      this.policyService.canUseProAgent(flags);

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

    const useLlm = this.policyService.canUseFreeformQuestions(flags);
    const isPro = this.policyService.canUseProAgent(flags);
    const selected = await this.toolSelectorService.selectTools({
      enabled: useLlm,
      history: conversationHistory,
      question: reasoningQuestion,
    });
    const tools = selected.tools;
    const toolResults = await this.toolRegistry.executeTools(context, tools);
    const phrased = await this.phraserService.phraseAnswer({
      enabled: useLlm,
      history: conversationHistory,
      locale: 'es-AR',
      ownerDisplayName: member.displayName,
      question: reasoningQuestion,
      tier: isPro ? 'pro' : 'basic',
      toolResults,
    });

    let proposedAction = null;
    let answer = phrased.answer;
    if (wantsProAction && this.policyService.canUseProAgent(flags)) {
      proposedAction = await this.actionService.proposeAction(context);
      if (proposedAction) {
        const clarifications = Array.isArray(proposedAction.payload.clarificationQuestions)
          ? proposedAction.payload.clarificationQuestions.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0,
            )
          : [];
        const clarificationBlock =
          clarifications.length > 0
            ? `\n\n${clarifications.map((item) => `• ${item}`).join('\n')}\n(Si confirmás ahora, uso un horario estimado y después lo podemos ajustar.)`
            : '';
        answer = `${answer}\n\n${proposedAction.summary}.${clarificationBlock}\n\n¿Confirmo la acción?`;
      }
    }

    await this.persistAssistantMessage(params.organizationId, sessionId, answer, tools, phrased.tokenUsage);

    return {
      answer,
      policyDecision: 'allowed',
      proposedAction,
      responseTimeMs: Date.now() - startedAt,
      sessionId,
      tier: this.policyService.canUseProAgent(flags) ? 'pro' : 'basic',
      tokenUsage: phrased.tokenUsage,
      tools,
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
