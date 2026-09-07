import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { ScreenContent } from '../../src/components/ui';
import { CashBalancesReportScreen } from '../../src/screens/CashBalancesReportScreen';
import { colors } from '../../src/theme';

export default function CashBalancesReportRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;

  if (!organizationId || !businessCenterId) {
    return (
      <ScreenContent title="Movimiento">
        <Text style={{ color: colors.textMuted, padding: 16 }}>
          No hay una sucursal activa para ver el informe.
        </Text>
      </ScreenContent>
    );
  }

  return (
    <CashBalancesReportScreen
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
