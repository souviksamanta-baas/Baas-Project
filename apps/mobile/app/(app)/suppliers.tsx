import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { SuppliersScreen } from '../../src/screens/SuppliersScreen';

export default function SuppliersRoute(): ReactElement {
  const router = useRouter();

  return <SuppliersScreen onBack={() => router.back()} />;
}
