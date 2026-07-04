import { useMemo } from 'react';

import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import type { Product } from '../types/products';
import { useProducts } from './useProducts';

export function normalizeRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function useInventoryCatalog() {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const businessCenterName = dashboard?.businessCenter?.name ?? null;
  const catalog = useProducts(organizationId, businessCenterId);

  return {
    businessCenterName,
    catalog,
    organizationId,
    businessCenterId,
  };
}

export function useInventoryProduct(productIdParam: string | string[] | undefined) {
  const { businessCenterName, catalog } = useInventoryCatalog();
  const productId = normalizeRouteParam(productIdParam);

  const product = useMemo(
    () => catalog.products.find((item) => item.id === productId) ?? null,
    [catalog.products, productId],
  );

  const childProducts = useMemo(
    () => catalog.products.filter((item) => item.parentProductId === productId),
    [catalog.products, productId],
  );

  return {
    businessCenterName,
    childProducts,
    errorMessage: catalog.errorMessage,
    isLoading: catalog.isLoading,
    product,
    productId,
  };
}

export function useInventorySubproduct(subproductIdParam: string | string[] | undefined) {
  const { businessCenterName, catalog } = useInventoryCatalog();
  const subproductId = normalizeRouteParam(subproductIdParam);

  const subproduct = useMemo(
    () => catalog.products.find((item) => item.id === subproductId) ?? null,
    [catalog.products, subproductId],
  );

  const parentProduct = useMemo((): Product | null => {
    if (!subproduct?.parentProductId) {
      return null;
    }

    return catalog.products.find((item) => item.id === subproduct.parentProductId) ?? null;
  }, [catalog.products, subproduct?.parentProductId]);

  return {
    businessCenterName,
    errorMessage: catalog.errorMessage,
    isLoading: catalog.isLoading,
    parentProduct,
    subproduct,
    subproductId,
  };
}
