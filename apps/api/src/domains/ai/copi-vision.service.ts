import { Injectable } from '@nestjs/common';

import { CopiPolicyService } from './copi-policy.service';
import type { CopiFeatureFlags } from './copi.types';

@Injectable()
export class CopiVisionService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async extract(params: {
    featureFlags: CopiFeatureFlags;
    imageBase64: string;
    mimeType: string;
    prompt?: string;
  }): Promise<{ extraction: Record<string, unknown>; summary: string }> {
    if (!this.policyService.canUseFeature(params.featureFlags, 'copi_vision')) {
      throw new Error('Copi vision requires the copi_vision feature flag');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        extraction: {},
        summary: 'Análisis de imagen no disponible: falta configuración del proveedor.',
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      body: JSON.stringify({
        max_tokens: 600,
        messages: [
          {
            content: [
              {
                text:
                  params.prompt ??
                  'Extraé datos estructurados de la imagen para operaciones de negocio (productos, tareas, montos). Respondé JSON.',
                type: 'text',
              },
              {
                image_url: {
                  url: `data:${params.mimeType};base64,${params.imageBase64}`,
                },
                type: 'image_url',
              },
            ],
            role: 'user',
          },
        ],
        model: process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini',
        temperature: 0,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to analyze Copi image');
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content?.trim() ?? '{}';

    try {
      const extraction = JSON.parse(content) as Record<string, unknown>;
      return {
        extraction,
        summary: 'Imagen analizada. Copi puede proponer acciones con confirmación.',
      };
    } catch {
      return {
        extraction: { rawText: content },
        summary: content,
      };
    }
  }
}
