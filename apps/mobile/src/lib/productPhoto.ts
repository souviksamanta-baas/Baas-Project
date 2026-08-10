import * as ImagePicker from 'expo-image-picker';

import { showPermissionDeniedAlert } from './androidPermissions';
import { supabase } from './supabase';

/** Split a product name into primary/secondary lines for the beige placeholder thumb. */
export function splitProductThumbLabel(name: string): {
  primary: string;
  secondary?: string;
} {
  const words = name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return { primary: 'PROD' };
  }

  if (words.length === 1) {
    const word = words[0]!;
    if (word.length <= 9) {
      return { primary: word };
    }
    return {
      primary: word.slice(0, 8),
      secondary: word.slice(8, 18),
    };
  }

  return {
    primary: words[0]!.slice(0, 10),
    secondary: words.slice(1).join(' ').slice(0, 16),
  };
}

export async function pickAndUploadProductPhoto(options: {
  organizationId: string;
  productId: string;
}): Promise<string> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showPermissionDeniedAlert('photos', { canAskAgain: permission.canAskAgain !== false });
    throw new Error('Necesitamos acceso a tus fotos para actualizar el producto.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error('CANCELLED');
  }

  const asset = result.assets[0];
  const extension = asset.mimeType?.includes('png')
    ? 'png'
    : asset.mimeType?.includes('webp')
      ? 'webp'
      : 'jpg';
  const contentType = asset.mimeType ?? 'image/jpeg';
  const path = `${options.organizationId}/${options.productId}/photo.${extension}`;

  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from('product-photos').upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('product-photos').getPublicUrl(path);
  const imageUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('products')
    .update({ image_url: imageUrl })
    .eq('id', options.productId)
    .eq('organization_id', options.organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return imageUrl;
}
