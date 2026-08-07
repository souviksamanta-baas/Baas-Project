import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ScreenContent } from '../../../src/components/ui';
import { routes } from '../../../src/navigation/routes';
import { colors } from '../../../src/theme';

/** Legacy path — Cobrar now opens the presupuesto detail after saving. */
export default function ConfirmPaymentRoute(): ReactElement {
  const router = useRouter();

  useEffect(() => {
    router.replace(routes.inventorySell);
  }, [router]);

  return (
    <ScreenContent>
      <ActivityIndicator color={colors.primary} />
    </ScreenContent>
  );
}
