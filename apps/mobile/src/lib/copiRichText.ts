export type CopiRichTextPart =
  | { type: 'text'; value: string }
  | { type: 'product'; productId: string; label: string }
  | { type: 'presupuesto'; quoteId: string; label: string };

const RICH_LINK_PATTERN =
  /\[\[(product|presupuesto):([^\]|]+)\|([^\]]+)\]\]/g;

export function parseCopiRichText(text: string): CopiRichTextPart[] {
  const parts: CopiRichTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(RICH_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    const kind = match[1];
    const id = (match[2] ?? '').trim();
    const label = (match[3] ?? '').trim();

    if (kind === 'presupuesto') {
      parts.push({
        label: label || `Presupuesto ${id}`,
        quoteId: id,
        type: 'presupuesto',
      });
    } else {
      parts.push({
        label: label || 'Producto',
        productId: id,
        type: 'product',
      });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}
