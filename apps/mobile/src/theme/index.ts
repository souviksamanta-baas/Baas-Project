/** Backward-compatible theme re-exports. Prefer importing from `design-system` in new code. */
export { colors } from '../design-system/tokens/colors';
export { shadows, typography } from '../design-system/tokens';

/** Legacy spacing scale used by existing screens (xs=4 … xxl=24). */
export const spacing = {
  lg: 16,
  md: 12,
  sm: 8,
  xl: 20,
  xs: 4,
  xxl: 24,
};

/** Legacy radius scale used by existing screens. */
export const radius = {
  lg: 14,
  md: 12,
  pill: 999,
  sm: 8,
  xl: 22,
};
