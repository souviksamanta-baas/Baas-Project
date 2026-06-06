import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  approveAiDraft,
  getPendingAiDrafts,
  rejectAiDraft,
  subscribeToAiDraftChanges,
} from '../services/aiDrafts';
import type { AiDraft } from '../types/aiDrafts';

export interface AiDraftsState {
  drafts: AiDraft[];
  editedBodies: Record<string, string>;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  approveDraft: (draftId: string) => Promise<void>;
  rejectDraft: (draftId: string) => Promise<void>;
  setEditedBody: (draftId: string, body: string) => void;
}

export function useAiDrafts(
  organizationId: string | null,
  businessCenterId: string | null,
): AiDraftsState {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadDrafts = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setDrafts([]);
      return;
    }

    const nextDrafts = await getPendingAiDrafts(organizationId, businessCenterId);
    setDrafts(nextDrafts);
    setEditedBodies((currentBodies) => {
      const nextBodies: Record<string, string> = {};

      for (const draft of nextDrafts) {
        nextBodies[draft.id] = currentBodies[draft.id] ?? draft.editedBody ?? draft.replyBody;
      }

      return nextBodies;
    });
  }, [businessCenterId, organizationId]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setDrafts([]);
      setEditedBodies({});
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    loadDrafts()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not load AI drafts', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToAiDraftChanges(organizationId, businessCenterId, () => {
      void loadDrafts();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [businessCenterId, loadDrafts, organizationId]);

  function setEditedBody(draftId: string, body: string): void {
    setEditedBodies((currentBodies) => ({
      ...currentBodies,
      [draftId]: body,
    }));
  }

  async function approveDraft(draftId: string): Promise<void> {
    const editedBody = editedBodies[draftId]?.trim();

    if (!editedBody) {
      Alert.alert('Draft text required', 'Enter reply text before sending.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await approveAiDraft({
        draftId,
        editedBody,
      });
      await loadDrafts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      Alert.alert('Could not send AI draft', message);
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectDraft(draftId: string): Promise<void> {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await rejectAiDraft(draftId);
      await loadDrafts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      Alert.alert('Could not reject AI draft', message);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    drafts,
    editedBodies,
    errorMessage,
    isLoading,
    isSaving,
    approveDraft,
    rejectDraft,
    setEditedBody,
  };
}
