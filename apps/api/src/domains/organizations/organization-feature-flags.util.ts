/**
 * Plan entitlements vs lead/module selection.
 *
 * Lead feature_flags can customize modules (agenda, caja, etc.), but paid-tier
 * plans must not lose Copi Pro (or Enterprise multi-sucursal) because the user
 * left Copi en básico in paso 3.
 */

export const COPI_PRO_FLAG_KEYS = [
  'copi_pro_agent',
  'copi_voice',
  'copi_vision',
  'copi_custom_reports',
] as const;

export type CopiProFlagKey = (typeof COPI_PRO_FLAG_KEYS)[number];

export function normalizePlanSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase();
}

/** Pro / Enterprise (and legacy Max / Advanced) include Copi Pro. */
export function planIncludesCopiPro(slug: string | null | undefined): boolean {
  const s = normalizePlanSlug(slug);
  return s === 'pro' || s === 'enterprise' || s === 'max' || s === 'advanced';
}

export function planIncludesMultiSucursales(
  slug: string | null | undefined,
): boolean {
  const s = normalizePlanSlug(slug);
  return s === 'enterprise' || s === 'max' || s === 'advanced';
}

/** Force plan-tier entitlements onto a feature_flags map. */
export function applyPlanEntitlements(params: {
  flags: Record<string, boolean>;
  planSlug?: string | null;
}): Record<string, boolean> {
  const next: Record<string, boolean> = { ...params.flags };

  if (planIncludesCopiPro(params.planSlug)) {
    for (const key of COPI_PRO_FLAG_KEYS) {
      next[key] = true;
    }
  }

  if (planIncludesMultiSucursales(params.planSlug)) {
    next.multi_sucursales = true;
  }

  return next;
}

/**
 * Merge plan defaults with lead/org selection, then re-apply plan entitlements
 * so Copi Pro cannot be turned off by a "Copi básico" selection on Pro+.
 */
export function mergeLeadAndPlanFeatureFlags(params: {
  leadFlags?: Record<string, boolean> | null;
  planFlags?: Record<string, boolean> | null;
  planSlug?: string | null;
}): Record<string, boolean> {
  const merged: Record<string, boolean> = {
    ...(params.planFlags ?? {}),
    ...(params.leadFlags ?? {}),
  };
  return applyPlanEntitlements({
    flags: merged,
    planSlug: params.planSlug,
  });
}
