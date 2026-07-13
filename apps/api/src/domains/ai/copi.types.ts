export type CopiFeatureFlag =
  | 'copi_enabled'
  | 'copi_basic_reports'
  | 'copi_freeform_questions'
  | 'copi_pro_agent'
  | 'copi_voice'
  | 'copi_vision'
  | 'copi_custom_reports';

export type CopiToolName =
  | 'messages_today'
  | 'low_stock'
  | 'pending_follow_ups'
  | 'sales_summary'
  | 'sales_today'
  | 'sales_yesterday'
  | 'open_conversations'
  | 'pending_ai_drafts'
  | 'products_overview'
  | 'attention_summary'
  | 'expiring_lots'
  | 'tasks_overview'
  | 'tasks_due_today'
  | 'tasks_overdue'
  | 'tasks_by_contact'
  | 'my_tasks'
  | 'staff_roster';

export type CopiActionType =
  | 'create_task'
  | 'assign_task'
  | 'complete_task'
  | 'snooze_task'
  | 'cancel_task'
  | 'reassign_task';

export type CopiPolicyDecision = 'allowed' | 'policy_denied' | 'tier_required';

export interface CopiFeatureFlags {
  copi_enabled: boolean;
  copi_basic_reports: boolean;
  copi_freeform_questions: boolean;
  copi_pro_agent: boolean;
  copi_voice: boolean;
  copi_vision: boolean;
  copi_custom_reports: boolean;
}

export interface CopiTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CopiActionProposal {
  actionType: CopiActionType;
  id: string;
  payload: Record<string, unknown>;
  summary: string;
}

export interface OwnerCopilotResponse {
  answer: string;
  policyDecision: CopiPolicyDecision;
  proposedAction: CopiActionProposal | null;
  responseTimeMs: number;
  sessionId: string;
  tier: 'basic' | 'pro';
  tokenUsage: CopiTokenUsage;
  tools: CopiToolName[];
}

export const DEFAULT_COPI_FEATURE_FLAGS: CopiFeatureFlags = {
  copi_basic_reports: true,
  copi_custom_reports: false,
  copi_enabled: true,
  copi_freeform_questions: true,
  copi_pro_agent: false,
  copi_vision: false,
  copi_voice: false,
};

export interface CopiQueryContext {
  authorizationHeader: string | undefined;
  businessCenterId: string;
  conversationHistory: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
  now: Date;
  organizationId: string;
  /** First name from auth user_metadata.full_name when available. */
  ownerDisplayName: string | null;
  question: string;
  sessionId?: string;
  timezone: string;
  userId: string;
}

export interface CopiToolResult {
  key: CopiToolName;
  payload: Record<string, unknown>;
  summary: string;
}
