import { Injectable } from '@nestjs/common';

import { buildGreetingReply } from './copi-intent-router';
import type { CopiTokenUsage, CopiToolResult } from './copi.types';
import { CopiPolicyService } from './copi-policy.service';

@Injectable()
export class CopiLlmPhraserService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async phraseAnswer(params: {
    enabled: boolean;
    history?: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
    locale: string;
    question: string;
    toolResults: CopiToolResult[];
  }): Promise<{ answer: string; tokenUsage: CopiTokenUsage }> {
    if (!params.enabled) {
      return {
        answer: buildTemplateAnswer(params.question, params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        answer: buildTemplateAnswer(params.question, params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const recentHistory = (params.history ?? []).slice(-6);
    const inputText = JSON.stringify({
      history: recentHistory,
      locale: params.locale,
      question: params.question,
      toolResults: params.toolResults.map((result) => ({
        key: result.key,
        payload: result.payload,
        summary: result.summary,
      })),
    });

    const estimatedInput = this.policyService.estimateTokens(inputText);
    const budgetDecision = this.policyService.enforceTokenBudget({
      estimatedInputTokens: estimatedInput,
      estimatedOutputTokens: 500,
      tier: 'basic',
    });

    if (budgetDecision === 'policy_denied') {
      return {
        answer: 'Tu consulta supera el límite del plan Basic. Probá una pregunta más corta o activá Copi Pro.',
        tokenUsage: { inputTokens: estimatedInput, outputTokens: 0 },
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 500,
          messages: [
            {
              content: [
                'Sos Copi, asistente de negocio de Nexolia para dueños argentino/rioplatenses.',
                'Hablá natural, cálido y claro (vos, dale, mirá), sin sonar robótico ni técnico.',
                'Usá SOLO los datos de toolResults. No inventes cifras, nombres ni hechos.',
                '',
                'Toque humano:',
                '- Si el dueño saluda (Hola, Buenas tardes, Buenas noches, Buen día), devolvé el saludo antes de la data.',
                '- Respondé al sentido de la pregunta, no vuelques data de más.',
                '- Si es un follow-up ("más detalles", "cuáles son los productos"), respondé sobre el mismo tema del mensaje anterior.',
                '',
                'Ventas (importante):',
                '- En este producto las "ventas" son movimientos de venta del inventario. Si dicen "presupuestos de ventas" en sentido de "cuántas ventas hice", respondé con el conteo de ventas registradas.',
                '- Si payload.responseMode es "count" o preguntan "cuántos/cuántas/número" (sin pedir detalle), respondé con el número (saleCount) y el total aproximado. NO arames una lista de productos.',
                '- Si responseMode es "detail" o pidieron lista/detalle/productos/cantidades/ganancias, listá productos con cantidad y subtotal, y el total (ganancia aproximada por valor de venta).',
                '- Si payload.filter existe (ej. "granel"), dejá claro que el resultado está filtrado.',
                '- "hasta hoy" es historial acumulado, no solo el día de hoy.',
                '- Si no hay movimientos, decilo claro y ofrecé mirar ayer o un periodo más amplio.',
              ].join('\n'),
              role: 'system',
            },
            {
              content: inputText,
              role: 'user',
            },
          ],
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0.35,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        return {
          answer: buildTemplateAnswer(params.question, params.toolResults),
          tokenUsage: this.policyService.emptyUsage(),
        };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        answer:
          body.choices?.[0]?.message?.content?.trim() ||
          buildTemplateAnswer(params.question, params.toolResults),
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? estimatedInput,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch {
      return {
        answer: buildTemplateAnswer(params.question, params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }
  }
}

function buildTemplateAnswer(question: string, toolResults: CopiToolResult[]): string {
  const greeting = buildGreetingReply(question);
  const body = toolResults.map((result) => result.summary).join('\n\n');
  return greeting ? `${greeting}\n\n${body}` : body;
}
