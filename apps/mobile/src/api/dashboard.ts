import { supabase } from '../lib/supabase';
import type { OwnerDashboard } from '../types/dashboard';

export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  const { data, error } = await supabase.rpc('get_owner_dashboard');

  if (error) {
    throw new Error(error.message);
  }

  return data as OwnerDashboard;
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

export async function createOrganizationWithOwner(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    org_name: name,
    org_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
