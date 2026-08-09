import { getAppStorageItem, setAppStorageItem } from './appStorage';

const SUPPLIERS_STORAGE_KEY = 'baas_suppliers_v1';

export type SupplierContact = {
  comercio: string;
  createdAt: string;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  phoneE164: string | null;
};

type StoredSupplier = Partial<SupplierContact> & {
  id?: string;
  name?: string;
};

function normalizeSupplier(raw: StoredSupplier): SupplierContact | null {
  const hasExplicitComercio =
    typeof raw.comercio === 'string' && raw.comercio.trim().length > 0;
  const legacyName = typeof raw.name === 'string' ? raw.name.trim() : '';
  const comercio = hasExplicitComercio ? raw.comercio!.trim() : legacyName;

  if (!comercio) {
    return null;
  }

  return {
    comercio,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim().length > 0
        ? raw.createdAt
        : new Date().toISOString(),
    email: typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : null,
    id:
      typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id
        : `SUP-${Date.now().toString(36).toUpperCase()}`,
    // New records: name is the contact person. Legacy records only had business name.
    name: hasExplicitComercio ? legacyName : '',
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
    phone: typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null,
    phoneE164:
      typeof raw.phoneE164 === 'string' && raw.phoneE164.trim() ? raw.phoneE164.trim() : null,
  };
}

async function readSuppliers(): Promise<SupplierContact[]> {
  try {
    const raw = await getAppStorageItem(SUPPLIERS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredSupplier[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeSupplier(item))
      .filter((item): item is SupplierContact => item != null);
  } catch {
    return [];
  }
}

/** Label used in compras / product forms (comercio). */
export function supplierLabel(supplier: SupplierContact): string {
  return supplier.comercio.trim() || supplier.name.trim();
}

export async function listSuppliers(): Promise<SupplierContact[]> {
  const suppliers = await readSuppliers();
  return suppliers.sort((left, right) =>
    supplierLabel(left).localeCompare(supplierLabel(right), 'es'),
  );
}

export async function addSupplier(input: {
  comercio: string;
  email?: string | null;
  name?: string | null;
  notes?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
}): Promise<SupplierContact> {
  const comercio = input.comercio.trim();
  const name = input.name?.trim() ?? '';

  if (!comercio) {
    throw new Error('Ingresá el comercio del proveedor.');
  }

  const supplier: SupplierContact = {
    comercio,
    createdAt: new Date().toISOString(),
    email: input.email?.trim() || null,
    id: `SUP-${Date.now().toString(36).toUpperCase()}`,
    name,
    notes: input.notes?.trim() || null,
    phone: input.phone?.trim() || null,
    phoneE164: input.phoneE164 ?? null,
  };

  const existing = await readSuppliers();
  await setAppStorageItem(SUPPLIERS_STORAGE_KEY, JSON.stringify([supplier, ...existing]));

  return supplier;
}

export async function removeSupplier(supplierId: string): Promise<void> {
  const existing = await readSuppliers();
  const next = existing.filter((supplier) => supplier.id !== supplierId);
  await setAppStorageItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(next));
}

export function supplierInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}
