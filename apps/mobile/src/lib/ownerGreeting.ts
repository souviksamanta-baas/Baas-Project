type OwnerNameMetadata = {
  full_name?: unknown;
  preferred_name?: unknown;
};

/** Prefer preferred_name; otherwise first word of full_name. */
export function resolveOwnerGreetingName(metadata: OwnerNameMetadata | null | undefined): string {
  const preferred = String(metadata?.preferred_name ?? '').trim();
  if (preferred.length > 0) {
    return preferred.split(/\s+/)[0] ?? preferred;
  }

  const fullName = String(metadata?.full_name ?? '').trim();
  if (fullName.length > 0) {
    return fullName.split(/\s+/)[0] ?? fullName;
  }

  return '';
}
