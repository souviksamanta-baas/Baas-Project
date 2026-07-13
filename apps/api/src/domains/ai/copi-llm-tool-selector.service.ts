import { Injectable } from '@nestjs/common';

import { COPI_TOOL_CATALOG, sanitizeSelectedTools, selectCopiTools } from './copi-intent-router';
import type { CopiToolName } from './copi.types';

@Injectable()
export class CopiLlmToolSelectorService {
  async selectTools(params: {
    enabled: boolean;
    question: string;
  }): Promise<{ source: 'llm' | 'rules'; tools: CopiToolName[] }> {
    const fallback = selectCopiTools(params.question);
    if (!params.enabled) {
      return { source: 'rules', tools: fallback };
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { source: 'rules', tools: fallback };
    }

    const catalog = COPI_TOOL_CATALOG.map((tool) => `${tool.name}: ${tool.description}`).join('\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 180,
          messages: [
            {
              content: [
                'Sos el router de Copi, asistente de negocio de Nexolia en español rioplatense.',
                'Elegí 1 a 3 herramientas del catálogo para responder la pregunta del dueño.',
                'Reglas importantes:',
                '- "hasta hoy", "todos los productos que vendí", "historial", "en total" => sales_summary (NO sales_today).',
                '- "ventas de hoy" / "qué vendí hoy" (solo el día de hoy) => sales_today.',
                '- "ayer" => sales_yesterday.',
                '- Si pide lista/detalle/precios/total de ventas, elegí la herramienta de ventas correcta; el formateo de la lista lo hace otra capa.',
                '- No inventes herramientas. Devolvé SOLO JSON válido: {"tools":["tool_name"]}.',
                '',
                'Catálogo:',
                catalog,
              ].join('\n'),
              role: 'system',
            },
            {
              content: params.question,
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
