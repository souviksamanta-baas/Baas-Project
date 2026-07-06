import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { confirmSale } from '../../../src/api/inventory';
import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useSellCart } from '../../../src/context/SellCartProvider';
import { buildCheckoutDraft } from '../../../src/lib/sellCart';
import { routes } from '../../../src/navigation/routes';
import { ConfirmPaymentScreen } from '../../../src/screens/inventory/InventoryScreens';

export default function ConfirmPaymentRoute(): ReactElement {
  const router = useRouter();
  const sellCart = useSellCart();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (sellCart.cart.length === 0) {
      router.replace(routes.inventorySell);
    }
  }, [router, sellCart.cart.length]);

  async function handleConfirmPayment(): Promise<void> {
    if (!organizationId || !businessCenterId) {
      throw new Error('No se pudo identificar la sucursal activa.');
    }

    setIsConfirming(true);

    try {
      const checkout = buildCheckoutDraft(sellCart.cart, sellCart.discountMode, sellCart.discountInput);
      await confirmSale(businessCenterId, organizationId, checkout);
      Alert.alert('Pago confirmado', 'La venta quedo registrada como cobrada.');
      sellCart.clearCart();
      router.back();
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <ConfirmPaymentScreen
      isConfirming={isConfirming}
      onBack={() => router.back()}
      onConfirmPayment={handleConfirmPayment}
    />
  );
}
