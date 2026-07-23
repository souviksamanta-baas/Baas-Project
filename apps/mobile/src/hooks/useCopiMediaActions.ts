import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { analyzeCopiVision, transcribeCopiVoiceBlob, transcribeCopiVoiceFile } from '../api/ai';
import { guessAudioMimeType } from '../lib/copiAudio';
import {
  resolvePreferredAudioConstraints,
  shouldPreferMediaRecorderOverSpeech,
} from '../lib/copiWebMic';
import { getWebSpeechRecognition, isWebSpeechRecognitionSupported, type WebSpeechRecognition } from '../lib/copiWebSpeech';

function pickWebRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return 'audio/webm';
}

/** Hermes/RN cannot create Blobs from ArrayBuffer; avoid fetch(uri).blob() on native. */
async function readImageAssetAsBase64(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ base64: string; mimeType: string }> {
  const mimeType = asset.mimeType ?? 'image/jpeg';

  if (asset.base64?.trim()) {
    return { base64: asset.base64.trim(), mimeType };
  }

  if (Platform.OS !== 'web' && asset.uri) {
    const file = new ExpoFile(asset.uri);
    const base64 = await file.base64();
    if (!base64) {
      throw new Error('No se pudo leer la imagen');
    }
    return { base64, mimeType: asset.mimeType ?? file.type ?? 'image/jpeg' };
  }

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen');
  }
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer la imagen'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });

  if (!base64) {
    throw new Error('No se pudo leer la imagen');
  }

  return { base64, mimeType: asset.mimeType ?? (blob.type || 'image/jpeg') };
}

export type CopiPendingImage = {
  base64: string;
  mimeType: string;
  uri: string;
};

