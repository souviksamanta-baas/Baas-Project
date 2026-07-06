import { Injectable } from '@nestjs/common';

import type { CopiTokenUsage, CopiToolResult } from './copi.types';
import { CopiPolicyService } from './copi-policy.service';

@Injectable()
export class CopiLlmPhraserService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async phraseAnswer(params: {
    enabled: boolean;
    locale: string;
    question: string;
    toolResults: CopiToolResult[];
  }): Promise<{ answer: string; tokenUsage: CopiTokenUsage }> {
    if (!params.enabled) {
      return {
        answer: buildTemplateAnswer(params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        answer: buildTemplateAnswer(params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const inputText = JSON.stringify({
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
              content:
                'Sos Copi, asistente de negocio de Nexolia. Respondé en español rioplatense usando SOLO los datos provistos en toolResults. No inventes cifras, nombres ni hechos. Si el usuario pidió ventas con lista, precios o total y payload.items trae productos, respondé con una lista numerada (producto, cantidad, precio unitario, subtotal) y el total final. No mezcles datos de otras herramientas si la pregunta es sobre ventas.',
              role: 'system',
            },
            {
              content: inputText,
              role: 'user',
            },
          ],
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0.2,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        return {
          answer: buildTemplateAnswer(params.toolResults),
          tokenUsage: this.policyService.emptyUsage(),
        };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        answer: body.choices?.[0]?.message?.content?.trim() || buildTemplateAnswer(params.toolResults),
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? estimatedInput,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch {
      return {
        answer: buildTemplateAnswer(params.toolResults),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }
  }
}

function buildTemplateAnswer(toolResults: CopiToolResult[]): string {
  return toolResults.map((result) => result.summary).join('\n\n');
}
