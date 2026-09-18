/**
 * Copi picks OpenAI models in code by call role — not via Railway OPENAI_MODEL.
 */
export type CopiLlmModelRole = 'planner' | 'phrase' | 'whatsapp_draft' | 'vision' | 'router';

const COPI_MODEL_BY_ROLE: Record<CopiLlmModelRole, string> = {
  phrase: 'gpt-4o-mini',
  planner: 'gpt-4o',
  router: 'gpt-4o-mini',
  vision: 'gpt-4o-mini',
  whatsapp_draft: 'gpt-4o-mini',
};

export function resolveCopiModel(role: CopiLlmModelRole): string {
  return COPI_MODEL_BY_ROLE[role];
}