export function useCopiMediaActions(params: {
  canUseVision: boolean;
  canUseVoice: boolean;
  onVoiceText: (text: string) => Promise<void>;
  organizationId: string | null;
}): {
  attachmentMenuOpen: boolean;
  clearPendingImage: () => void;
  closeAttachmentMenu: () => void;
  isAnalyzingImage: boolean;
  isRecordingVoice: boolean;
  isTranscribingVoice: boolean;
  onPressAttachCamera: () => void;
  onPressAttachLibrary: () => void;
  onPressPlus: () => void;
  onPressVoice: () => void;
  pendingImage: CopiPendingImage | null;
  resolveImageAsk: (draft: string) => Promise<{ imageContext?: string; question: string }>;
} {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<CopiPendingImage | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef('audio/webm');
  const webSpeechRef = useRef<WebSpeechRecognition | null>(null);
  const webSpeechTranscriptRef = useRef('');
  const onVoiceTextRef = useRef(params.onVoiceText);
  const organizationIdRef = useRef(params.organizationId);

  onVoiceTextRef.current = params.onVoiceText;
  organizationIdRef.current = params.organizationId;

  const closeAttachmentMenu = useCallback(() => {
    setAttachmentMenuOpen(false);
  }, []);

  const stopWebStream = useCallback(() => {
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
  }, []);

  const deliverTranscript = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Copi voz', 'No se entendió el audio. Probá de nuevo hablando más cerca del micrófono.');
      return;
    }

    await onVoiceTextRef.current(trimmed);
  }, []);

  const transcribeUploadedAudio = useCallback(
    async (upload: { blob?: Blob; mimeType: string; uri?: string }): Promise<void> => {
      const organizationId = organizationIdRef.current;
      if (!organizationId) {
        Alert.alert('Copi voz', 'No encontramos tu organización. Volvé a iniciar sesión.');
        return;
      }

      setIsTranscribingVoice(true);
      try {
        const result = upload.uri
          ? await transcribeCopiVoiceFile({
              mimeType: upload.mimeType,
              organizationId,
              uri: upload.uri,
            })
          : await transcribeCopiVoiceBlob({
              blob: upload.blob!,
              mimeType: upload.mimeType,
              organizationId,
            });

        await deliverTranscript(result.text);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
        Alert.alert('Copi voz', message);
      } finally {
        setIsTranscribingVoice(false);
        setIsRecordingVoice(false);
      }
    },
    [deliverTranscript],
  );

  const stopWebSpeech = useCallback(() => {
    const recognition = webSpeechRef.current;
    webSpeechRef.current = null;
    recognition?.stop();
  }, []);

  const stopWebMediaRecording = useCallback(async (): Promise<void> => {
    const recorder = webRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      stopWebStream();
      setIsRecordingVoice(false);
      return;
    }

    const mimeType = webMimeTypeRef.current;
    try {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          stopWebStream();
          resolve();
        };
        if (recorder.state === 'recording') {
          recorder.requestData();
        }
        recorder.stop();
      });

      webRecorderRef.current = null;
      const blob = new Blob(webChunksRef.current, { type: mimeType.split(';')[0] ?? 'audio/webm' });
      webChunksRef.current = [];

      if (blob.size < 400) {
        Alert.alert('Copi voz', 'La grabación fue muy corta. Mantené el micrófono un poco más.');
        setIsRecordingVoice(false);
        return;
      }

      await transcribeUploadedAudio({
        blob,
        mimeType: guessAudioMimeType('voice.webm', mimeType),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
      Alert.alert('Copi voz', message);
      setIsRecordingVoice(false);
    }
  }, [stopWebStream, transcribeUploadedAudio]);

  const stopNativeRecording = useCallback(async (): Promise<void> => {
    try {
      const durationMillis = recorderState.durationMillis;
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) {
        Alert.alert('Copi voz', 'No se pudo guardar la grabación. Probá de nuevo.');
        setIsRecordingVoice(false);
        return;
      }

      if ((durationMillis ?? 0) < 500) {
        Alert.alert('Copi voz', 'La grabación fue muy corta. Mantené el micrófono un poco más.');
        setIsRecordingVoice(false);
        return;
      }

      await transcribeUploadedAudio({
        mimeType: guessAudioMimeType(uri),
        uri,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
      Alert.alert('Copi voz', message);
      setIsRecordingVoice(false);
    }
  }, [audioRecorder, recorderState.durationMillis, transcribeUploadedAudio]);

  const startWebSpeech = useCallback(() => {
    const recognition = getWebSpeechRecognition();
    if (!recognition) {
      return false;
    }

    webSpeechTranscriptRef.current = '';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-AR';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        parts.push(event.results[index][0]?.transcript ?? '');
      }
      webSpeechTranscriptRef.current = parts.join(' ').trim();
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        Alert.alert('Copi voz', 'No pudimos escuchar el micrófono. Probá de nuevo.');
      }
    };

    recognition.onend = () => {
      webSpeechRef.current = null;
      setIsRecordingVoice(false);
      const transcript = webSpeechTranscriptRef.current.trim();
      if (transcript) {
        void deliverTranscript(transcript);
        return;
      }

      Alert.alert('Copi voz', 'No se entendió el audio. Probá de nuevo hablando más cerca del micrófono.');
    };

    recognition.start();
    webSpeechRef.current = recognition;
    setIsRecordingVoice(true);
    return true;
  }, [deliverTranscript]);

  const startWebMediaRecording = useCallback(async (): Promise<void> => {
    const preferred = await resolvePreferredAudioConstraints();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(preferred.constraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const mimeType = pickWebRecorderMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    webChunksRef.current = [];
    webMimeTypeRef.current = mimeType;
    webStreamRef.current = stream;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        webChunksRef.current.push(event.data);
      }
    };
    recorder.start(250);
    webRecorderRef.current = recorder;
    setIsRecordingVoice(true);
  }, []);

  const onPressPlus = useCallback(() => {
    if (!params.canUseVision) {
      Alert.alert('Copi Pro', 'Adjuntar imágenes requiere Copi Pro.');
      return;
    }
    setAttachmentMenuOpen((open) => !open);
  }, [params.canUseVision]);

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
  }, []);

  const stageAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
      if (!asset.uri) {
        return;
      }

      closeAttachmentMenu();

      try {
        const { base64, mimeType } = await readImageAssetAsBase64(asset);
        setPendingImage({
          base64,
          mimeType,
          uri: asset.uri,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo cargar la imagen';
        Alert.alert('Copi visión', message);
      }
    },
    [closeAttachmentMenu],
  );

  const resolveImageAsk = useCallback(
    async (draft: string): Promise<{ imageContext?: string; question: string }> => {
      const trimmed = draft.trim();
      const hasImage = Boolean(pendingImage);

      if (!trimmed && !hasImage) {
        throw new Error('Escribí un mensaje o adjuntá una imagen.');
      }

      const displayQuestion = hasImage
        ? trimmed
          ? `📷 ${trimmed}`
          : '📷 Analizá esta imagen'
        : trimmed;

      if (!pendingImage) {
        return { question: displayQuestion };
      }

      const organizationId = organizationIdRef.current;
      if (!organizationId) {
        throw new Error('No encontramos tu organización. Volvé a iniciar sesión.');
      }

      setIsAnalyzingImage(true);
      try {
        const prompt = [
          'Sos el asistente visual de un negocio minorista en Argentina.',
          trimmed
            ? `El dueño pregunta: "${trimmed}". Usá la imagen para ayudarlo.`
            : 'Describí productos, cantidades, precios y texto visible.',
          'Respondé en español (es-AR). Preferí JSON con summary, products, amounts y notes.',
        ].join(' ');

        const result = await analyzeCopiVision({
          imageBase64: pendingImage.base64,
          mimeType: pendingImage.mimeType,
          organizationId,
          prompt,
        });
        setPendingImage(null);
        return {
          imageContext: result.summary,
          question: displayQuestion,
        };
      } finally {
        setIsAnalyzingImage(false);
      }
    },
    [pendingImage],
  );

  const onPressAttachCamera = useCallback(() => {
    void (async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showPermissionDeniedAlert('camera', { canAskAgain: permission.canAskAgain !== false });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: true,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      await stageAsset(result.assets[0]);
    })();
  }, [stageAsset]);

  const onPressAttachLibrary = useCallback(() => {
    void (async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showPermissionDeniedAlert('photos', { canAskAgain: permission.canAskAgain !== false });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: true,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      await stageAsset(result.assets[0]);
    })();
  }, [stageAsset]);

  const onPressVoice = useCallback(() => {
    if (!params.canUseVoice) {
      Alert.alert('Copi Pro', 'La voz requiere Copi Pro.');
      return;
    }

    if (isTranscribingVoice) {
      return;
    }

    if (isRecordingVoice) {
      if (webSpeechRef.current) {
        stopWebSpeech();
        return;
      }

      void (Platform.OS === 'web' ? stopWebMediaRecording() : stopNativeRecording());
      return;
    }

    void (async () => {
      if (Platform.OS === 'web') {
        try {
          // Desktop Chrome often defaults to Continuity (iPhone) mic via Web Speech.
          // Prefer MediaRecorder with an explicit local/laptop device instead.
          if (shouldPreferMediaRecorderOverSpeech()) {
            await startWebMediaRecording();
            return;
          }

          if (isWebSpeechRecognitionSupported() && startWebSpeech()) {
            return;
          }

          await startWebMediaRecording();
        } catch {
          stopWebStream();
          Alert.alert('Micrófono', 'No pudimos acceder al micrófono del equipo.');
        }
        return;
      }

      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          showPermissionDeniedAlert('microphone', { canAskAgain: permission.canAskAgain !== false });
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecordingVoice(true);
      } catch {
        Alert.alert('Copi voz', 'No se pudo iniciar la grabación. Probá de nuevo.');
      }
    })();
  }, [
    audioRecorder,
    isRecordingVoice,
    isTranscribingVoice,
    params.canUseVoice,
    startWebMediaRecording,
    startWebSpeech,
    stopNativeRecording,
    stopWebMediaRecording,
    stopWebSpeech,
    stopWebStream,
  ]);

  return {
    attachmentMenuOpen,
    clearPendingImage,
    closeAttachmentMenu,
    isAnalyzingImage,
    isRecordingVoice,
    isTranscribingVoice,
    onPressAttachCamera,
    onPressAttachLibrary,
    onPressPlus,
    onPressVoice,
    pendingImage,
    resolveImageAsk,
  };
}
