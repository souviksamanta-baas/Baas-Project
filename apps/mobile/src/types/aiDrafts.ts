export type AiDraftStatus = 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'failed';
export type AiDraftType = 'reply' | 'quote';

export interface AiDraft {
  autoSendEligible: boolean;
  catalogContext: {
    matchedProducts?: Array<{
      currency: string;
      id: string;
      name: string;
      sku: string | null;
      stockQuantity: number;
      unitPriceCents: number;
    }>;
    missingProductQuery?: string | null;
  };
  conversationId: string;
  contactLabel: string;
  createdAt: string;
  decisionReason: string | null;
  draftType: AiDraftType;
  editedBody: string | null;
  errorMessage: string | null;
  id: string;
  replyBody: string;
  status: AiDraftStatus;
}
