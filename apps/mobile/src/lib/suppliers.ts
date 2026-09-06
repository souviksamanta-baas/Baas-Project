import { getAppStorageItem, setAppStorageItem } from './appStorage';

const LEGACY_SUPPLIERS_STORAGE_KEY = 'baas_suppliers_v1';
let legacyGlobalSuppliersCleared = false;

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

function storageKey(organizationId: string): string {
  return `baas_suppliers_v2.${organizationId}`;
}

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

async function readSuppliers(organizationId: string): Promise<SupplierContact[]> {
  if (!organizationId.trim()) {
    return [];
  }

  try {
    const raw = await getAppStorageItem(storageKey(organizationId));

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

async function writeSuppliers(
  organizationId: string,
  suppliers: SupplierContact[],
): Promise<void> {
  await setAppStorageItem(storageKey(organizationId), JSON.stringify(suppliers));
}

/** Label used in compras / product forms (comercio). */
export function supplierLabel(supplier: SupplierContact): string {
  return supplier.comercio.trim() || supplier.name.trim();
}

export async function listSuppliers(organizationId: string | null): Promise<SupplierContact[]> {
  // Drop the old device-wide list so proveedores never leak across negocios.
  if (!legacyGlobalSuppliersCleared) {
    await clearLegacyGlobalSuppliers();
    legacyGlobalSuppliersCleared = true;
  }

  if (!organizationId) {
    return [];
  }

  const suppliers = await readSuppliers(organizationId);
  return suppliers.sort((left, right) =>
    supplierLabel(left).localeCompare(supplierLabel(right), 'es'),
  );
}

export async function addSupplier(input: {
  comercio: string;
  email?: string | null;
  name?: string | null;
  notes?: string | null;
  organizationId: string;
  phone?: string | null;
  phoneE164?: string | null;
}): Promise<SupplierContact> {
  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    throw new Error('Seleccioná un negocio para guardar el proveedor.');
  }

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

  const existing = await readSuppliers(organizationId);
  await writeSuppliers(organizationId, [supplier, ...existing]);

  return supplier;
}

export async function removeSupplier(params: {
  organizationId: string;
  supplierId: string;
}): Promise<void> {
  const organizationId = params.organizationId.trim();
  if (!organizationId) {
    return;
  }

  const existing = await readSuppliers(organizationId);
  const next = existing.filter((supplier) => supplier.id !== params.supplierId);
  await writeSuppliers(organizationId, next);
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

/** Legacy global list — kept only so we can ignore/clear it; never share across orgs. */
export async function clearLegacyGlobalSuppliers(): Promise<void> {
  await setAppStorageItem(LEGACY_SUPPLIERS_STORAGE_KEY, JSON.stringify([]));
}
