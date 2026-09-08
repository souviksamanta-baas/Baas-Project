export type LlmCredentialStatus = 'pending' | 'active' | 'failed' | 'revoked';

export interface OrganizationLlmCredentialRow {
  api_key_encrypted: string | null;
  created_at: string;
  id: string;
  last_error: string | null;
  monthly_spend_limit_usd: number | null;
  openai_api_key_id: string | null;
  openai_project_id: string | null;
  openai_service_account_id: string | null;
  organization_id: string;
  provider: 'openai';
  provisioned_at: string | null;
  provisioned_by_user_id: string | null;
  status: LlmCredentialStatus;
  updated_at: string;
}

export interface OrganizationLlmCredentialStatusDto {
  lastError: string | null;
  monthlySpendLimitUsd: number | null;
  openaiProjectId: string | null;
  provisionedAt: string | null;
  status: LlmCredentialStatus | 'missing';
}

/** Default monthly hard spend caps (USD) by plan slug. */
export function defaultSpendLimitUsdForPlan(planSlug: string | null | undefined): number {
  const slug = (planSlug ?? '').trim().toLowerCase();
  if (slug === 'enterprise' || slug === 'max' || slug === 'advanced') {
    return 150;
  }
  return 25;
}
