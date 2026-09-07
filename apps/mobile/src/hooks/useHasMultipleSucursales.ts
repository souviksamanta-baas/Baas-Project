import { hasMultipleSucursales } from '../types/features';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';

/**
 * True when Multisucursal is explicitly enabled for the active org
 * (`feature_flags.multi_sucursales`). Opt-in — not forced by Enterprise alone.
 */
export function useHasMultipleSucursales(): boolean {
  const { dashboard, featureFlags } = useOwnerSessionContext();
  return hasMultipleSucursales(dashboard?.features ?? featureFlags);
}
