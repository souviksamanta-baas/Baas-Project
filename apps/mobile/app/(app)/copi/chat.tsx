import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerCopilotContext } from '../../../src/context/OwnerCopilotProvider';
import { useCopiMediaActions } from '../../../src/hooks/useCopiMediaActions';
import { useFeatureGate } from '../../../src/hooks/useFeatureVisibility';
import { routes, productDetailRoute } from '../../../src/navigation/routes';
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

  const media = useCopiMediaActions({
    canUseVision,
    canUseVoice,
    onVoiceText,
    organizationId,
  });

  const handleSend = useCallback(async () => {
    try {
      const resolved = await media.resolveImageAsk(copilot.inputValue);
      await copilot.askQuestion(resolved.question, { imageContext: resolved.imageContext });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo enviar el mensaje';
      Alert.alert('Copi', message);
    }
  }, [copilot, media]);

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

  return (
    <CopiChatScreen
      composer={composer}
      copilot={copilot}
      onBack={() => router.replace(routes.appCopi)}
      onOpenProduct={(productId) => router.push(productDetailRoute(productId, 'copi-chat'))}
      onSend={handleSend}
    />
  );
}
