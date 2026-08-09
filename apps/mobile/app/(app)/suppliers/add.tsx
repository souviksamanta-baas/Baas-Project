import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { routes } from '../../../src/navigation/routes';
import { AddSupplierScreen } from '../../../src/screens/AddSupplierScreen';

export default function AddSupplierRoute(): ReactElement {
  const router = useRouter();

  return (
    <AddSupplierScreen
      onBack={() => router.back()}
      onSaved={() => router.replace(routes.suppliers)}
    />
  );
}
