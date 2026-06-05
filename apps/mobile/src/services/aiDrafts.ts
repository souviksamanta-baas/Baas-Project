import { supabase } from '../lib/supabase';
import type { AiDraft } from '../types/aiDrafts';

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

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function getPendingAiDrafts(organizationId: string): Promise<AiDraft[]> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(
      'id, conversation_id, draft_type, status, reply_body, edited_body, auto_send_eligible, catalog_context, decision_reason, error_message, created_at, conversations(customer_display_name, external_contact_id, contacts(display_name, phone_number))',
    )
    .eq('organization_id', organizationId)
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
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`ai-drafts:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ai_drafts',
        filter: `organization_id=eq.${organizationId}`,
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
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required to send AI-approved replies.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sign in again before sending an AI draft.');
  }

  const response = await fetch(`${apiBaseUrl}/ai/drafts/${params.draftId}/${params.path}`, {
    body: JSON.stringify(params.body),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `AI draft action failed with HTTP ${response.status}`);
  }
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
