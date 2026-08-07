import type { Product } from '../types/products';
import {
  isProductCodeUnavailable,
  readProductCodeType,
  readProductCodeValue,
  type ProductCodeTypeSlug,
} from './productCatalog';

/** Normalize scanned / stored codes for comparison. */
export function normalizeProductCode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

/**
 * Build match candidates for a scanned value (case folding + common EAN/UPC variants).
 */
export function productCodeMatchCandidates(scanned: string): string[] {
  const normalized = normalizeProductCode(scanned);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([
    normalized,
    normalized.toLocaleLowerCase('es'),
  ]);

  if (/^\d+$/.test(normalized)) {
    if (normalized.length === 12) {
      candidates.add(`0${normalized}`);
    }
    if (normalized.length === 13 && normalized.startsWith('0')) {
      candidates.add(normalized.slice(1));
    }
    // Drop leading zeros for loose numeric match (keep original too).
    const stripped = normalized.replace(/^0+/, '');
    if (stripped && stripped !== normalized) {
      candidates.add(stripped);
    }
  }

  return [...candidates];
}

function productCodeHaystack(product: Product): string[] {
  const metadata = product.metadata ?? {};
  const values = [
    readProductCodeValue(product),
    product.sku,
    typeof metadata.codigo === 'string' ? metadata.codigo : null,
    typeof metadata.codigo_barras === 'string' ? metadata.codigo_barras : null,
  ];

  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeProductCode(value))
    .flatMap((value) => productCodeMatchCandidates(value));
}

export function findProductByScannedCode(products: Product[], scanned: string): Product | null {
  const needles = productCodeMatchCandidates(scanned).map((value) =>
    value.toLocaleLowerCase('es'),
  );
  if (needles.length === 0) {
    return null;
  }

  const exact = products.find((product) => {
    if (isProductCodeUnavailable(product)) {
      return false;
    }

    const haystack = productCodeHaystack(product).map((value) => value.toLocaleLowerCase('es'));
    return needles.some((needle) => haystack.includes(needle));
  });

  if (exact) {
    return exact;
  }

  // Partial fallback for short / truncated scans.
  const primary = needles[0];
  if (primary.length < 4) {
    return null;
  }

  return (
    products.find((product) => {
      if (isProductCodeUnavailable(product)) {
        return false;
      }

      const haystack = productCodeHaystack(product).map((value) => value.toLocaleLowerCase('es'));
      return haystack.some(
        (value) => value.includes(primary) || primary.includes(value),
      );
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
    const base =
      product.sku?.trim() || `NX-${product.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    return options?.forceNew ? `${base}-${Date.now().toString(36).slice(-4).toUpperCase()}` : base;
  }

  const fromSku = (product.sku ?? '').replace(/\D/g, '');
  if (!options?.forceNew && fromSku.length >= 8) {
    return fromSku.slice(0, 13);
  }

  const fromId = product.id.replace(/\D/g, '');
  return (`779${fromId}${Date.now()}`).replace(/\D/g, '').slice(0, 13);
}
