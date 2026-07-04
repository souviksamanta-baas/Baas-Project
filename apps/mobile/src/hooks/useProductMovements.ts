import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getProductMovements } from '../api/inventory';
import type { MovementMock } from '../api/inventoryMockData';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';

export function useProductMovements(productId: string | null) {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [movements, setMovements] = useState<MovementMock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMovements = useCallback(async () => {
    if (!productId || !organizationId || !businessCenterId) {
      setMovements([]);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await getProductMovements(organizationId, businessCenterId, productId);
      setMovements(rows);
    } catch {
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId, productId]);

  useFocusEffect(
    useCallback(() => {
      void loadMovements();
    }, [loadMovements]),
  );

  return { isLoading, movements };
}
