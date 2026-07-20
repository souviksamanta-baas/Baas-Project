import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { LotsMovementsScreen } from '../../../src/screens/LotsMovementsScreen';

export default function LotsMovementsRoute(): ReactElement {
  const router = useRouter();

  return <LotsMovementsScreen onBack={() => router.back()} />;
}
