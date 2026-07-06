import { useProductCatalog, type ProductCatalogState } from '../context/ProductCatalogProvider';

export type { ProductCatalogState };

/** Shared catalog from ProductCatalogProvider (org/center args kept for call-site compatibility). */
export function useProducts(
  _organizationId?: string | null,
  _businessCenterId?: string | null,
): ProductCatalogState {
  return useProductCatalog();
}
