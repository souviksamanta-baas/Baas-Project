import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useOwnerCopilotContext } from '../../../src/context/OwnerCopilotProvider';
import { routes } from '../../../src/navigation/routes';
import { CopiScreen } from '../../../src/screens/CopiScreen';

export default function CopiRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const copilot = useOwnerCopilotContext();
  const [draft, setDraft] = useState('');

  async function handleAsk(question: string): Promise<void> {
    await copilot.askQuestion(question);
  }

  return (
    <CopiScreen
      metrics={dashboard?.metrics ?? null}
      onAskQuestion={handleAsk}
      onOpenChat={() => router.push(routes.appCopiChat)}
      questionDraft={draft}
      setQuestionDraft={setDraft}
    />
  );
}
