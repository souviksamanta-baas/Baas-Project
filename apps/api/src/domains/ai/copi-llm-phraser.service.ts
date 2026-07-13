import { Injectable } from '@nestjs/common';

import { buildGreetingReply, hasGreeting } from './copi-intent-router';
import type { CopiTokenUsage, CopiToolResult } from './copi.types';
import { CopiPolicyService } from './copi-policy.service';
import { buildCopiSystemPrompt } from './prompts/copi-prompt-composer';

@Injectable()
export class CopiLlmPhraserService {
  constructor(private readonly policyService: CopiPolicyService) {}

  async phraseAnswer(params: {
    enabled: boolean;
    history?: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
    locale: string;
    ownerDisplayName?: string | null;
    question: string;
    toolResults: CopiToolResult[];
  }): Promise<{ answer: string; tokenUsage: CopiTokenUsage }> {
    const alreadyGreeted = sessionAlreadyGreeted(params.history ?? []);
    if (!params.enabled) {
      return {
        answer: buildTemplateAnswer(
          params.question,
          params.toolResults,
          alreadyGreeted,
          params.ownerDisplayName,
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        answer: buildTemplateAnswer(
          params.question,
          params.toolResults,
          alreadyGreeted,
          params.ownerDisplayName,
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const recentHistory = (params.history ?? []).slice(-6);
    const inputText = JSON.stringify({
      alreadyGreetedInSession: alreadyGreeted,
      history: recentHistory,
      locale: params.locale,
      ownerDisplayName: params.ownerDisplayName ?? null,
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
              content: buildCopiSystemPrompt('phraser'),
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
          answer: buildTemplateAnswer(
            params.question,
            params.toolResults,
            alreadyGreeted,
            params.ownerDisplayName,
          ),
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
          buildTemplateAnswer(
            params.question,
            params.toolResults,
            alreadyGreeted,
            params.ownerDisplayName,
          ),
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? estimatedInput,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch {
      return {
        answer: buildTemplateAnswer(
          params.question,
          params.toolResults,
          alreadyGreeted,
          params.ownerDisplayName,
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }
  }
}

function sessionAlreadyGreeted(
  history: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>,
): boolean {
  return history.some((message) => {
    if (message.role !== 'assistant') {
      return false;
    }

    return /¡?(hola|buen d[ií]a|buenas tardes|buenas noches)/i.test(message.body);
  });
}

function buildTemplateAnswer(
  question: string,
  toolResults: CopiToolResult[],
  alreadyGreeted: boolean,
  ownerDisplayName?: string | null,
): string {
  const body = toolResults.map((result) => result.summary).join('\n\n');
  if (!body) {
    if (alreadyGreeted || !hasGreeting(question)) {
      return 'No encontré datos para esa consulta. Podés preguntarme por atención del día, ventas, stock, vencimientos de lote, conversaciones o seguimientos.';
    }
  }

  if (alreadyGreeted || !hasGreeting(question)) {
    return body;
  }

  const greeting = buildGreetingReply(question, new Date(), ownerDisplayName);
  return [greeting, body].filter(Boolean).join('\n\n');
}
