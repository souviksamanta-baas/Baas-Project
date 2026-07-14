import { Injectable, Logger } from '@nestjs/common';

import {
  buildIntentQuestion,
  sanitizeSelectedTools,
  selectCopiTools,
  type CopiConversationTurn,
} from './copi-intent-router';
import type { CopiToolName } from './copi.types';
import { buildCopiSystemPrompt } from './prompts/copi-prompt-composer';

@Injectable()
export class CopiLlmToolSelectorService {
  private readonly logger = new Logger(CopiLlmToolSelectorService.name);

  async selectTools(params: {
    enabled: boolean;
    history?: CopiConversationTurn[];
    question: string;
  }): Promise<{ source: 'llm' | 'rules'; tools: CopiToolName[] }> {
    const history = params.history ?? [];
    const rulesTools = selectCopiTools(params.question, history);

    if (!params.enabled) {
      return { source: 'rules', tools: rulesTools };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      this.logger.warn(
        'Copi tool selector is using rule-based routing because OPENAI_API_KEY is not set. Natural intent detection requires this env var.',
      );
      return { source: 'rules', tools: rulesTools };
    }

    const questionWithContext = buildIntentQuestion(params.question, history);
    const recentHistory = history.slice(-6);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 180,
          messages: [
            {
              content: buildCopiSystemPrompt('router'),
              role: 'system',
            },
            {
              content: JSON.stringify({
                history: recentHistory,
                question: params.question,
                questionWithContext,
              }),
              role: 'user',
            },
          ],
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `Copi tool selector OpenAI request failed (${response.status} ${response.statusText}); falling back to rules. ${errorBody.slice(0, 500)}`,
        );
        return { source: 'rules', tools: rulesTools };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content?.trim() ?? '';
      const llmTools = sanitizeSelectedTools(parseToolsJson(content));

      return reconcileToolSelection(llmTools, rulesTools);
    } catch (error) {
      this.logger.error(
        `Copi tool selector OpenAI request threw; falling back to rules. ${error instanceof Error ? error.message : String(error)}`,
      );
      return { source: 'rules', tools: rulesTools };
    }
  }
}

/**
 * LLM-first for natural language. Rules only patch known failure modes
 * (empty selection, or vague attention_summary when a specific tool matches).
 */
export function reconcileToolSelection(
  llmTools: CopiToolName[],
  rulesTools: CopiToolName[],
): { source: 'llm' | 'rules'; tools: CopiToolName[] } {
  const llmIsVague =
    llmTools.length === 0 ||
    (llmTools.length === 1 && llmTools[0] === 'attention_summary') ||
    (llmTools.includes('attention_summary') &&
      rulesTools.length > 0 &&
      !rulesTools.includes('attention_summary'));

  if (llmTools.length > 0 && !llmIsVague) {
    return { source: 'llm', tools: llmTools };
  }

  if (rulesTools.length > 0) {
    return { source: 'rules', tools: rulesTools };
  }

  if (llmTools.length > 0) {
    return { source: 'llm', tools: llmTools };
  }

  return { source: 'rules', tools: [] };
}

function parseToolsJson(content: string): unknown {
  const fenced = content.match(/\{[\s\S]*\}/);
  if (!fenced) {
    return null;
  }

  try {
    const parsed = JSON.parse(fenced[0]) as { tools?: unknown };
    return parsed.tools ?? null;
  } catch {
    return null;
  }
}
