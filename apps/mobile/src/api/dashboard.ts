import { supabase } from '../lib/supabase';
import { getPreferredOrganizationId } from '../lib/activeOrganization';
import { normalizeNavShortcutId } from '../lib/navShortcut';
import type { OwnerDashboard } from '../types/dashboard';
import type { OrganizationFeatureFlags } from '../types/features';

export type OrganizationVertical = {
  description: string | null;
  display_name: string;
  id: string;
  slug: string;
  sort_order: number;
  suggested_feature_flags: OrganizationFeatureFlags;
};

export type MyOrganization = {
  createdAt: string;
  name: string;
  organizationId: string;
  role: string;
};

export async function getOwnerDashboard(
  organizationId?: string | null,
): Promise<OwnerDashboard> {
  const preferred =
    organizationId === undefined ? await getPreferredOrganizationId() : organizationId;
  const { data, error } = await supabase.rpc('get_owner_dashboard', {
    p_organization_id: preferred ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const dashboard = data as OwnerDashboard;
  if (dashboard.organization) {
    dashboard.organization.navShortcut = normalizeNavShortcutId(dashboard.organization.navShortcut);
  }

  return dashboard;
}

export async function listMyOrganizations(): Promise<MyOrganization[]> {
  const { data, error } = await supabase.rpc('get_my_organizations');
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    created_at: string;
    name: string;
    organization_id: string;
    role: string;
  }>).map((row) => ({
    createdAt: row.created_at,
    name: row.name,
    organizationId: row.organization_id,
    role: row.role,
  }));
}

export async function listOrganizationVerticals(): Promise<OrganizationVertical[]> {
  const { data, error } = await supabase.rpc('list_organization_verticals');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as OrganizationVertical[];
}

export async function listBusinessCenters(
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('business_centers')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function createOrganizationWithOwner(
  name: string,
  options?: {
    featureFlags?: OrganizationFeatureFlags;
    navShortcut?: string;
    verticalId?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    org_name: name,
    org_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    ...(options?.verticalId ? { org_vertical_id: options.verticalId } : {}),
    ...(options?.featureFlags ? { org_feature_flags: options.featureFlags } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }

  const organizationId = data as string;
  if (options?.navShortcut) {
    const { error: shortcutError } = await supabase
      .from('organizations')
      .update({ nav_shortcut: normalizeNavShortcutId(options.navShortcut) })
      .eq('id', organizationId);

    if (shortcutError) {
      throw new Error(shortcutError.message);
    }
  }

  return organizationId;
}
