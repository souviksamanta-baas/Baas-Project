import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import type { OwnerCopilotResponse } from './copi.types';
import { CopiActionService } from './copi-action.service';
import { detectProActionIntent } from './copi-intent-router';
import { CopiLlmPhraserService } from './copi-llm-phraser.service';
import { CopiLlmToolSelectorService } from './copi-llm-tool-selector.service';
import { CopiPolicyService } from './copi-policy.service';
import { CopiSessionService } from './copi-session.service';
import { CopiToolRegistry } from './copi-tool-registry';

interface MembershipRow {
  role: 'owner' | 'staff';
}

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
    now?: Date;
    organizationId: string;
    question: string;
    sessionId?: string;
  }): Promise<OwnerCopilotResponse> {
    const startedAt = Date.now();
    const userId = await this.assertMember({
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
      userId,
    });

    const context = {
      authorizationHeader: params.authorizationHeader,
      businessCenterId,
      now,
      organizationId: params.organizationId,
      question: params.question,
      sessionId,
      timezone: businessCenter.timezone,
      userId,
    };

    await this.sessionService.appendMessage({
      body: params.question,
      organizationId: params.organizationId,
      role: 'owner',
      sessionId,
    });

    const wantsProAction = detectProActionIntent(params.question);
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

    const useLlm = this.policyService.canUseFreeformQuestions(flags);
    const selected = await this.toolSelectorService.selectTools({
      enabled: useLlm,
      question: params.question,
    });
    const tools = selected.tools;
    const toolResults = await this.toolRegistry.executeTools(context, tools);
    const phrased = await this.phraserService.phraseAnswer({
      enabled: useLlm,
      locale: 'es-AR',
      question: params.question,
      toolResults,
    });

    let proposedAction = null;
    let answer = phrased.answer;
    if (wantsProAction && this.policyService.canUseProAgent(flags)) {
      proposedAction = await this.actionService.proposeAction(context);
      if (proposedAction) {
        answer = `${answer}\n\n${proposedAction.summary}. ¿Confirmo la acción?`;
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
  }): Promise<string> {
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

    return userData.user.id;
  }
}
