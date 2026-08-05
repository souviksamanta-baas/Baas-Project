import { getAppStorageItem, setAppStorageItem } from './appStorage';
import { formatMoneyInput } from './productEditForm';

const PURCHASES_STORAGE_KEY = 'baas_purchases_v2';
const LEGACY_PURCHASES_STORAGE_KEY = 'baas_purchases_v1';

export type PurchaseStatus = 'pending_confirmation' | 'confirmed';

export type PurchaseLineRecord = {
  cost: string;
  id: string;
  lineTotalCents: number;
  lotId?: string | null;
  marginPercent: string;
  previousBaseUnitCode?: string | null;
  previousMetadata?: Record<string, unknown> | null;
  previousUnitPriceCents?: number | null;
  productId: string;
  productName: string;
  quantity: number;
  unitCode: string;
  unitCostCents: number;
  unitPrice: string;
  unitPriceCents: number;
};

export type PurchaseRecord = {
  businessCenterId: string;
  createdAt: string;
  date: string;
  id: string;
  itemCount: number;
  lines: PurchaseLineRecord[];
  number: string;
  organizationId: string;
  status: PurchaseStatus;
  supplier: string;
  totalCostCents: number;
  updatedAt: string;
};

function normalizePurchaseNumber(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePurchaseStatus(value: unknown): PurchaseStatus {
  return value === 'confirmed' ? 'confirmed' : 'pending_confirmation';
}

function createPurchaseId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `PC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeLine(raw: Partial<PurchaseLineRecord> & { productId: string }): PurchaseLineRecord {
  const unitCostCents = raw.unitCostCents ?? 0;
  const unitPriceCents = raw.unitPriceCents ?? 0;
  const quantity = raw.quantity ?? 0;

  return {
    cost: raw.cost ?? formatMoneyInput(unitCostCents / 100),
    id: raw.id ?? createPurchaseId(),
    lineTotalCents: raw.lineTotalCents ?? Math.max(0, quantity * unitCostCents),
    lotId: raw.lotId ?? null,
    marginPercent: raw.marginPercent ?? '0',
    previousBaseUnitCode: raw.previousBaseUnitCode ?? null,
    previousMetadata: raw.previousMetadata ?? null,
    previousUnitPriceCents: raw.previousUnitPriceCents ?? null,
    productId: raw.productId,
    productName: raw.productName ?? 'Producto',
    quantity,
    unitCode: raw.unitCode ?? 'unit',
    unitCostCents,
    unitPrice: raw.unitPrice ?? formatMoneyInput(unitPriceCents / 100),
    unitPriceCents,
  };
}

function normalizePurchase(raw: Partial<PurchaseRecord> & {
  businessCenterId: string;
  number: string;
  organizationId: string;
}): PurchaseRecord {
  const lines = Array.isArray(raw.lines) ? raw.lines.map((line) => normalizeLine(line)) : [];
  const createdAt = raw.createdAt ?? new Date().toISOString();

  return {
    businessCenterId: raw.businessCenterId,
    createdAt,
    date: raw.date ?? '',
    id: raw.id ?? createPurchaseId(),
    itemCount: raw.itemCount ?? lines.reduce((sum, line) => sum + line.quantity, 0),
    lines,
    number: raw.number,
    organizationId: raw.organizationId,
    status: normalizePurchaseStatus(raw.status),
    supplier: raw.supplier ?? '',
    totalCostCents:
      raw.totalCostCents ?? lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    updatedAt: raw.updatedAt ?? createdAt,
  };
}

export function purchaseStatusLabel(status: PurchaseStatus): string {
  return status === 'confirmed' ? 'Confirmada' : 'Pendiente de confirmación';
}

async function readPurchases(): Promise<PurchaseRecord[]> {
  try {
    const raw = await getAppStorageItem(PURCHASES_STORAGE_KEY);
    const legacyRaw = raw ? null : await getAppStorageItem(LEGACY_PURCHASES_STORAGE_KEY);
    const source = raw ?? legacyRaw;

    if (!source) {
      return [];
    }

    const parsed = JSON.parse(source) as Array<Partial<PurchaseRecord>>;
    const purchases = Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is Partial<PurchaseRecord> & {
              businessCenterId: string;
              number: string;
              organizationId: string;
            } =>
              typeof item?.businessCenterId === 'string' &&
              typeof item?.number === 'string' &&
              typeof item?.organizationId === 'string',
          )
          .map(normalizePurchase)
      : [];

    if (!raw && purchases.length > 0) {
      await setAppStorageItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
    }

    return purchases;
  } catch {
    return [];
  }
}

async function writePurchases(purchases: PurchaseRecord[]): Promise<void> {
  await setAppStorageItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
}

export async function listPurchases(
  organizationId: string,
  businessCenterId: string,
): Promise<PurchaseRecord[]> {
  const purchases = await readPurchases();

  return purchases
    .filter(
      (purchase) =>
        purchase.organizationId === organizationId &&
        purchase.businessCenterId === businessCenterId,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getPurchaseById(options: {
  businessCenterId: string;
  organizationId: string;
  purchaseId: string;
}): Promise<PurchaseRecord | null> {
  const purchases = await listPurchases(options.organizationId, options.businessCenterId);
  return purchases.find((purchase) => purchase.id === options.purchaseId) ?? null;
}

export async function isPurchaseNumberTaken(options: {
  businessCenterId: string;
  excludePurchaseId?: string;
  organizationId: string;
  purchaseNumber: string;
}): Promise<boolean> {
  const normalized = normalizePurchaseNumber(options.purchaseNumber);

  if (!normalized) {
    return false;
  }

  const purchases = await listPurchases(options.organizationId, options.businessCenterId);

  return purchases.some((purchase) => {
    if (options.excludePurchaseId && purchase.id === options.excludePurchaseId) {
      return false;
    }

    return normalizePurchaseNumber(purchase.number) === normalized;
  });
}

export async function registerPurchase(input: {
  businessCenterId: string;
  date: string;
  itemCount: number;
  lines: PurchaseLineRecord[];
  number: string;
  organizationId: string;
  status?: PurchaseStatus;
  supplier: string;
  totalCostCents: number;
}): Promise<PurchaseRecord> {
  const number = input.number.trim();

  if (!number) {
    throw new Error('Ingresá el número de compra.');
  }

  const taken = await isPurchaseNumberTaken({
    businessCenterId: input.businessCenterId,
    organizationId: input.organizationId,
    purchaseNumber: number,
  });

  if (taken) {
    throw new Error('Ese número de compra ya existe.');
  }

  const now = new Date().toISOString();
  const record: PurchaseRecord = {
    businessCenterId: input.businessCenterId,
    createdAt: now,
    date: input.date,
    id: createPurchaseId(),
    itemCount: input.itemCount,
    lines: input.lines.map((line) => normalizeLine(line)),
    number,
    organizationId: input.organizationId,
    status: input.status ?? 'pending_confirmation',
    supplier: input.supplier.trim(),
    totalCostCents: input.totalCostCents,
    updatedAt: now,
  };

  const existing = await readPurchases();
  await writePurchases([record, ...existing]);

  return record;
}

export async function updatePurchase(options: {
  businessCenterId: string;
  organizationId: string;
  purchaseId: string;
  patch: Partial<
    Pick<
      PurchaseRecord,
      'date' | 'itemCount' | 'lines' | 'number' | 'status' | 'supplier' | 'totalCostCents'
    >
  >;
}): Promise<PurchaseRecord> {
  const existing = await readPurchases();
  const index = existing.findIndex(
    (purchase) =>
      purchase.id === options.purchaseId &&
      purchase.organizationId === options.organizationId &&
      purchase.businessCenterId === options.businessCenterId,
  );

  if (index < 0) {
    throw new Error('No se encontró la compra.');
  }

  const current = existing[index]!;

  if (options.patch.number && options.patch.number.trim() !== current.number) {
    const taken = await isPurchaseNumberTaken({
      businessCenterId: options.businessCenterId,
      excludePurchaseId: current.id,
      organizationId: options.organizationId,
      purchaseNumber: options.patch.number,
    });

    if (taken) {
      throw new Error('Ese número de compra ya existe.');
    }
  }

  const updated: PurchaseRecord = normalizePurchase({
    ...current,
    ...options.patch,
    lines: options.patch.lines ?? current.lines,
    number: options.patch.number?.trim() || current.number,
    updatedAt: new Date().toISOString(),
  });

  const next = [...existing];
  next[index] = updated;
  await writePurchases(next);

  return updated;
}
