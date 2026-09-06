import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { listSuppliers, supplierLabel } from '../lib/suppliers';

/** Registered supplier labels for inline search (same source as Cargar compra). */
export function useSupplierNames(extraName?: string | null): string[] {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const [registryNames, setRegistryNames] = useState<string[]>([]);
  const trimmedExtra = extraName?.trim() ?? '';

  const load = useCallback(async () => {
    const contacts = await listSuppliers(organizationId);
    setRegistryNames(
      [...new Set(contacts.map((contact) => supplierLabel(contact)))].sort((left, right) =>
        left.localeCompare(right, 'es'),
      ),
    );
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => {
    if (!trimmedExtra || registryNames.some((name) => name.toLowerCase() === trimmedExtra.toLowerCase())) {
      return registryNames;
    }

    return [...registryNames, trimmedExtra].sort((left, right) => left.localeCompare(right, 'es'));
  }, [registryNames, trimmedExtra]);
}
