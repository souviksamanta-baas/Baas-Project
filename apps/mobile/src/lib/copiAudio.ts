import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';

export function guessAudioMimeType(uri: string, blobType?: string): string {
  const normalizedBlobType = blobType?.trim();
  if (normalizedBlobType && normalizedBlobType !== 'application/octet-stream') {
    return normalizedBlobType.split(';')[0] ?? normalizedBlobType;
  }

  const lower = uri.toLowerCase();
  if (lower.endsWith('.caf')) {
    return 'audio/mp4';
  }
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) {
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

async function readWebAudioAsBase64(uri: string): Promise<{ base64: string; mimeType: string; size: number }> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la grabación de voz.');
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('La grabación de voz quedó vacía.');
  }

  return {
    base64: await blobToBase64(blob),
    mimeType: guessAudioMimeType(uri, blob.type),
    size: blob.size,
  };
}

async function readNativeAudioAsBase64(uri: string): Promise<{ base64: string; mimeType: string; size: number }> {
  const file = new ExpoFile(uri);
  const base64 = await file.base64();
  const size = file.size;

  if (!base64 || size < 1) {
    throw new Error('La grabación de voz quedó vacía.');
  }

  return {
    base64,
    mimeType: guessAudioMimeType(uri, file.type),
    size,
  };
}

export async function readAudioAsBase64(uri: string): Promise<{ base64: string; mimeType: string; size: number }> {
  if (Platform.OS === 'web') {
    return readWebAudioAsBase64(uri);
  }

  return readNativeAudioAsBase64(uri);
}

export async function readAudioBlobAsBase64(blob: Blob, mimeType: string): Promise<{ base64: string; size: number }> {
  if (blob.size === 0) {
    throw new Error('La grabación de voz quedó vacía.');
  }

  return {
    base64: await blobToBase64(blob),
    size: blob.size,
  };
}
