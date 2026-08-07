import { Platform } from 'react-native';

/** 4px-based spacing scale from Nexolia design system. */
export const spacing = {
  /** 4px — micro gaps */
  xxs: 4,
  /** 20px — stacked box rhythm on scroll screens */
  boxGap: 20,
  /** 8px — icon/text spacing */
  xs: 8,
  /** 12px — compact internal spacing */
  sm: 12,
  /** 16px — standard internal padding */
  md: 16,
  /** 20px — screen vertical rhythm */
  lg: 20,
  /** 24px — section spacing, card padding */
  xl: 24,
  /** 32px — large vertical gaps */
  xxl: 32,
  /** 40px — page-level separation */
  xxxl: 40,
} as const;

export const screenPadding = {
  x: 24,
  y: 20,
} as const;

export const layout = {
  /** iOS / web floating dock clearance (content padding under absolute dock). */
  bottomNavClearance: 100,
  minTapTarget: 44,
  listRowMinHeight: 72,
  /** Android fixed tab bar content height (excludes system nav inset). */
  tabBarHeight: 56,
} as const;

/**
 * Scroll/content padding so lists clear the bottom nav.
 * Android: edge-to-edge tab bar + system navigation inset.
 * iOS / web: floating pill dock clearance.
 */
export function getBottomNavClearance(safeAreaBottom = 0): number {
  if (Platform.OS === 'android') {
    return layout.tabBarHeight + Math.max(safeAreaBottom, 0) + 12;
  }
  return layout.bottomNavClearance;
}
