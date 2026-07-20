import type { Product } from '../types/products';
import {
  isProductCodeUnavailable,
  readProductCodeType,
  readProductCodeValue,
  type ProductCodeTypeSlug,
} from './productCatalog';

export function findProductByScannedCode(products: Product[], scanned: string): Product | null {
  const needle = scanned.trim().toLocaleLowerCase('es');
  if (!needle) {
    return null;
  }

  const exact = products.find((product) => {
    if (isProductCodeUnavailable(product)) {
      return false;
    }

    const code = readProductCodeValue(product).toLocaleLowerCase('es');
    const sku = product.sku?.trim().toLocaleLowerCase('es') ?? '';
    return code === needle || sku === needle;
  });

  if (exact) {
    return exact;
  }

  return (
    products.find((product) => {
      const code = readProductCodeValue(product).toLocaleLowerCase('es');
      const sku = product.sku?.trim().toLocaleLowerCase('es') ?? '';
      return code.includes(needle) || sku.includes(needle);
    }) ?? null
  );
}

export function generateProductCodeValue(
  product: Product,
  codeType: ProductCodeTypeSlug,
  options?: { forceNew?: boolean },
): string {
  const existing = readProductCodeValue(product);
  if (
    !options?.forceNew &&
    !isProductCodeUnavailable(product) &&
    readProductCodeType(product) === codeType
  ) {
    return existing;
  }

  if (codeType === 'qr') {
    const base = product.sku?.trim() || `NX-${product.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    return options?.forceNew ? `${base}-${Date.now().toString(36).slice(-4).toUpperCase()}` : base;
  }

  const fromSku = (product.sku ?? '').replace(/\D/g, '');
  if (!options?.forceNew && fromSku.length >= 8) {
    return fromSku.slice(0, 13);
  }

  const fromId = product.id.replace(/\D/g, '');
  return (`779${fromId}${Date.now()}`).replace(/\D/g, '').slice(0, 13);
}
