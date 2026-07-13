/**
 * Inline product mentions in Copi answers.
 * Mobile parses these into tappable links to product detail.
 */
export function formatCopiProductLink(productId: string, name: string): string {
  const safeId = productId.trim();
  const safeName = name.replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Producto';
  if (!safeId) {
    return safeName;
  }

  return `[[product:${safeId}|${safeName}]]`;
}

export function collectProductsFromToolResults(
  toolResults: Array<{ payload: Record<string, unknown> }>,
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();

  for (const result of toolResults) {
    const payload = result.payload;
    rememberProducts(byId, payload.products);
    rememberProducts(byId, payload.items);
    rememberProducts(byId, payload.lots);
    if (payload.nearest && typeof payload.nearest === 'object') {
      rememberProduct(byId, payload.nearest as Record<string, unknown>);
    }
    if (payload.lowStock && typeof payload.lowStock === 'object') {
      const nested = payload.lowStock as Record<string, unknown>;
      rememberProducts(byId, nested.products);
    }
  }

  return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
}

export function ensureCopiProductLinks(
  answer: string,
  products: Array<{ id: string; name: string }>,
): string {
  if (!answer || products.length === 0) {
    return answer;
  }

  const sorted = [...products]
    .filter((product) => product.id && product.name.trim().length > 0)
    .sort((left, right) => right.name.trim().length - left.name.trim().length);

  const tokens = answer.split(/(\[\[product:[0-9a-fA-F-]{36}\|[^\]]+\]\])/g);
  return tokens
    .map((token) => {
      if (/^\[\[product:/i.test(token)) {
        return token;
      }

      let segment = token;
      for (const product of sorted) {
        const bareName = product.name.trim();
        segment = segment.replace(
          new RegExp(escapeRegExp(bareName), 'gi'),
          formatCopiProductLink(product.id, bareName),
        );
      }

      return segment;
    })
    .join('');
}

function rememberProducts(byId: Map<string, string>, value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (item && typeof item === 'object') {
      rememberProduct(byId, item as Record<string, unknown>);
    }
  }
}

function rememberProduct(byId: Map<string, string>, item: Record<string, unknown>): void {
  const id =
    (typeof item.id === 'string' && item.id) ||
    (typeof item.productId === 'string' && item.productId) ||
    '';
  const name =
    (typeof item.name === 'string' && item.name) ||
    (typeof item.productName === 'string' && item.productName) ||
    '';

  if (id && name) {
    byId.set(id, name);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
