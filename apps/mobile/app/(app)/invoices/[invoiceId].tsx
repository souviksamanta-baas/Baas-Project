import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { routes } from '../../../src/navigation/routes';
import { InvoiceDetailScreen } from '../../../src/screens/InvoiceDetailScreen';
import { LoadingScreen } from '../../../src/screens/LoadingScreen';

export default function InvoiceDetailRoute(): ReactElement {
  const router = useRouter();
  const { invoiceId: rawInvoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const invoiceId = Array.isArray(rawInvoiceId) ? rawInvoiceId[0] : rawInvoiceId;
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id;

  if (!organizationId || !invoiceId) {
    return <LoadingScreen />;
  }

  return (
    <InvoiceDetailScreen
      invoiceId={invoiceId}
      onBack={() => router.replace(routes.invoices)}
      organizationId={organizationId}
    />
  );
}
