export interface CopiFeatureFlags {
  copi_basic_reports?: boolean;
  copi_custom_reports?: boolean;
  copi_enabled?: boolean;
  copi_freeform_questions?: boolean;
  copi_pro_agent?: boolean;
  copi_vision?: boolean;
  copi_voice?: boolean;
}

/** Org-level product flags (includes Copi + operational toggles). */
export interface OrganizationFeatureFlags extends CopiFeatureFlags {
  /** When false (default), hide Sucursal/centro fields on product screens. */
  multi_sucursales?: boolean;
}

export const DEFAULT_COPI_FEATURE_FLAGS: Required<CopiFeatureFlags> = {
  copi_basic_reports: true,
  copi_custom_reports: false,
  copi_enabled: true,
  copi_freeform_questions: true,
  copi_pro_agent: false,
  copi_vision: false,
  copi_voice: false,
};

export const DEFAULT_ORGANIZATION_FEATURE_FLAGS: Required<OrganizationFeatureFlags> = {
  ...DEFAULT_COPI_FEATURE_FLAGS,
  multi_sucursales: false,
};

export function hasMultipleSucursales(
  features?: OrganizationFeatureFlags | null,
): boolean {
  return features?.multi_sucursales === true;
}
