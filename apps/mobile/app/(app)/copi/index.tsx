import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { CopiScreen } from '../../../src/screens/CopiScreen';

export default function CopiRoute(): ReactElement {
  const router = useRouter();

  return <CopiScreen onOpenChat={() => router.push(routes.appCopiChat)} />;
}
