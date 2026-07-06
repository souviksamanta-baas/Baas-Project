import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getProductLots } from '../api/inventory';
import type { InventoryLot } from '../types/inventoryLots';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';

export function useProductLots(productId: string | null) {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLots = useCallback(async () => {
    if (!productId || !organizationId || !businessCenterId) {
      setLots([]);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await getProductLots(organizationId, businessCenterId, productId);
      setLots(rows);
    } catch {
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId, productId]);

  useFocusEffect(
    useCallback(() => {
      void loadLots();
    }, [loadLots]),
  );

  return { isLoading, lots, reloadLots: loadLots };
}
