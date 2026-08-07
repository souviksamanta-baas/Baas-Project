import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { invoiceDetailRoute, routes } from '../../../src/navigation/routes';
import { InvoicesListScreen } from '../../../src/screens/InvoicesListScreen';
import { LoadingScreen } from '../../../src/screens/LoadingScreen';

export default function InvoicesRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id;

  if (!organizationId) {
    return <LoadingScreen />;
  }

  return (
    <InvoicesListScreen
      onBack={() => router.back()}
      onOpenInvoice={(invoiceId) => router.push(invoiceDetailRoute(invoiceId))}
      organizationId={organizationId}
    />
  );
}
