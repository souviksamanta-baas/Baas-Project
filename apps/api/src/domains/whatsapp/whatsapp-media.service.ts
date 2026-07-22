import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

const WHATSAPP_MEDIA_BUCKET = 'whatsapp-media';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface MetaMediaMetadataResponse {
  url?: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  id?: string;
  error?: { message?: string };
}

interface MetaMediaUploadResponse {
  id?: string;
  error?: { message?: string };
}

export interface StoredWhatsAppMedia {
  mediaMimeType: string;
  mediaStoragePath: string;
  mediaUrl: string;
}

export interface DownloadedWhatsAppMedia {
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  normalizeImageMimeType(mimeType: string | null | undefined): string {
    const normalized = (mimeType ?? 'image/jpeg').trim().toLowerCase();
    if (normalized === 'image/jpg') {
      return 'image/jpeg';
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
      throw new Error('Solo se admiten imágenes JPEG, PNG, WebP o GIF.');
    }
    return normalized;
  }

  decodeBase64Image(params: {
    imageBase64: string;
    mimeType?: string | null;
  }): DownloadedWhatsAppMedia {
    const mimeType = this.normalizeImageMimeType(params.mimeType);
    const cleaned = params.imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleaned) {
      throw new Error('imageBase64 is required');
    }

    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.byteLength === 0) {
      throw new Error('La imagen está vacía.');
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('La imagen supera el límite de 5 MB de WhatsApp.');
    }

    return { buffer, mimeType };
  }

  async downloadFromMeta(params: {
    accessToken: string;
    mediaId: string;
  }): Promise<DownloadedWhatsAppMedia> {
    const metadataResponse = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(params.mediaId)}`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      },
    );
    const metadata = (await metadataResponse.json().catch(() => ({}))) as MetaMediaMetadataResponse;

    if (!metadataResponse.ok || !metadata.url) {
      throw new Error(
        metadata.error?.message ??
          `No se pudo obtener la URL del media de WhatsApp (HTTP ${metadataResponse.status}).`,
      );
    }

    const binaryResponse = await fetch(metadata.url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    });

    if (!binaryResponse.ok) {
      throw new Error(
        `No se pudo descargar el media de WhatsApp (HTTP ${binaryResponse.status}).`,
      );
    }

    const arrayBuffer = await binaryResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('La imagen recibida supera el límite de 5 MB.');
    }

    const mimeType = this.normalizeImageMimeType(
      metadata.mime_type ?? binaryResponse.headers.get('content-type'),
    );

    return { buffer, mimeType };
  }

  async uploadToMeta(params: {
    accessToken: string;
    buffer: Buffer;
    filename?: string;
    mimeType: string;
    phoneNumberId: string;
  }): Promise<string> {
    const mimeType = this.normalizeImageMimeType(params.mimeType);
    const filename = params.filename ?? `image.${this.extensionForMime(mimeType)}`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([new Uint8Array(params.buffer)], { type: mimeType }), filename);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(params.phoneNumberId)}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
        body: form,
      },
    );

    const body = (await response.json().catch(() => ({}))) as MetaMediaUploadResponse;
    if (!response.ok || !body.id) {
      throw new Error(
        body.error?.message ?? `WhatsApp media upload failed with HTTP ${response.status}`,
      );
    }

    return body.id;
  }

  async storeMedia(params: {
    buffer: Buffer;
    businessCenterId: string;
    conversationId: string;
    messageId: string;
    mimeType: string;
    organizationId: string;
  }): Promise<StoredWhatsAppMedia> {
    const mimeType = this.normalizeImageMimeType(params.mimeType);
    const extension = this.extensionForMime(mimeType);
    const mediaStoragePath = [
      params.organizationId,
      params.businessCenterId,
      params.conversationId,
      `${params.messageId}.${extension}`,
    ].join('/');

    const client = this.supabaseService.getServiceRoleClient();
    const { error: uploadError } = await client.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .upload(mediaStoragePath, params.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to store WhatsApp media: ${uploadError.message}`);
    }

    const { data: signed, error: signedError } = await client.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(mediaStoragePath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw new Error(
        `Failed to sign WhatsApp media URL: ${signedError?.message ?? 'unknown error'}`,
      );
    }

    return {
      mediaMimeType: mimeType,
      mediaStoragePath,
      mediaUrl: signed.signedUrl,
    };
  }

  async refreshSignedUrl(mediaStoragePath: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(mediaStoragePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp.media.sign_failed',
          message: error?.message ?? 'missing signed url',
          mediaStoragePath,
        }),
      );
      return null;
    }

    return data.signedUrl;
  }

  extensionForMime(mimeType: string): string {
    switch (this.normalizeImageMimeType(mimeType)) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return 'jpg';
    }
  }
}
