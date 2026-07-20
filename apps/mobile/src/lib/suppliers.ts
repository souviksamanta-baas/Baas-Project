import { getAppStorageItem, setAppStorageItem } from './appStorage';

const SUPPLIERS_STORAGE_KEY = 'baas_suppliers_v1';

export type SupplierContact = {
  createdAt: string;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  phoneE164: string | null;
};

async function readSuppliers(): Promise<SupplierContact[]> {
  try {
    const raw = await getAppStorageItem(SUPPLIERS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SupplierContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listSuppliers(): Promise<SupplierContact[]> {
  const suppliers = await readSuppliers();
  return suppliers.sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

export async function addSupplier(input: {
  email?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
}): Promise<SupplierContact> {
  const name = input.name.trim();

  if (!name) {
    throw new Error('Ingresá el nombre del proveedor.');
  }

  const supplier: SupplierContact = {
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

export function supplierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}
