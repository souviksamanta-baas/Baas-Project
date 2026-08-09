import { addStock, reversePurchaseLotStock } from '../api/inventory';
import type { Product } from '../types/products';
import type { AddStockFormValues } from '../types/inventoryLots';
import {
  getPurchaseById,
  updatePurchase,
  type PurchaseLineRecord,
  type PurchaseRecord,
} from './purchases';

function lineToAddStockValues(
  line: PurchaseLineRecord,
  purchase: PurchaseRecord,
): AddStockFormValues {
  return {
    cost: line.cost,
    expiresDate: line.expiresDate ?? '',
    marginPercent: line.marginPercent,
    purchaseNumber: purchase.number,
    quantity: String(line.quantity),
    receivedDate: purchase.date,
    supplier: purchase.supplier,
    targetProductId: line.productId,
    unitCode: line.unitCode,
    unitPrice: line.unitPrice,
  };
}

function withUpdatedProductStock(
  products: Product[],
  productId: string,
  quantityDelta: number,
  extras?: Partial<Product>,
): Product[] {
  return products.map((product) => {
    if (product.id !== productId) {
      return product;
    }

    return {
      ...product,
      ...extras,
      stockQuantity: product.stockQuantity + quantityDelta,
    };
  });
}

export async function confirmPurchaseStock(options: {
  businessCenterId: string;
  organizationId: string;
  products: Product[];
  purchaseId: string;
}): Promise<PurchaseRecord> {
  const purchase = await getPurchaseById(options);

  if (!purchase) {
    throw new Error('No se encontró la compra.');
  }

  if (purchase.status === 'confirmed') {
    return purchase;
  }

  if (purchase.lines.length === 0) {
    throw new Error('La compra no tiene ítems para confirmar.');
  }

  let workingProducts = options.products;
  const nextLines: PurchaseLineRecord[] = [];

  for (const line of purchase.lines) {
    const product = workingProducts.find((item) => item.id === line.productId);

    if (!product) {
      throw new Error(`No se encontró el producto ${line.productName}.`);
    }

    const result = await addStock(
      options.businessCenterId,
      options.organizationId,
      product,
      lineToAddStockValues(line, purchase),
    );

    nextLines.push({
      ...line,
      lotId: result.lotId,
      previousBaseUnitCode: result.previousBaseUnitCode,
      previousMetadata: result.previousMetadata,
      previousUnitPriceCents: result.previousUnitPriceCents,
    });

    workingProducts = withUpdatedProductStock(workingProducts, product.id, line.quantity, {
      baseUnitCode: line.unitCode,
      metadata: {
        ...product.metadata,
        margen_pct: Number.parseFloat(line.marginPercent.replace(',', '.')) || 0,
        precio_costo_cents: line.unitCostCents,
        proveedor: purchase.supplier,
      },
      unitCode: line.unitCode,
      unitPriceCents: line.unitPriceCents,
    });
  }

  return updatePurchase({
    businessCenterId: options.businessCenterId,
    organizationId: options.organizationId,
    purchaseId: purchase.id,
    patch: {
      lines: nextLines,
      status: 'confirmed',
    },
  });
}

export async function unconfirmPurchaseStock(options: {
  businessCenterId: string;
  organizationId: string;
  products: Product[];
  purchaseId: string;
}): Promise<PurchaseRecord> {
  const purchase = await getPurchaseById(options);

  if (!purchase) {
    throw new Error('No se encontró la compra.');
  }

  if (purchase.status !== 'confirmed') {
    return purchase;
  }

  let workingProducts = options.products;
  // Reverse in reverse order so later price restores win when same product appears twice.
  const lines = [...purchase.lines].reverse();
  const restoredProducts = new Set<string>();

  for (const line of lines) {
    if (!line.lotId) {
      continue;
    }

    const product = workingProducts.find((item) => item.id === line.productId);

    if (!product) {
      throw new Error(`No se encontró el producto ${line.productName}.`);
    }

    const shouldRestorePrices = !restoredProducts.has(product.id);
    await reversePurchaseLotStock({
      businessCenterId: options.businessCenterId,
      lotId: line.lotId,
      organizationId: options.organizationId,
      previousBaseUnitCode: line.previousBaseUnitCode ?? undefined,
      previousMetadata: line.previousMetadata ?? undefined,
      previousUnitPriceCents: line.previousUnitPriceCents ?? undefined,
      product,
      purchaseNumber: purchase.number,
      quantity: line.quantity,
      restorePrices: shouldRestorePrices,
    });
    restoredProducts.add(product.id);

    workingProducts = withUpdatedProductStock(workingProducts, product.id, -line.quantity, {
      baseUnitCode: line.previousBaseUnitCode ?? product.baseUnitCode,
      metadata: line.previousMetadata ?? product.metadata,
      unitPriceCents: line.previousUnitPriceCents ?? product.unitPriceCents,
    });
  }

  return updatePurchase({
    businessCenterId: options.businessCenterId,
    organizationId: options.organizationId,
    purchaseId: purchase.id,
    patch: {
      lines: purchase.lines.map((line) => ({
        ...line,
        lotId: null,
        previousBaseUnitCode: null,
        previousMetadata: null,
        previousUnitPriceCents: null,
      })),
      status: 'pending_confirmation',
    },
  });
}
