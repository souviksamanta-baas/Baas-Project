import { listBusinessCenters } from '../api/dashboard';
import {
  clearPreferredBusinessCenterId,
  getPreferredBusinessCenterId,
} from '../lib/activeBusinessCenter';
import { hasMultipleSucursales } from '../types/features';
import type { OwnerDashboard } from '../types/dashboard';

/**
 * When Multisucursal is enabled, overlay the user's preferred business center
 * onto the dashboard payload (RPC still returns the default center).
 */
export async function applyPreferredBusinessCenter(
  dashboard: OwnerDashboard,
): Promise<OwnerDashboard> {
  const organizationId = dashboard.organization?.id ?? null;
  const defaultCenter = dashboard.businessCenter;
  if (!organizationId || !defaultCenter) {
    return dashboard;
  }

  if (!hasMultipleSucursales(dashboard.features)) {
    return dashboard;
  }

  const preferredId = await getPreferredBusinessCenterId(organizationId);
  if (!preferredId || preferredId === defaultCenter.id) {
    return dashboard;
  }

  try {
    const centers = await listBusinessCenters(organizationId);
    const preferred = centers.find((center) => center.id === preferredId);
    if (!preferred) {
      await clearPreferredBusinessCenterId(organizationId);
      return dashboard;
    }

    return {
      ...dashboard,
      businessCenter: {
        ...defaultCenter,
        id: preferred.id,
        name: preferred.name,
        timezone: preferred.timezone ?? defaultCenter.timezone,
      },
    };
  } catch {
    return dashboard;
  }
}
