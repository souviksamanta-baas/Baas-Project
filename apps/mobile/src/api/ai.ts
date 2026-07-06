import { supabase } from '../lib/supabase';
import type { AiDraft } from '../types/aiDrafts';
import type { CopilotResponse } from '../types/copilot';
import { apiFetchAuthJson } from './client';

interface AiDraftRow {
  auto_send_eligible: boolean;
  catalog_context: AiDraft['catalogContext'];
  conversation_id: string;
  conversations:
    | {
        customer_display_name: string | null;
        external_contact_id: string;
        contacts:
          | {
              display_name: string | null;
              phone_number: string | null;
            }
          | Array<{
              display_name: string | null;
              phone_number: string | null;
            }>
          | null;
      }
    | Array<{
        customer_display_name: string | null;
        external_contact_id: string;
        contacts:
          | {
              display_name: string | null;
              phone_number: string | null;
            }
          | Array<{
              display_name: string | null;
              phone_number: string | null;
            }>
          | null;
      }>
    | null;
  created_at: string;
  decision_reason: string | null;
  draft_type: 'reply' | 'quote';
  edited_body: string | null;
  error_message: string | null;
  id: string;
  reply_body: string;
  status: AiDraft['status'];
}

export async function askOwnerCopilot(params: {
  businessCenterId?: string | null;
  organizationId: string;
  question: string;
  sessionId?: string | null;
}): Promise<CopilotResponse> {
  return apiFetchAuthJson<CopilotResponse>('/ai/copilot/query', {
    body: JSON.stringify({
      businessCenterId: params.businessCenterId ?? undefined,
      organizationId: params.organizationId,
      question: params.question,
      sessionId: params.sessionId ?? undefined,
    }),
    method: 'POST',
  });
}

export async function confirmCopiAction(params: {
  actionId: string;
  businessCenterId: string;
  organizationId: string;
}): Promise<{ result: Record<string, unknown>; status: 'executed' }> {
  return apiFetchAuthJson(`/ai/copilot/actions/${params.actionId}/confirm`, {
    body: JSON.stringify({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    }),
    method: 'POST',
  });
}

export async function transcribeCopiVoice(params: {
  audioBase64: string;
  mimeType: string;
  organizationId: string;
}): Promise<{ text: string }> {
  return apiFetchAuthJson('/ai/copilot/voice', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function analyzeCopiVision(params: {
  imageBase64: string;
  mimeType: string;
  organizationId: string;
  prompt?: string;
}): Promise<{ extraction: Record<string, unknown>; summary: string }> {
  return apiFetchAuthJson('/ai/copilot/vision', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function runCopiReport(params: {
  businessCenterId: string;
  organizationId: string;
  parameters?: Record<string, unknown>;
  reportKey: string;
}): Promise<Record<string, unknown>> {
  return apiFetchAuthJson('/ai/copilot/reports/run', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function getCopiSessionMessages(params: {
  organizationId: string;
  sessionId: string;
}): Promise<
  Array<{
    body: string;
    createdAt: string;
    id: string;
    role: 'assistant' | 'owner' | 'system';
  }>
> {
  const query = new URLSearchParams({
    organizationId: params.organizationId,
  });
  const response = await apiFetchAuthJson<{
    messages: Array<{
      body: string;
      createdAt: string;
      id: string;
      role: 'assistant' | 'owner' | 'system';
    }>;
  }>(`/ai/copilot/sessions/${params.sessionId}/messages?${query.toString()}`);
  return response.messages;
}

export async function getPendingAiDrafts(
  organizationId: string,
  businessCenterId: string,
): Promise<AiDraft[]> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(
      'id, conversation_id, draft_type, status, reply_body, edited_body, auto_send_eligible, catalog_context, decision_reason, error_message, created_at, conversations(customer_display_name, external_contact_id, contacts(display_name, phone_number))',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .in('status', ['pending_approval', 'failed'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data as AiDraftRow[]).map(toAiDraft);
}

export async function approveAiDraft(params: {
  draftId: string;
  editedBody?: string;
}): Promise<void> {
  await postDraftAction({
    body: params.editedBody ? { body: params.editedBody } : {},
    draftId: params.draftId,
    path: 'approve',
  });
}

export async function rejectAiDraft(draftId: string): Promise<void> {
  await postDraftAction({
    body: {},
    draftId,
    path: 'reject',
  });
}

export function subscribeToAiDraftChanges(
  organizationId: string,
  businessCenterId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`ai-drafts:${organizationId}:${businessCenterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ai_drafts',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

async function postDraftAction(params: {
  body: Record<string, unknown>;
  draftId: string;
  path: 'approve' | 'reject';
}): Promise<void> {
  await apiFetchAuthJson(`/ai/drafts/${params.draftId}/${params.path}`, {
    body: JSON.stringify(params.body),
    method: 'POST',
  });
}

function toAiDraft(row: AiDraftRow): AiDraft {
  const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
  const contact = Array.isArray(conversation?.contacts)
    ? conversation?.contacts[0]
    : conversation?.contacts;

  return {
    autoSendEligible: row.auto_send_eligible,
    catalogContext: row.catalog_context ?? {},
    contactLabel:
      contact?.display_name ??
      contact?.phone_number ??
      conversation?.customer_display_name ??
      conversation?.external_contact_id ??
      'Unknown contact',
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    decisionReason: row.decision_reason,
    draftType: row.draft_type,
    editedBody: row.edited_body,
    errorMessage: row.error_message,
    id: row.id,
    replyBody: row.reply_body,
    status: row.status,
  };
}
