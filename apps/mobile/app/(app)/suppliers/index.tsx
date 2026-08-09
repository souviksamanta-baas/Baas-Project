import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { SuppliersScreen } from '../../../src/screens/SuppliersScreen';

export default function SuppliersRoute(): ReactElement {
  const router = useRouter();

  return (
    <SuppliersScreen
      onAddSupplier={() => router.push(routes.suppliersAdd)}
      onBack={() => router.back()}
    />
  );
}
