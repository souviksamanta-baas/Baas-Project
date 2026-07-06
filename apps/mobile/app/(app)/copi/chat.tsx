import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerCopilotContext } from '../../../src/context/OwnerCopilotProvider';
import { useCopiMediaActions } from '../../../src/hooks/useCopiMediaActions';
import { useFeatureGate } from '../../../src/hooks/useFeatureVisibility';
import { routes } from '../../../src/navigation/routes';
import { CopiChatScreen, type CopiComposerActions } from '../../../src/screens/CopiScreen';

export default function CopiChatRoute(): ReactElement {
  const router = useRouter();
  const copilot = useOwnerCopilotContext();
  const { dashboard } = useOwnerSessionContext();
  const canUseVoice = useFeatureGate('copiVoiceInput');
  const canUseVision = useFeatureGate('copiVisionInput');
  const organizationId = dashboard?.organization?.id ?? null;

  const onVoiceText = useCallback(async (text: string) => {
    await copilot.askQuestion(text);
  }, [copilot]);

  const onVisionSummary = useCallback(async (summary: string) => {
    await copilot.askQuestion(`Analicé una imagen: ${summary}`);
  }, [copilot]);

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

  return <CopiChatScreen composer={composer} copilot={copilot} onBack={() => router.replace(routes.appCopi)} />;
}
