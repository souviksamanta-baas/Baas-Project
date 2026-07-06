import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { analyzeCopiVision, transcribeCopiVoice } from '../api/ai';

type RecordingRef = Audio.Recording | null;

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el archivo'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
}

export function useCopiMediaActions(params: {
  canUseVision: boolean;
  canUseVoice: boolean;
  onVisionSummary: (summary: string) => Promise<void>;
  onVoiceText: (text: string) => Promise<void>;
  organizationId: string | null;
}): {
  attachmentMenuOpen: boolean;
  closeAttachmentMenu: () => void;
  isAnalyzingImage: boolean;
  isRecordingVoice: boolean;
  isTranscribingVoice: boolean;
  onPressAttachCamera: () => void;
  onPressAttachLibrary: () => void;
  onPressPlus: () => void;
  onPressVoice: () => void;
} {
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const recordingRef = useRef<RecordingRef>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);

  const closeAttachmentMenu = useCallback(() => {
    setAttachmentMenuOpen(false);
  }, []);

  const onPressPlus = useCallback(() => {
    if (!params.canUseVision) {
      Alert.alert('Copi Pro', 'Adjuntar imágenes requiere Copi Pro.');
      return;
    }
    setAttachmentMenuOpen((open) => !open);
  }, [params.canUseVision]);

  const analyzeAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
      if (!params.organizationId || !asset.uri) {
        return;
      }

      setIsAnalyzingImage(true);
      closeAttachmentMenu();

      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const result = await analyzeCopiVision({
          imageBase64: base64,
          mimeType,
          organizationId: params.organizationId,
          prompt: 'Describí productos, cantidades y montos visibles para un negocio minorista.',
        });
        await params.onVisionSummary(result.summary);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo analizar la imagen';
        Alert.alert('Copi visión', message);
      } finally {
        setIsAnalyzingImage(false);
      }
    },
    [closeAttachmentMenu, params],
  );

  const onPressAttachCamera = useCallback(() => {
    void (async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso de cámara para sacar una foto.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      await analyzeAsset(result.assets[0]);
    })();
  }, [analyzeAsset]);

  const onPressAttachLibrary = useCallback(() => {
    void (async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Fotos', 'Necesitamos permiso para elegir una imagen.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      await analyzeAsset(result.assets[0]);
    })();
  }, [analyzeAsset]);

  const stopNativeRecording = useCallback(async (): Promise<void> => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      return;
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri || !params.organizationId) {
      return;
    }

    setIsTranscribingVoice(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const result = await transcribeCopiVoice({
        audioBase64: base64,
        mimeType: 'audio/m4a',
        organizationId: params.organizationId,
      });
      if (result.text.trim()) {
        await params.onVoiceText(result.text.trim());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
      Alert.alert('Copi voz', message);
    } finally {
      setIsTranscribingVoice(false);
      setIsRecordingVoice(false);
    }
  }, [params]);

  const stopWebRecording = useCallback(async (): Promise<void> => {
    const recorder = webRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecordingVoice(false);
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    webRecorderRef.current = null;
    const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
    webChunksRef.current = [];

    if (!params.organizationId) {
      setIsRecordingVoice(false);
      return;
    }

    setIsTranscribingVoice(true);
    try {
      const base64 = await blobToBase64(blob);
      const result = await transcribeCopiVoice({
        audioBase64: base64,
        mimeType: 'audio/webm',
        organizationId: params.organizationId,
      });
      if (result.text.trim()) {
        await params.onVoiceText(result.text.trim());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
      Alert.alert('Copi voz', message);
    } finally {
      setIsTranscribingVoice(false);
      setIsRecordingVoice(false);
    }
  }, [params]);

  const onPressVoice = useCallback(() => {
    if (!params.canUseVoice) {
      Alert.alert('Copi Pro', 'La voz requiere Copi Pro.');
      return;
    }

    if (isRecordingVoice) {
      void (Platform.OS === 'web' ? stopWebRecording() : stopNativeRecording());
      return;
    }

    void (async () => {
      if (Platform.OS === 'web') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          webChunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              webChunksRef.current.push(event.data);
            }
          };
          recorder.start();
          webRecorderRef.current = recorder;
          setIsRecordingVoice(true);
        } catch {
          Alert.alert('Micrófono', 'No pudimos acceder al micrófono.');
        }
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Micrófono', 'Necesitamos permiso de micrófono para grabar.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecordingVoice(true);
    })();
  }, [isRecordingVoice, params.canUseVoice, stopNativeRecording, stopWebRecording]);

  return {
    attachmentMenuOpen,
    closeAttachmentMenu,
    isAnalyzingImage,
    isRecordingVoice,
    isTranscribingVoice,
    onPressAttachCamera,
    onPressAttachLibrary,
    onPressPlus,
    onPressVoice,
  };
}
