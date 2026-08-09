import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { hasMultipleSucursales } from '../types/features';

/** True only when the org explicitly enables multi-sucursales (default: false). */
export function useHasMultipleSucursales(): boolean {
  const { dashboard } = useOwnerSessionContext();
  return hasMultipleSucursales(dashboard?.features);
}
