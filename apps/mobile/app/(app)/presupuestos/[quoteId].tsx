import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getArcaConnection } from '../../../src/api/arca';
import { issueInvoice, listInvoices, type InvoiceListItem } from '../../../src/api/billing';
import { confirmSale } from '../../../src/api/inventory';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useSellCart } from '../../../src/context/SellCartProvider';
import {
  DEFAULT_CLIENT_LABEL,
  DEFAULT_RECEIPT_LABEL,
  getCartLineSoldQuantity,
  getEffectiveGrams,
  getSellQuote,
  updateSellQuote,
  type SavedSellQuote,
  type SellCartLine,
} from '../../../src/lib/sellCart';
import {
  invoiceDetailRoute,
  parsePresupuestoReturnTo,
  resolvePresupuestoReturnRoute,
  routes,
} from '../../../src/navigation/routes';
import { PresupuestoDetailScreen } from '../../../src/screens/PresupuestoDetailScreen';

function pickAuthorizedInvoiceForQuote(
  invoices: InvoiceListItem[],
  quoteId: string,
): InvoiceListItem | null {
  return (
    invoices.find(
      (invoice) =>
        invoice.sell_quote_id === quoteId &&
        invoice.arca_status === 'authorized' &&
        Boolean(invoice.cae),
    ) ?? null
  );
}

