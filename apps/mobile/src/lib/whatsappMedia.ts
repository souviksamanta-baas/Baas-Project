import { supabase } from './supabase';

const WHATSAPP_MEDIA_BUCKET = 'whatsapp-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function resolveWhatsAppMediaUrl(params: {
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
}): Promise<string | null> {
  if (params.mediaUrl?.trim()) {
    return params.mediaUrl.trim();
  }

  const path = params.mediaStoragePath?.trim();
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
