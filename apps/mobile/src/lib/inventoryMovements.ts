import type { MovementMock } from '../api/inventoryMockData';
import { readProductStatusSlug } from './productCatalog';
import type { Product, ProductEditFormValues } from '../types/products';

export interface InventoryMovementRow {
  created_at: string;
  id: string;
  movement_type: string;
  note: string | null;
  quantity_delta: string | number;
  unit_code: string;
}

export function formatMovementTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfCreated.getTime()) / 86_400_000);

  if (dayDiff <= 0) {
    return 'Hoy';
  }

  if (dayDiff === 1) {
    return 'Ayer';
  }

  return created.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function mapInventoryMovementRow(row: InventoryMovementRow): MovementMock {
  const quantity = Number(row.quantity_delta);
  const note = row.note?.trim() ?? '';

  if (row.movement_type === 'sale') {
    return {
      amount: formatSignedQuantity(quantity, row.unit_code, 'red'),
      id: row.id,
      label: 'Venta',
      time: formatMovementTime(row.created_at),
      tone: 'red',
    };
  }

  if (row.movement_type === 'restock') {
    return {
      amount: formatSignedQuantity(quantity, row.unit_code, 'green'),
      id: row.id,
      label: note.length > 0 ? note : 'Ingreso de lote',
      time: formatMovementTime(row.created_at),
      tone: 'green',
    };
  }

  if (note.toLowerCase().includes('precio')) {
    return {
      id: row.id,
      label: 'Ajuste de precio',
      time: formatMovementTime(row.created_at),
      tone: 'blue',
    };
  }

  if (note.toLowerCase().includes('subproducto')) {
    return {
      id: row.id,
      label: 'Actualizacion de subproducto',
      time: formatMovementTime(row.created_at),
      tone: 'blue',
    };
  }

  return {
    id: row.id,
    label: note.length > 0 ? note : 'Actualizacion de producto',
    time: formatMovementTime(row.created_at),
    tone: 'blue',
  };
}

function formatSignedQuantity(
  quantity: number,
  unitCode: string,
  tone: 'green' | 'red',
): string {
  const absolute = Math.abs(quantity);
  const formatted = Number.isInteger(absolute) ? absolute.toString() : absolute.toFixed(2);
  const prefix = tone === 'green' ? '+' : '-';
  return `${prefix}${formatted} ${unitCode}`;
}

export function buildProductEditMovementNote(
  existingProduct: Product,
  values: ProductEditFormValues,
  options?: { isSubproduct?: boolean },
): string {
  const changes: string[] = [];

  if (existingProduct.name.trim() !== values.name.trim()) {
    changes.push('nombre');
  }

  const nextPriceCents = Math.round(Number.parseFloat(values.unitPrice.replace(',', '.')) * 100);
  if (existingProduct.unitPriceCents !== nextPriceCents) {
    changes.push('precio');
  }

  const previousDescription = existingProduct.description?.trim() ?? '';
  if (previousDescription !== values.description.trim()) {
    changes.push('notas');
  }

  if (readProductStatusSlug(existingProduct) !== values.status) {
    changes.push('estado');
  }

  const prefix = options?.isSubproduct ? 'Actualizacion de subproducto' : 'Actualizacion de producto';

  if (changes.length === 0) {
    return prefix;
  }

  return `${prefix}: ${changes.join(', ')}`;
}
