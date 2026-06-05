export type CopilotMessageRole = 'assistant' | 'owner';

export interface CopilotMessage {
  body: string;
  createdAt: string;
  id: string;
  role: CopilotMessageRole;
}

export interface CopilotResponse {
  answer: string;
  responseTimeMs: number;
  tools: Array<'messages_today' | 'low_stock' | 'pending_follow_ups'>;
}
