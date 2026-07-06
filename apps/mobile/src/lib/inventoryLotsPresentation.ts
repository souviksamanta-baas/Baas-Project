import type { BatchMock } from '../api/inventoryMockData';
import { formatLotQuantityLabel, formatProductSalePrice } from './inventoryPresentation';
import type { InventoryLot } from '../types/inventoryLots';
import type { Product } from '../types/products';

function formatLotDate(receivedAt: string): string {
  const date = new Date(receivedAt);
  if (Number.isNaN(date.getTime())) {
    return receivedAt;
  }

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatLotCost(lot: InventoryLot): string {
  if (lot.unitCostCents === null) {
    return '—';
  }

  const amount = (lot.unitCostCents / 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  return `$${amount}`;
}

export function mapLotToBatchRow(
  lot: InventoryLot,
  product: Product | null,
  childProducts?: Product[],
): BatchMock {
  const quantity = lot.remainingQuantity;
  const isCurrent = lot.remainingQuantity > 0;

  return {
    cost: formatLotCost(lot),
    date: formatLotDate(lot.receivedAt),
    id: lot.id,
    lot: lot.lotCode ?? 'Sin codigo',
    price: product ? formatProductSalePrice(product, childProducts) : '—',
    qty: formatLotQuantityLabel(quantity, lot.unitCode),
    status: isCurrent ? 'Actual' : 'Cerrado',
    statusTone: isCurrent ? 'green' : undefined,
  };
}

export function dedupeLotsByCode(lots: InventoryLot[]): InventoryLot[] {
  const seen = new Set<string>();

  return lots.filter((lot) => {
    const key = lot.lotCode ?? lot.id;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function mapLotsToBatchRows(
  lots: InventoryLot[],
  product: Product | null,
  childProducts?: Product[],
): BatchMock[] {
  return dedupeLotsByCode(lots).map((lot) => mapLotToBatchRow(lot, product, childProducts));
}
