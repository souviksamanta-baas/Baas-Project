import { colors } from './colors';

export const fontFamily = {
  primary: 'System',
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/** Full type scale from Nexolia design system. */
export const textStyles = {
  displayLg: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.68,
    lineHeight: 40,
  },
  headingMd: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.33,
    lineHeight: 28,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.22,
    lineHeight: 28,
  },
  bodyLg: {
    color: colors.textSecondary,
    fontSize: 19,
    fontWeight: fontWeight.regular,
    lineHeight: 28,
  },
  bodyMd: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: fontWeight.regular,
    lineHeight: 25,
  },
  bodySm: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  metricLg: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.42,
    lineHeight: 34,
  },
  metricMd: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.38,
    lineHeight: 31,
  },
  listTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    lineHeight: 24,
  },
  listBody: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  labelMd: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  labelSm: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  buttonMd: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: fontWeight.bold,
    lineHeight: 22,
  },
  // Inventory / compact screen presets (approved mockups)
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.regular,
    lineHeight: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: fontWeight.semibold,
  },
  fieldValue: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: fontWeight.regular,
  },
  badge: {
    fontSize: 9,
    fontWeight: fontWeight.regular,
  },
  buttonCompact: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
} as const;

/** Backward-compatible typography export used by theme/index.ts. */
export const typography = {
  sectionTitle: textStyles.sectionTitle,
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
};
