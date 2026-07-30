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

/**
 * Type scale aligned with WhatsApp / iOS Large Title conventions:
 * page titles ~34, row titles ~17, previews/captions ~15, tab labels ~10–11.
 */
export const textStyles = {
  displayLg: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  headingMd: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    lineHeight: 25,
  },
  bodyLg: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  bodyMd: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  bodySm: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: fontWeight.regular,
    lineHeight: 20,
  },
  metricLg: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  metricMd: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    lineHeight: 25,
  },
  listTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    lineHeight: 22,
  },
  listBody: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: fontWeight.regular,
    lineHeight: 20,
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
    fontWeight: fontWeight.semibold,
    lineHeight: 22,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: fontWeight.regular,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  fieldValue: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  badge: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
  },
  buttonCompact: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },
  /** Bottom tab / compact chrome labels (WhatsApp ~10–11). */
  tabLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    lineHeight: 12,
  },
} as const;

/** Backward-compatible typography export used by theme/index.ts. */
export const typography = {
  sectionTitle: textStyles.sectionTitle,
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
};
