import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { analyzeCopiVision, transcribeCopiVoice } from '../api/ai';

type RecordingRef = Audio.Recording | null;

const MIN_AUDIO_BYTES = 400;

const COPI_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    bitRate: 128000,
    extension: '.m4a',
    numberOfChannels: 1,
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    sampleRate: 44100,
  },
  ios: {
    audioQuality: Audio.IOSAudioQuality.HIGH,
    bitRate: 128000,
    extension: '.m4a',
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    numberOfChannels: 1,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    sampleRate: 44100,
  },
  web: {
    bitsPerSecond: 128000,
    mimeType: 'audio/webm',
  },
};

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

function guessAudioMimeType(uri: string, blobType?: string): string {
  const normalizedBlobType = blobType?.trim();
  if (normalizedBlobType) {
    return normalizedBlobType;
  }

  const lower = uri.toLowerCase();
  if (lower.endsWith('.caf')) {
    return 'audio/x-caf';
  }
  if (lower.endsWith('.m4a')) {
    return 'audio/m4a';
  }
  if (lower.endsWith('.webm')) {
    return 'audio/webm';
  }
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  return 'audio/m4a';
}

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

async function readAudioBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la grabación de voz.');
  }

  const blob = await response.blob();
  if (blob.size > 0) {
    return blob;
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.response instanceof Blob && xhr.response.size > 0) {
        resolve(xhr.response);
        return;
      }
      reject(new Error('La grabación de voz quedó vacía.'));
    };
    xhr.onerror = () => reject(new Error('No se pudo leer la grabación de voz.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri);
    xhr.send();
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
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef('audio/webm');

  const closeAttachmentMenu = useCallback(() => {
    setAttachmentMenuOpen(false);
  }, []);

  const stopWebStream = useCallback(() => {
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
  }, []);

  const deliverVoiceTranscription = useCallback(
    async (blob: Blob, mimeType: string): Promise<void> => {
      if (!params.organizationId) {
        Alert.alert('Copi voz', 'No encontramos tu organización. Volvé a iniciar sesión.');
        return;
      }

      if (blob.size < MIN_AUDIO_BYTES) {
        Alert.alert('Copi voz', 'La grabación fue muy corta. Mantené el micrófono un poco más.');
        return;
      }

      setIsTranscribingVoice(true);
      try {
        const base64 = await blobToBase64(blob);
        const result = await transcribeCopiVoice({
          audioBase64: base64,
          mimeType,
          organizationId: params.organizationId,
        });

        const text = result.text.trim();
        if (!text) {
          Alert.alert('Copi voz', 'No se entendió el audio. Probá de nuevo hablando más cerca del micrófono.');
          return;
        }

        await params.onVoiceText(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
        Alert.alert('Copi voz', message);
      } finally {
        setIsTranscribingVoice(false);
        setIsRecordingVoice(false);
      }
    },
    [params],
  );

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
      setIsRecordingVoice(false);
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('Copi voz', 'No se pudo guardar la grabación. Probá de nuevo.');
        setIsRecordingVoice(false);
        return;
      }

      const blob = await readAudioBlob(uri);
      const mimeType = guessAudioMimeType(uri, blob.type);
      await deliverVoiceTranscription(blob, mimeType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo transcribir el audio';
      Alert.alert('Copi voz', message);
      setIsRecordingVoice(false);
    }
  }, [deliverVoiceTranscription]);

  const stopWebRecording = useCallback(async (): Promise<void> => {
    const recorder = webRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      stopWebStream();
      setIsRecordingVoice(false);
      return;
    }

    const mimeType = webMimeTypeRef.current;
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
    await deliverVoiceTranscription(blob, mimeType);
  }, [deliverVoiceTranscription, stopWebStream]);

  const onPressVoice = useCallback(() => {
    if (!params.canUseVoice) {
      Alert.alert('Copi Pro', 'La voz requiere Copi Pro.');
      return;
    }

    if (isTranscribingVoice) {
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
        } catch {
          stopWebStream();
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
      await recording.prepareToRecordAsync(COPI_RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecordingVoice(true);
    })();
  }, [
    isRecordingVoice,
    isTranscribingVoice,
    params.canUseVoice,
    stopNativeRecording,
    stopWebRecording,
    stopWebStream,
  ]);

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
