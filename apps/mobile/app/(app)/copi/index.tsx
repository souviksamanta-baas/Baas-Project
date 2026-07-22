import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerCopilotContext } from '../../../src/context/OwnerCopilotProvider';
import { useCopiMediaActions } from '../../../src/hooks/useCopiMediaActions';
import { useFeatureGate } from '../../../src/hooks/useFeatureVisibility';
import { routes } from '../../../src/navigation/routes';
import { CopiScreen, type CopiComposerActions } from '../../../src/screens/CopiScreen';

export default function CopiRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const copilot = useOwnerCopilotContext();
  const [draft, setDraft] = useState('');
  const canUseVoice = useFeatureGate('copiVoiceInput');
  const canUseVision = useFeatureGate('copiVisionInput');
  const organizationId = dashboard?.organization?.id ?? null;

  const onVoiceText = useCallback(
    async (text: string) => {
      router.push(routes.appCopiChat);
      await copilot.askQuestion(text);
    },
    [copilot, router],
  );

  const media = useCopiMediaActions({
    canUseVision,
    canUseVoice,
    onVoiceText,
    organizationId,
  });

  const composer = useMemo<CopiComposerActions>(
    () => ({
      attachmentMenuOpen: media.attachmentMenuOpen,
      canUseVision,
      canUseVoice,
      isAnalyzingImage: media.isAnalyzingImage,
      isRecordingVoice: media.isRecordingVoice,
      isTranscribingVoice: media.isTranscribingVoice,
      onClearPendingImage: media.clearPendingImage,
      onPressAttachCamera: media.onPressAttachCamera,
      onPressAttachLibrary: media.onPressAttachLibrary,
      onPressPlus: media.onPressPlus,
      onPressVoice: media.onPressVoice,
      pendingImageUri: media.pendingImage?.uri ?? null,
    }),
    [canUseVision, canUseVoice, media],
  );

  async function handleAsk(question: string, imageContext?: string): Promise<void> {
    await copilot.askQuestion(question, { imageContext });
  }

  return (
    <CopiScreen
      composer={composer}
      metrics={dashboard?.metrics ?? null}
      onAskQuestion={handleAsk}
      onOpenChat={() => router.push(routes.appCopiChat)}
      onResolveImageAsk={media.resolveImageAsk}
      questionDraft={draft}
      setQuestionDraft={setDraft}
    />
  );
}
