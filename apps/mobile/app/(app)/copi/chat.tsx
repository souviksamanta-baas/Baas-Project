import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { CopiChatScreen } from '../../../src/screens/CopiScreen';

export default function CopiChatRoute(): ReactElement {
  const router = useRouter();

  return <CopiChatScreen onBack={() => router.replace(routes.appCopi)} />;
}
