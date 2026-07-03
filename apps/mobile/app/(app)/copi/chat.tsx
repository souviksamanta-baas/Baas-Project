import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerCopilotContext } from '../../../src/context/OwnerCopilotProvider';
import { routes } from '../../../src/navigation/routes';
import { CopiChatScreen } from '../../../src/screens/CopiScreen';

export default function CopiChatRoute(): ReactElement {
  const router = useRouter();
  const copilot = useOwnerCopilotContext();

  return <CopiChatScreen copilot={copilot} onBack={() => router.replace(routes.appCopi)} />;
}
