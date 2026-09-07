import { hasMultipleSucursales } from '../types/features';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';

/**
 * True when Multisucursal is entitled for the active org
 * (`multi_sucursales` flag — forced on by Enterprise plan entitlements).
 */
export function useHasMultipleSucursales(): boolean {
  const { dashboard, featureFlags } = useOwnerSessionContext();
  return hasMultipleSucursales(dashboard?.features ?? featureFlags);
}
