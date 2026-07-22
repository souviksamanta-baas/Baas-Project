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

    const instruction =
      params.prompt?.trim() ||
      [
        'Sos el asistente visual de un negocio minorista en Argentina.',
        'Describí en español (es-AR) lo que se ve en la imagen: productos, marcas, cantidades, precios, códigos o texto legible.',
        'Si no hay datos claros, decí qué tipo de escena es.',
        'Respondé SOLO un JSON con las claves: summary (string corta en español), products (array), amounts (array), notes (string).',
        'No rechaces la solicitud: siempre intentá describir la imagen del negocio.',
      ].join(' ');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      body: JSON.stringify({
        max_tokens: 600,
        messages: [
          {
            content: [
              {
                text: instruction,
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
    const summaryFromText = sanitizeVisionSummary(content);

    try {
      const jsonText = extractJsonObject(content) ?? content;
      const extraction = JSON.parse(jsonText) as Record<string, unknown>;
      const summaryCandidate =
        typeof extraction.summary === 'string' ? extraction.summary.trim() : '';
      return {
        extraction,
        summary: sanitizeVisionSummary(summaryCandidate || summaryFromText),
      };
    } catch {
      return {
        extraction: { rawText: content },
        summary: summaryFromText,
      };
    }
  }
}

function extractJsonObject(content: string): string | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }

  return null;
}

function sanitizeVisionSummary(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Imagen recibida. No pude extraer detalles claros.';
  }

  if (
    /no puedo ayudar|can't help|cannot help|i'?m sorry|lo siento, pero no puedo/i.test(trimmed)
  ) {
    return 'Imagen recibida. No pude extraer detalles útiles; pedime más contexto o otra foto.';
  }

  return trimmed.length > 800 ? `${trimmed.slice(0, 797)}…` : trimmed;
}
