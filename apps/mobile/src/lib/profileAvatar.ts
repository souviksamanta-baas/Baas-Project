import * as ImagePicker from 'expo-image-picker';

import { showPermissionDeniedAlert } from './androidPermissions';
import { supabase } from './supabase';

export async function pickAndUploadProfileAvatar(): Promise<string> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showPermissionDeniedAlert('photos', { canAskAgain: permission.canAskAgain !== false });
    throw new Error('Necesitamos acceso a tus fotos para actualizar el perfil.');
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? 'Sesión no disponible.');
  }

  const extension = asset.mimeType?.includes('png')
    ? 'png'
    : asset.mimeType?.includes('webp')
      ? 'webp'
      : 'jpg';
  const contentType = asset.mimeType ?? 'image/jpeg';
  const path = `${user.id}/avatar.${extension}`;

  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      avatar_url: avatarUrl,
    },
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  return avatarUrl;
}

export function readAvatarUrlFromUser(user: {
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): string | null {
  const value = user?.user_metadata?.avatar_url;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
