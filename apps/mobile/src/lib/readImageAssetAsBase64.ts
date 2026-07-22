import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';

/** Hermes/RN cannot create Blobs from ArrayBuffer; prefer picker base64 or FileSystem. */
export async function readImageAssetAsBase64(
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
      throw new Error('No se pudo leer la imagen.');
    }
    return { base64, mimeType };
  }

  if (!asset.uri) {
    throw new Error('La imagen no tiene URI.');
  }

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });

  return { base64, mimeType: blob.type || mimeType };
}
