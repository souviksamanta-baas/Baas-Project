/** Strip leftover Copi glue so the task body reads as a clean note. */
export function prepareTaskBody(
  description: string | null,
  presupuestoId: string | null,
): string | null {
  if (!description?.trim()) {
    return null;
  }

  let next = description
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Drop appended / inline presupuesto references (shown as a dedicated row).
  next = next
    .replace(/\b(?:también\s+)?presupuesto\s*[:·-]?\s*PRES-[A-Z0-9]+\b/gi, ' ')
    .replace(/\bPRES-[A-Z0-9]+\b/gi, ' ')
    .replace(/\b(?:también|tambien)\b/gi, ' ')
    .replace(/\bpresupuesto\s*[:·-]?\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:·-]+|[\s.,;:·-]+$/g, '')
    .trim();

  if (!next) {
    return null;
  }

  // If the only content was the presupuesto code, skip the body.
  if (presupuestoId && next.toUpperCase() === presupuestoId.toUpperCase()) {
    return null;
  }

  return next;
}
