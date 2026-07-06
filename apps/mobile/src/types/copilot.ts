export type CopilotMessageRole = 'assistant' | 'owner';

export interface CopilotMessage {
  body: string;
  createdAt: string;
  id: string;
  proposedActionId?: string | null;
  proposedActionSummary?: string | null;
  role: CopilotMessageRole;
}

export interface CopilotActionProposal {
  actionType: string;
  id: string;
  payload: Record<string, unknown>;
  summary: string;
}

export interface CopilotResponse {
  answer: string;
  policyDecision: 'allowed' | 'policy_denied' | 'tier_required';
  proposedAction: CopilotActionProposal | null;
  responseTimeMs: number;
  sessionId: string;
  tier: 'basic' | 'pro';
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  tools: string[];
}
