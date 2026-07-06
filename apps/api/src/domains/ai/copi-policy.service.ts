import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  DEFAULT_COPI_FEATURE_FLAGS,
  type CopiFeatureFlag,
  type CopiFeatureFlags,
  type CopiPolicyDecision,
  type CopiTokenUsage,
} from './copi.types';

const BASIC_INPUT_TOKEN_CAP = 2000;
const BASIC_OUTPUT_TOKEN_CAP = 500;

@Injectable()
export class CopiPolicyService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async loadFeatureFlags(organizationId: string): Promise<CopiFeatureFlags> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('feature_flags')
      .eq('id', organizationId)
      .single<{ feature_flags: Partial<CopiFeatureFlags> | null }>();

    if (error) {
      throw new Error(`Failed to load Copi feature flags: ${error.message}`);
    }

    return {
      ...DEFAULT_COPI_FEATURE_FLAGS,
      ...(data.feature_flags ?? {}),
    };
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
    if (params.tier === 'pro') {
      return 'allowed';
    }

    if (
      params.estimatedInputTokens > BASIC_INPUT_TOKEN_CAP ||
      params.estimatedOutputTokens > BASIC_OUTPUT_TOKEN_CAP
    ) {
      return 'policy_denied';
    }

    return 'allowed';
  }

  estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  emptyUsage(): CopiTokenUsage {
    return { inputTokens: 0, outputTokens: 0 };
  }
}
