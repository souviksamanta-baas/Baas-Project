import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { confirmSale } from '../../../src/api/inventory';
import { BrandSuccessModal } from '../../../src/components/BrandSuccessModal';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useSellCart } from '../../../src/context/SellCartProvider';
import { buildCheckoutDraft, saveSellQuote } from '../../../src/lib/sellCart';
import { routes } from '../../../src/navigation/routes';
import { ConfirmPaymentScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ConfirmPaymentRoute(): ReactElement {
  const router = useRouter();
  const sellCart = useSellCart();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [isConfirming, setIsConfirming] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successQuoteId, setSuccessQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (sellCart.cart.length === 0 && !successVisible) {
      router.replace(routes.inventorySell);
    }
  }, [router, sellCart.cart.length, successVisible]);

  async function handleConfirmPayment(): Promise<void> {
    if (!organizationId || !businessCenterId) {
      throw new Error('No se pudo identificar la sucursal activa.');
    }

    setIsConfirming(true);

    try {
      const checkout = buildCheckoutDraft(sellCart.cart, sellCart.discountMode, sellCart.discountInput);
      await confirmSale(businessCenterId, organizationId, checkout);
      const quoteId = await saveSellQuote(organizationId, businessCenterId, checkout, {
        status: 'cobrado',
      });
      setSuccessQuoteId(quoteId);
      setSuccessVisible(true);
    } finally {
      setIsConfirming(false);
    }
  }

  function handleSuccessClose(): void {
    setSuccessVisible(false);
    setSuccessQuoteId(null);
    sellCart.clearCart();
    router.replace(routes.inventorySell);
  }

  return (
    <>
      <ConfirmPaymentScreen
        isConfirming={isConfirming}
        onBack={() => router.back()}
        onConfirmPayment={handleConfirmPayment}
      />
      <BrandSuccessModal
        body={
          successQuoteId
            ? `La venta quedó registrada como cobrada (${successQuoteId}). Ya la ves en Facturación.`
            : 'La venta quedó registrada como cobrada.'
        }
        buttonLabel="Entendido"
        onClose={handleSuccessClose}
        title="Pago confirmado"
        visible={successVisible}
      />
    </>
  );
}
