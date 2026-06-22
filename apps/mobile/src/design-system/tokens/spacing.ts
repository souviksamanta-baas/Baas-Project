/** 4px-based spacing scale from Nexolia design system. */
export const spacing = {
  /** 4px — micro gaps */
  xxs: 4,
  /** 10px — stacked box rhythm on scroll screens */
  boxGap: 10,
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
  bottomNavClearance: 96,
  minTapTarget: 44,
  listRowMinHeight: 72,
} as const;
