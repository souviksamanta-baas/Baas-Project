import { supabase } from './supabase';

export type ProductCategoryRow = {
  archived_at: string | null;
  created_at: string;
  id: string;
  name: string;
  organization_id: string;
};

const GRANEL_NAME = 'Granel';

export function isGranelCategoryName(name: string): boolean {
  return name.trim().toLowerCase() === 'granel';
}

export async function listProductCategories(
  organizationId: string,
): Promise<ProductCategoryRow[]> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, organization_id, name, created_at, archived_at')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductCategoryRow[];
}

/** Ensure the Granel catalog row exists for the org (not linked to any product). */
export async function ensureGranelCategory(organizationId: string): Promise<ProductCategoryRow> {
  const existing = await listProductCategories(organizationId);
  const found = existing.find((row) => isGranelCategoryName(row.name));
  if (found) {
    return found;
  }

  const { data, error } = await supabase
    .from('product_categories')
    .insert({ name: GRANEL_NAME, organization_id: organizationId })
    .select('id, organization_id, name, created_at, archived_at')
    .single<ProductCategoryRow>();

  if (error) {
    // Race: another client may have inserted Granel.
    const retry = await listProductCategories(organizationId);
    const again = retry.find((row) => isGranelCategoryName(row.name));
    if (again) {
      return again;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function upsertProductCategoriesByName(
  organizationId: string,
  names: string[],
): Promise<ProductCategoryRow[]> {
  const cleaned = [
    ...new Set(
      names
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ];

  if (cleaned.length === 0) {
    return [];
  }

  await ensureGranelCategory(organizationId);

  const existing = await listProductCategories(organizationId);
  const byLower = new Map(existing.map((row) => [row.name.trim().toLowerCase(), row]));
  const resolved: ProductCategoryRow[] = [];

  for (const name of cleaned) {
    const key = name.toLowerCase();
    const found = byLower.get(key);
    if (found) {
      resolved.push(found);
      continue;
    }

    const { data, error } = await supabase
      .from('product_categories')
      .insert({ name, organization_id: organizationId })
      .select('id, organization_id, name, created_at, archived_at')
      .single<ProductCategoryRow>();

    if (error) {
      const refreshed = await listProductCategories(organizationId);
      const raced = refreshed.find((row) => row.name.trim().toLowerCase() === key);
      if (!raced) {
        throw new Error(error.message);
      }
      byLower.set(key, raced);
      resolved.push(raced);
      continue;
    }

    byLower.set(key, data);
    resolved.push(data);
  }

  return resolved;
}

export async function setProductCategoryLinks(
  productId: string,
  categoryIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(categoryIds)];

  const { error: deleteError } = await supabase
    .from('product_category_links')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (uniqueIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('product_category_links').insert(
    uniqueIds.map((category_id) => ({ category_id, product_id: productId })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function getCategoryNamesForProducts(
  productIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (productIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from('product_category_links')
    .select('product_id, product_categories!inner(name, archived_at)')
    .in('product_id', productIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const productId = row.product_id as string;
    const category = Array.isArray(row.product_categories)
      ? row.product_categories[0]
      : row.product_categories;
    const name =
      category &&
      typeof category === 'object' &&
      'name' in category &&
      typeof (category as { name: unknown }).name === 'string'
        ? (category as { name: string; archived_at?: string | null }).name.trim()
        : '';
    const archived =
      category &&
      typeof category === 'object' &&
      'archived_at' in category
        ? (category as { archived_at?: string | null }).archived_at
        : null;

    if (!name || archived) {
      continue;
    }

    const current = result.get(productId) ?? [];
    if (!current.some((item) => item.toLowerCase() === name.toLowerCase())) {
      current.push(name);
      result.set(productId, current);
    }
  }

  for (const [productId, names] of result) {
    result.set(
      productId,
      [...names].sort((left, right) => left.localeCompare(right, 'es')),
    );
  }

  return result;
}
