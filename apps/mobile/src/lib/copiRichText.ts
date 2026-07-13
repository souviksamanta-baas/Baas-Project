export type CopiRichTextPart =
  | { type: 'text'; value: string }
  | { type: 'product'; productId: string; label: string };

const PRODUCT_LINK_PATTERN = /\[\[product:([0-9a-fA-F-]{36})\|([^\]]+)\]\]/g;

export function parseCopiRichText(text: string): CopiRichTextPart[] {
  const parts: CopiRichTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PRODUCT_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    parts.push({
      label: match[2] ?? 'Producto',
      productId: match[1] ?? '',
      type: 'product',
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}
