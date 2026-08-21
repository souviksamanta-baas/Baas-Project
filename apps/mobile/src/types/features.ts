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
  /** Baseline */
  account?: boolean;
  browser_session?: boolean;
  help_privacy?: boolean;
  inbox?: boolean;
  integrations?: boolean;
  tasks?: boolean;

  /** Core optional */
  integrations_email?: boolean;
  integrations_instagram?: boolean;
  integrations_messenger?: boolean;
  integrations_sms?: boolean;
  integrations_whatsapp?: boolean;
  notifications?: boolean;

  /** Commerce */
  commerce_inventory?: boolean;
  commerce_lots?: boolean;
  commerce_nav_shortcut?: boolean;
  commerce_pos?: boolean;
  commerce_purchases?: boolean;
  commerce_suppliers?: boolean;

  /** Billing */
  billing_arca?: boolean;
  billing_cash?: boolean;
  billing_invoices?: boolean;
  billing_quotes?: boolean;

  /** Appointments */
  appointments?: boolean;

  /** Ops */
  multi_sucursales?: boolean;
}

export const BASELINE_FEATURE_FLAGS: Array<keyof OrganizationFeatureFlags> = [
  'account',
  'browser_session',
  'copi_basic_reports',
  'copi_enabled',
  'copi_freeform_questions',
  'help_privacy',
  'inbox',
  'integrations',
  'tasks',
];

export const DEFAULT_COPI_FEATURE_FLAGS: Required<CopiFeatureFlags> = {
  copi_basic_reports: true,
  copi_custom_reports: false,
  copi_enabled: true,
  copi_freeform_questions: true,
  copi_pro_agent: false,
  copi_vision: false,
  copi_voice: false,
};

/** Full-commerce defaults (legacy / kiosco-like). */
export const DEFAULT_ORGANIZATION_FEATURE_FLAGS: Required<OrganizationFeatureFlags> = {
  ...DEFAULT_COPI_FEATURE_FLAGS,
  account: true,
  appointments: false,
  billing_arca: true,
  billing_cash: false,
  billing_invoices: true,
  billing_quotes: true,
  browser_session: true,
  commerce_inventory: true,
  commerce_lots: true,
  commerce_nav_shortcut: true,
  commerce_pos: true,
  commerce_purchases: true,
  commerce_suppliers: true,
  help_privacy: true,
  inbox: true,
  integrations: true,
  integrations_email: true,
  integrations_instagram: true,
  integrations_messenger: true,
  integrations_sms: true,
  integrations_whatsapp: true,
  multi_sucursales: false,
  notifications: true,
  tasks: true,
};

/** Soft suggestions when picking sector during onboarding (not enforced at runtime). */
export const VERTICAL_SUGGESTED_FLAGS: Record<string, Partial<OrganizationFeatureFlags>> = {
  kiosco: {
    appointments: false,
    commerce_inventory: true,
    commerce_lots: true,
    commerce_nav_shortcut: true,
    commerce_pos: true,
    commerce_purchases: true,
    commerce_suppliers: true,
  },
  dietetica: {
    appointments: false,
    commerce_inventory: true,
    commerce_lots: true,
    commerce_nav_shortcut: true,
    commerce_pos: true,
    commerce_purchases: true,
    commerce_suppliers: true,
  },
  servicios_profesionales: {
    appointments: true,
    commerce_inventory: false,
    commerce_lots: false,
    commerce_nav_shortcut: false,
    commerce_pos: false,
    commerce_purchases: false,
    commerce_suppliers: false,
  },
};

export function resolveOrganizationFeatureFlags(
  features?: OrganizationFeatureFlags | null,
): Required<OrganizationFeatureFlags> {
  const merged: Required<OrganizationFeatureFlags> = {
    ...DEFAULT_ORGANIZATION_FEATURE_FLAGS,
    ...(features ?? {}),
  };
  for (const key of BASELINE_FEATURE_FLAGS) {
    merged[key] = true as never;
  }
  return merged;
}

export function hasMultipleSucursales(
  features?: OrganizationFeatureFlags | null,
): boolean {
  return resolveOrganizationFeatureFlags(features).multi_sucursales === true;
}

export function isCommerceEnabled(features?: OrganizationFeatureFlags | null): boolean {
  const f = resolveOrganizationFeatureFlags(features);
  return (
    f.commerce_inventory ||
    f.commerce_lots ||
    f.commerce_pos ||
    f.commerce_purchases ||
    f.commerce_suppliers
  );
}
