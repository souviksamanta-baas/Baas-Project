import { useMemo } from 'react';

import type { Product } from '../types/products';
import { useProducts } from './useProducts';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { normalizeRouteParam } from './useInventoryProduct';

export function useAddStockContext(productIdParam: string | string[] | undefined) {
  const productId = normalizeRouteParam(productIdParam);
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const catalog = useProducts(organizationId, businessCenterId);

  const context = useMemo(() => {
    const product = catalog.products.find((item) => item.id === productId) ?? null;

    if (!product) {
      return {
        baseProduct: null as Product | null,
        defaultSelectedId: productId,
        isLoading: catalog.isLoading,
        selectableProducts: [] as Product[],
        selectedProduct: null as Product | null,
        showProductSelection: false,
      };
    }

    if (product.parentProductId) {
      const parentProduct =
        catalog.products.find((item) => item.id === product.parentProductId) ?? null;
      const siblingProducts = catalog.products.filter(
        (item) => item.parentProductId === product.parentProductId,
      );
      const selectableProducts = parentProduct
        ? [parentProduct, ...siblingProducts]
        : [product];

      return {
        baseProduct: parentProduct ?? product,
        defaultSelectedId: product.id,
        isLoading: catalog.isLoading,
        selectableProducts,
        selectedProduct: product,
        showProductSelection: selectableProducts.length > 1,
      };
    }

    const childProducts = catalog.products.filter((item) => item.parentProductId === product.id);
    const selectableProducts = [product, ...childProducts];

    return {
      baseProduct: product,
      defaultSelectedId: product.id,
      isLoading: catalog.isLoading,
      selectableProducts,
      selectedProduct: product,
      showProductSelection: childProducts.length > 0,
    };
  }, [catalog.isLoading, catalog.products, productId]);

  return {
    ...context,
    businessCenterId,
    organizationId,
    productId,
    reloadProducts: catalog.reloadProducts,
  };
}
