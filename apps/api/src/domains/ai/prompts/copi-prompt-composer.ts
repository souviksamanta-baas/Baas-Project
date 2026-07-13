import { COPI_BUSINESS_CONTEXT_PROMPT } from './copi-business-context.prompt';
import { COPI_SYSTEM_PROMPT } from './copi-system.prompt';
import { COPI_TOOLS_PROMPT } from './copi-tools.prompt';

export type CopiPromptLayer = 'router' | 'phraser';

export function buildCopiSystemPrompt(layer: CopiPromptLayer): string {
  const layerHint =
    layer === 'router'
      ? [
          '# CURRENT TASK',
          'You are selecting tools only for a natural-language owner question.',
          'Understand intent in Argentine Spanish (including typos/informal phrasing).',
          'Map the ask to the most SPECIFIC live tool(s) — do not hardcode example phrases only.',
          'Use `attention_summary` ONLY when the owner asks for a general “qué atender / prioridales / resumen del día”.',
          'Never use `attention_summary` for a specific fact (ventas, stock, vencimientos, conversaciones, tareas, mensajes).',
          'If they only greet with no ask, return {"tools":[]}.',
          'Return ONLY JSON: {"tools":["tool_name"]}.',
          'Do not answer the user in natural language.',
        ].join('\n')
      : [
          '# CURRENT TASK',
          'You are writing the final answer the owner will read in the Copi chat.',
          'Use SYSTEM + BUSINESS CONTEXT + TOOL RESULTS.',
          'Answer in Argentine Spanish, natural and concise.',
          'Use ONLY facts from toolResults / history. Never invent numbers.',
          'If history shows the assistant already greeted in this session, do not greet again unless the owner greets you.',
          'If this is the first owner turn and they greet you, greet back once then answer.',
          'When greeting and ownerDisplayName is present, address them by that first name (e.g. ¡Hola, Ana!).',
          'If responseMode is count, give count + total. If detail, list products.',
          'At most one short optional next-step suggestion at the end.',
        ].join('\n');

  return [COPI_SYSTEM_PROMPT, COPI_BUSINESS_CONTEXT_PROMPT, COPI_TOOLS_PROMPT, layerHint].join(
    '\n\n---\n\n',
  );
}

export { COPI_BUSINESS_CONTEXT_PROMPT, COPI_SYSTEM_PROMPT, COPI_TOOLS_PROMPT };