export default function PresupuestoDetailRoute(): ReactElement {
  const router = useRouter();
  const sellCart = useSellCart();
  const { quoteId: rawQuoteId, returnTo: rawReturnTo } = useLocalSearchParams<{
    quoteId: string;
    returnTo?: string | string[];
  }>();
  const quoteId = Array.isArray(rawQuoteId) ? rawQuoteId[0] : rawQuoteId;
  const returnTo = parsePresupuestoReturnTo(rawReturnTo);
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;

  const [quote, setQuote] = useState<SavedSellQuote | null>(null);
  const [cart, setCart] = useState<SellCartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isIssuingInvoice, setIsIssuingInvoice] = useState(false);
  const [arcaConnected, setArcaConnected] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<InvoiceListItem | null>(null);

  const loadQuote = useCallback(async () => {
    if (!organizationId || !businessCenterId || !quoteId) {
      setQuote(null);
      setCart([]);
      setLinkedInvoice(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [next, invoices] = await Promise.all([
        getSellQuote(organizationId, businessCenterId, quoteId),
        listInvoices(organizationId).catch(() => [] as InvoiceListItem[]),
      ]);
      setQuote(next);
      if (next) {
        setCart(next.draft.cart.map((line) => ({ ...line })));
        setLinkedInvoice(pickAuthorizedInvoiceForQuote(invoices, next.id));
      } else {
        setCart([]);
        setLinkedInvoice(null);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo cargar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
      setQuote(null);
      setCart([]);
      setLinkedInvoice(null);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId, quoteId]);

  const loadArca = useCallback(async () => {
    if (!organizationId) {
      setArcaConnected(false);
      return;
    }

    try {
      const connection = await getArcaConnection(organizationId);
      setArcaConnected(connection.authorizationStatus === 'connected');
    } catch {
      setArcaConnected(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  useEffect(() => {
    void loadArca();
  }, [loadArca]);

  function handleBack(): void {
    router.replace(resolvePresupuestoReturnRoute(returnTo));
  }

  function buildDraftFromState() {
    if (!quote) {
      return null;
    }

    return {
      ...quote.draft,
      cart,
      clientLabel: quote.draft.clientLabel?.trim() || DEFAULT_CLIENT_LABEL,
      receiptLabel: quote.draft.receiptLabel?.trim() || DEFAULT_RECEIPT_LABEL,
    };
  }

  async function handleSaveChanges(): Promise<void> {
    if (!organizationId || !businessCenterId || !quote) {
      return;
    }

    const draft = buildDraftFromState();
    if (!draft) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateSellQuote(organizationId, businessCenterId, quote.id, { draft });
      if (updated) {
        setQuote(updated);
        setCart(updated.draft.cart.map((line) => ({ ...line })));
      }
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmPayment(): Promise<void> {
    if (!organizationId || !businessCenterId || !quote) {
      return;
    }

    const draft = buildDraftFromState();
    if (!draft || draft.cart.length === 0) {
      return;
    }

    setIsConfirming(true);
    try {
      await confirmSale(businessCenterId, organizationId, draft);
      const updated = await updateSellQuote(organizationId, businessCenterId, quote.id, {
        draft,
        status: 'cobrado',
      });
      if (updated) {
        setQuote(updated);
        setCart(updated.draft.cart.map((line) => ({ ...line })));
      }
    } catch (error) {
      Alert.alert(
        'No se pudo confirmar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleIssueInvoice(): Promise<void> {
    if (!organizationId || !quote || cart.length === 0) {
      return;
    }

    setIsIssuingInvoice(true);
    try {
      const issued = await issueInvoice({
        organizationId,
        sellQuoteId: quote.id,
        customerName: quote.draft.clientLabel?.trim() || undefined,
        lines: cart.map((line) => ({
          description: line.name,
          quantity: getCartLineSoldQuantity(line),
          unitPriceCents: line.unitPriceCents,
        })),
      });
      router.replace(invoiceDetailRoute(issued.id));
    } catch (error) {
      Alert.alert(
        'No se pudo emitir',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsIssuingInvoice(false);
    }
  }

  function handleConsultInvoice(): void {
    if (!linkedInvoice) {
      return;
    }
    router.push(invoiceDetailRoute(linkedInvoice.id));
  }

  function handleAddMoreProducts(): void {
    if (!quote) {
      return;
    }

    const draft = buildDraftFromState();
    if (!draft) {
      return;
    }

    sellCart.loadQuoteIntoCart({
      ...quote,
      draft,
    });
    router.replace(routes.inventorySell);
  }

  function handleIncreaseLine(lineId: string): void {
    setCart((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        if (line.soldByWeight) {
          return { ...line, weightGramsInput: String(getEffectiveGrams(line) + 100) };
        }

        return { ...line, quantity: line.quantity + 1 };
      }),
    );
  }

  function handleDecreaseLine(lineId: string): void {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.id !== lineId) {
          return [line];
        }

        if (line.soldByWeight) {
          const grams = getEffectiveGrams(line) - 100;
          if (grams < 100) {
            return [line];
          }

          return [{ ...line, weightGramsInput: String(grams) }];
        }

        if (line.quantity <= 1) {
          return [];
        }

        return [{ ...line, quantity: line.quantity - 1 }];
      }),
    );
  }

  function handleFocusLineGrams(lineId: string): void {
    setCart((current) =>
      current.map((line) => {
        if (line.id !== lineId || !line.soldByWeight || line.weightGramsInput !== null) {
          return line;
        }

        return { ...line, weightGramsInput: '' };
      }),
    );
  }

  function handleSetLineGrams(lineId: string, value: string): void {
    const digits = value.replace(/[^\d]/g, '');
    setCart((current) =>
      current.map((line) => {
        if (line.id !== lineId || !line.soldByWeight) {
          return line;
        }

        return { ...line, weightGramsInput: digits };
      }),
    );
  }

  function handleRemoveLine(lineId: string): void {
    setCart((current) => current.filter((line) => line.id !== lineId));
  }

  return (
    <PresupuestoDetailScreen
      arcaConnected={arcaConnected}
      cart={cart}
      isConfirming={isConfirming}
      isIssuingInvoice={isIssuingInvoice}
      isLoading={isLoading}
      isSaving={isSaving}
      linkedInvoiceId={linkedInvoice?.id ?? null}
      onAddMoreProducts={handleAddMoreProducts}
      onBack={handleBack}
      onConfirmPayment={handleConfirmPayment}
      onConsultInvoice={handleConsultInvoice}
      onDecreaseLine={handleDecreaseLine}
      onFocusLineGrams={handleFocusLineGrams}
      onIncreaseLine={handleIncreaseLine}
      onIssueInvoice={handleIssueInvoice}
      onRemoveLine={handleRemoveLine}
      onSaveChanges={handleSaveChanges}
      onSetLineGrams={handleSetLineGrams}
      quote={quote}
      quoteId={quoteId}
    />
  );
}
