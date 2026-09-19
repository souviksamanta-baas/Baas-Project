import { getAppStorageItem, setAppStorageItem } from './appStorage';
import { supabase } from './supabase';

const LEGACY_SUPPLIERS_STORAGE_KEY = 'baas_suppliers_v1';
const MIGRATED_FLAG_PREFIX = 'baas_suppliers_migrated_v1.';

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

type SupplierRow = {
  comercio: string;
  created_at: string;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  organization_id: string;
  phone: string | null;
  phone_e164: string | null;
};

function localStorageKey(organizationId: string): string {
  return `baas_suppliers_v2.${organizationId}`;
}

function migratedFlagKey(organizationId: string): string {
  return `${MIGRATED_FLAG_PREFIX}${organizationId}`;
}

function normalizeLocalSupplier(raw: StoredSupplier): SupplierContact | null {
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
    name: hasExplicitComercio ? legacyName : '',
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
    phone: typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null,
    phoneE164:
      typeof raw.phoneE164 === 'string' && raw.phoneE164.trim() ? raw.phoneE164.trim() : null,
  };
}

function rowToSupplier(row: SupplierRow): SupplierContact {
  return {
    comercio: row.comercio,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    name: row.name ?? '',
    notes: row.notes,
    phone: row.phone,
    phoneE164: row.phone_e164,
  };
}

async function readLocalSuppliers(organizationId: string): Promise<SupplierContact[]> {
  try {
    const raw = await getAppStorageItem(localStorageKey(organizationId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredSupplier[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeLocalSupplier(item))
      .filter((item): item is SupplierContact => item != null);
  } catch {
    return [];
  }
}

async function migrateLocalSuppliersOnce(organizationId: string): Promise<void> {
  const flag = await getAppStorageItem(migratedFlagKey(organizationId));
  if (flag === '1') {
    return;
  }

  const local = await readLocalSuppliers(organizationId);
  for (const supplier of local) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('comercio', supplier.comercio)
      .maybeSingle();

    if (existing) {
      continue;
    }

    await supabase.from('suppliers').insert({
      comercio: supplier.comercio,
      email: supplier.email,
      name: supplier.name,
      notes: supplier.notes,
      organization_id: organizationId,
      phone: supplier.phone,
      phone_e164: supplier.phoneE164,
    });
  }

  await setAppStorageItem(migratedFlagKey(organizationId), '1');
  await setAppStorageItem(localStorageKey(organizationId), JSON.stringify([]));
}

/** Label used in compras / product forms (comercio). */
export function supplierLabel(supplier: SupplierContact): string {
  return supplier.comercio.trim() || supplier.name.trim();
}

export async function listSuppliers(organizationId: string | null): Promise<SupplierContact[]> {
  await clearLegacyGlobalSuppliers();

  if (!organizationId) {
    return [];
  }

  await migrateLocalSuppliersOnce(organizationId);

  const { data, error } = await supabase
    .from('suppliers')
    .select('id, organization_id, comercio, name, email, phone, phone_e164, notes, created_at')
    .eq('organization_id', organizationId)
    .order('comercio', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as SupplierRow[])
    .map(rowToSupplier)
    .sort((left, right) => supplierLabel(left).localeCompare(supplierLabel(right), 'es'));
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

  await migrateLocalSuppliersOnce(organizationId);

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      comercio,
      email: input.email?.trim() || null,
      name,
      notes: input.notes?.trim() || null,
      organization_id: organizationId,
      phone: input.phone?.trim() || null,
      phone_e164: input.phoneE164 ?? null,
    })
    .select('id, organization_id, comercio, name, email, phone, phone_e164, notes, created_at')
    .single<SupplierRow>();

  if (error) {
    throw new Error(error.message);
  }

  return rowToSupplier(data);
}

export async function removeSupplier(params: {
  organizationId: string;
  supplierId: string;
}): Promise<void> {
  const organizationId = params.organizationId.trim();
  if (!organizationId) {
    return;
  }

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', params.supplierId)
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(error.message);
  }
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
