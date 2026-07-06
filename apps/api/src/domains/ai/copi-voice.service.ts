import { Injectable } from '@nestjs/common';

import { CopiPolicyService } from './copi-policy.service';
import type { CopiFeatureFlags } from './copi.types';

@Injectable()
export class CopiVoiceService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async transcribe(params: {
    audioBase64: string;
    featureFlags: CopiFeatureFlags;
    mimeType: string;
  }): Promise<{ text: string }> {
    if (!this.policyService.canUseFeature(params.featureFlags, 'copi_voice')) {
      throw new Error('Copi voice requires the copi_voice feature flag');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { text: 'Transcripción de voz no disponible: falta configuración del proveedor.' };
    }

    const audioBuffer = Buffer.from(params.audioBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: params.mimeType }), 'voice.webm');
    form.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      body: form,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to transcribe Copi voice note');
    }

    const body = (await response.json()) as { text?: string };
    return { text: body.text?.trim() || '' };
  }
}
