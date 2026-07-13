import { Injectable } from '@nestjs/common';

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
  async selectTools(params: {
    enabled: boolean;
    history?: CopiConversationTurn[];
    question: string;
  }): Promise<{ source: 'llm' | 'rules'; tools: CopiToolName[] }> {
    const history = params.history ?? [];
    const fallback = selectCopiTools(params.question, history);
    if (!params.enabled) {
      return { source: 'rules', tools: fallback };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { source: 'rules', tools: fallback };
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
        return { source: 'rules', tools: fallback };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = parseToolsJson(content);
      const tools = sanitizeSelectedTools(parsed);

      if (tools.length === 0) {
        return { source: 'rules', tools: fallback };
      }

      return { source: 'llm', tools };
    } catch {
      return { source: 'rules', tools: fallback };
    }
  }
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
