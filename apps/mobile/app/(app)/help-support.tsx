import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { HelpSupportScreen } from '../../src/screens/HelpSupportScreen';

export default function HelpSupportRoute(): ReactElement {
  const router = useRouter();

  return <HelpSupportScreen onBack={() => router.back()} />;
}
