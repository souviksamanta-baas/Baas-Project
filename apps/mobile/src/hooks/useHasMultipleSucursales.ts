import { useBusinessCenters } from './useBusinessCenters';

/** True when the org has more than one business center (Sucursal field visible). */
export function useHasMultipleSucursales(): boolean {
  const businessCenters = useBusinessCenters();
  return businessCenters.length > 1;
}
