import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { ManagePurchasesScreen } from '../../../src/screens/ManagePurchasesScreen';
import { routes } from '../../../src/navigation/routes';

export default function ManagePurchasesRoute(): ReactElement {
  const router = useRouter();

  return (
    <ManagePurchasesScreen
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace(routes.appMore);
      }}
    />
  );
}
