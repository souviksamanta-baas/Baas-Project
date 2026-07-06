import { supabase } from './supabase';

export function slugifyProductSku(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'PRODUCTO'
  );
}

export async function resolveUniqueProductSku(
  organizationId: string,
  productName: string,
): Promise<string> {
  let base = slugifyProductSku(productName);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('sku', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
