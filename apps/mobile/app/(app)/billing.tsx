import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import {
  invoiceDetailRoute,
  presupuestoDetailRoute,
  routes,
} from '../../src/navigation/routes';
import { BillingQuotesScreen } from '../../src/screens/BillingQuotesScreen';

export default function BillingRoute(): ReactElement {
  const router = useRouter();
  const { quoteId: rawQuoteId } = useLocalSearchParams<{ quoteId?: string | string[] }>();
  const highlightQuoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;

  return (
    <BillingQuotesScreen
      highlightQuoteId={highlightQuoteId ?? null}
      onBack={() => router.back()}
      onOpenInvoice={(invoiceId) => router.push(invoiceDetailRoute(invoiceId))}
      onOpenQuote={(quoteId) => router.push(presupuestoDetailRoute(quoteId, 'billing'))}
      onOpenSell={() => {
        // Replace billing so inventory stack mounts on sell (avoids a flash of manage-stock).
        router.replace(routes.inventorySell);
      }}
    />
  );
}
