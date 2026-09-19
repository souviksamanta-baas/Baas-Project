import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  DEFAULT_COPI_FEATURE_FLAGS,
  type CopiFeatureFlag,
  type CopiFeatureFlags,
  type CopiPolicyDecision,
  type CopiTokenUsage,
} from './copi.types';

@Injectable()
export class CopiPolicyService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async loadFeatureFlags(organizationId: string): Promise<CopiFeatureFlags> {
    const orgFlags = await this.loadOrganizationFeatureFlags(organizationId);
    return {
      ...DEFAULT_COPI_FEATURE_FLAGS,
      copi_basic_reports: Boolean(orgFlags.copi_basic_reports ?? true),
      copi_custom_reports: Boolean(orgFlags.copi_custom_reports ?? true),
      copi_enabled: Boolean(orgFlags.copi_enabled ?? true),
      copi_freeform_questions: Boolean(orgFlags.copi_freeform_questions ?? true),
      copi_pro_agent: Boolean(orgFlags.copi_pro_agent ?? true),
      copi_vision: Boolean(orgFlags.copi_vision ?? true),
      copi_voice: Boolean(orgFlags.copi_voice ?? true),
    };
  }

  /** Full product module flags for the org (appointments, inventory, caja, etc.). */
  async loadOrganizationFeatureFlags(
    organizationId: string,
  ): Promise<Record<string, boolean>> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('feature_flags')
      .eq('id', organizationId)
      .single<{ feature_flags: Record<string, unknown> | null }>();

    if (error) {
      throw new Error(`Failed to load organization feature flags: ${error.message}`);
    }

    const raw = data.feature_flags ?? {};
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'boolean') {
        flags[key] = value;
      }
    }
    return flags;
  }

  assertCopiEnabled(flags: CopiFeatureFlags): CopiPolicyDecision {
    return flags.copi_enabled ? 'allowed' : 'policy_denied';
  }

  canUseBasicReports(flags: CopiFeatureFlags): boolean {
    return flags.copi_enabled && flags.copi_basic_reports;
  }

  canUseFreeformQuestions(flags: CopiFeatureFlags): boolean {
    return flags.copi_enabled && flags.copi_freeform_questions;
  }

  canUseProAgent(flags: CopiFeatureFlags): boolean {
    return flags.copi_enabled && flags.copi_pro_agent;
  }

  canUseFeature(flags: CopiFeatureFlags, feature: CopiFeatureFlag): boolean {
    return Boolean(flags[feature]);
  }

  enforceTokenBudget(params: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    tier: 'basic' | 'pro';
  }): CopiPolicyDecision {
    // Everything-Pro: no Basic token caps; spend is controlled by org OpenAI project limits.
    void params;
    return 'allowed';
  }

  estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  emptyUsage(): CopiTokenUsage {
    return { inputTokens: 0, outputTokens: 0 };
  }
}
