import { getAppStorageItem, setAppStorageItem } from './appStorage';
import {
  DEFAULT_COPI_SUGGESTED_QUESTIONS,
  type CopiSuggestedQuestion,
  questionsVisibleForLicense,
} from './copiSuggestedQuestions';

function storageKey(organizationId: string): string {
  return `copi.customQuestions.${organizationId}`;
}

export async function loadCustomCopiQuestions(
  organizationId: string,
): Promise<CopiSuggestedQuestion[]> {
  const raw = await getAppStorageItem(storageKey(organizationId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{ text?: string }>;
    return parsed
      .map((item) => item.text?.trim())
      .filter((text): text is string => Boolean(text))
      .map((text) => ({ text, tier: 'copi_pro' as const }));
  } catch {
    return [];
  }
}

export async function saveCustomCopiQuestions(
  organizationId: string,
  questions: CopiSuggestedQuestion[],
): Promise<void> {
  const payload = questions
    .filter((question) => question.tier === 'copi_pro')
    .map((question) => ({ text: question.text }));
  await setAppStorageItem(storageKey(organizationId), JSON.stringify(payload));
}

export async function listCopiHomeQuestions(params: {
  hasCopiPro: boolean;
  organizationId: string | null;
}): Promise<CopiSuggestedQuestion[]> {
  const custom =
    params.hasCopiPro && params.organizationId
      ? await loadCustomCopiQuestions(params.organizationId)
      : [];

  return questionsVisibleForLicense(
    [...DEFAULT_COPI_SUGGESTED_QUESTIONS, ...custom],
    params.hasCopiPro,
  );
}
