import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

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

  const onVisionSummary = useCallback(
    async (summary: string) => {
      router.push(routes.appCopiChat);
      await copilot.askQuestion(`Analicé una imagen: ${summary}`);
    },
    [copilot, router],
  );

  const media = useCopiMediaActions({
    canUseVision,
    canUseVoice,
    onVisionSummary,
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
      onPressAttachCamera: media.onPressAttachCamera,
      onPressAttachLibrary: media.onPressAttachLibrary,
      onPressPlus: media.onPressPlus,
      onPressVoice: media.onPressVoice,
    }),
    [canUseVision, canUseVoice, media],
  );

  async function handleAsk(question: string): Promise<void> {
    await copilot.askQuestion(question);
  }

  return (
    <CopiScreen
      composer={composer}
      metrics={dashboard?.metrics ?? null}
      onAskQuestion={handleAsk}
      onOpenChat={() => router.push(routes.appCopiChat)}
      questionDraft={draft}
      setQuestionDraft={setDraft}
    />
  );
}
