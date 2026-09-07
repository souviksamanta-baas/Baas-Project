import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { ScreenContent } from '../../src/components/ui';
import { CashScreen } from '../../src/screens/CashScreen';
import { colors } from '../../src/theme';

export default function CashRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;

  if (!organizationId || !businessCenterId) {
    return (
      <ScreenContent title="Caja">
        <Text style={{ color: colors.textMuted, padding: 16 }}>
          No hay una sucursal activa para ver la caja.
        </Text>
      </ScreenContent>
    );
  }

  return (
    <CashScreen
      businessCenterId={businessCenterId}
      businessCenterName={dashboard?.businessCenter?.name}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace('/(app)/more');
      }}
      organizationId={organizationId}
      timezone={dashboard?.businessCenter?.timezone ?? dashboard?.organization?.timezone}
    />
  );
}
