export type CopiQuestionTier = 'copi' | 'copi_pro';

export type CopiSuggestedQuestion = {
  /** Internal license tag — not shown in the client UI. */
  tier: CopiQuestionTier;
  text: string;
};

export const DEFAULT_COPI_SUGGESTED_QUESTIONS: CopiSuggestedQuestion[] = [
  { text: '¿Qué necesita mi atención hoy?', tier: 'copi' },
  { text: '¿Cuántas ventas hubo esta semana?', tier: 'copi' },
  { text: '¿Qué productos tienen bajo stock?', tier: 'copi' },
  { text: '¿Qué seguimientos están pendientes?', tier: 'copi' },
  { text: '¿Cuál es la fecha de vencimiento más cercana?', tier: 'copi' },
  { text: '¿Cuántas conversaciones abiertas tengo?', tier: 'copi' },
  { text: 'Creá una tarea para llamar a un cliente mañana', tier: 'copi_pro' },
  { text: 'Asigná la tarea pendiente al equipo', tier: 'copi_pro' },
];

/** @deprecated Prefer DEFAULT_COPI_SUGGESTED_QUESTIONS */
export const copiSuggestedQuestions = DEFAULT_COPI_SUGGESTED_QUESTIONS.filter(
  (question) => question.tier === 'copi',
).map((question) => question.text);

/** @deprecated Prefer DEFAULT_COPI_SUGGESTED_QUESTIONS */
export const copiProSuggestedQuestions = DEFAULT_COPI_SUGGESTED_QUESTIONS.filter(
  (question) => question.tier === 'copi_pro',
).map((question) => question.text);

export function questionsVisibleForLicense(
  questions: CopiSuggestedQuestion[],
  hasCopiPro: boolean,
): CopiSuggestedQuestion[] {
  return questions.filter((question) => question.tier === 'copi' || hasCopiPro);
}
