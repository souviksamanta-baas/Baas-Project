import { Injectable } from '@nestjs/common';

import { CopiPolicyService } from './copi-policy.service';
import type { CopiFeatureFlags } from './copi.types';

function voiceFilenameForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('m4a') || normalized.includes('mp4')) {
    return 'voice.m4a';
  }
  if (normalized.includes('caf')) {
    return 'voice.m4a';
  }
  if (normalized.includes('wav')) {
    return 'voice.wav';
  }
  if (normalized.includes('mpeg') || normalized.includes('mp3')) {
    return 'voice.mp3';
  }
  return 'voice.webm';
}

@Injectable()
export class CopiVoiceService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async transcribe(params: {
    audioBase64: string;
    featureFlags: CopiFeatureFlags;
    mimeType: string;
  }): Promise<{ text: string }> {
    const audioBuffer = Buffer.from(params.audioBase64, 'base64');
    return this.transcribeBuffer({
      audioBuffer,
      featureFlags: params.featureFlags,
      mimeType: params.mimeType,
    });
  }

  async transcribeBuffer(params: {
    audioBuffer: Buffer;
    featureFlags: CopiFeatureFlags;
    mimeType: string;
  }): Promise<{ text: string }> {
    if (!this.policyService.canUseFeature(params.featureFlags, 'copi_voice')) {
      throw new Error('La voz de Copi requiere Copi Pro.');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { text: 'Transcripción de voz no disponible: falta configuración del proveedor.' };
    }

    const audioBuffer = params.audioBuffer;
    if (audioBuffer.length < 400) {
      return { text: '' };
    }

    const mimeType = params.mimeType.trim() || 'audio/webm';
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
      voiceFilenameForMime(mimeType),
    );
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      body: form,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`No se pudo transcribir el audio (${response.status}): ${errorBody.slice(0, 120)}`);
    }

    const body = (await response.json()) as { text?: string };
    return { text: body.text?.trim() || '' };
  }
}
