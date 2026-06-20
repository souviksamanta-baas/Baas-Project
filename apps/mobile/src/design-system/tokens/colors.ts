/** Nexolia color tokens — aligned with Confluence design system, using approved RN screen values. */
export const colors = {
  // Brand
  background: '#fbfcfb',
  navy: '#101935',
  primary: '#08bd66',
  primaryDark: '#04a85a',
  primaryLight: '#8ad5b5',
  primarySoft: '#e9f8ef',
  surface: '#ffffff',

  // Text
  textPrimary: '#101935',
  textSecondary: '#56627b',
  textMuted: '#7b86a0',
  placeholder: '#65708a',

  // Borders & dividers
  border: '#e4ebef',
  borderSoft: '#eef3f6',
  borderInput: '#dfe7ec',
  divider: '#edf2f4',

  // Semantic
  success: '#08bd66',
  warning: '#ff7f2e',
  warningSoft: '#fff0e4',
  danger: '#ff315f',
  dangerSoft: '#ffeaf0',
  info: '#3978e8',
  infoSoft: '#eef8ff',
  purple: '#6b4fc3',

  // Channel
  whatsapp: '#25d366',
  instagram: '#d94a8c',
  facebook: '#1877f2',
  email: '#6b4fc3',

  // Badge surfaces
  badgeNeutralBg: '#f1f3f5',
  badgeGreenBg: '#e9f8ef',
  badgeBlueBg: '#eef8ff',
  badgeOrangeBg: '#fff0e4',
  badgeRedBg: '#ffeaf0',

  // Legacy aliases (used across existing screens)
  slate: '#56627b',
  slateLight: '#7b86a0',
} as const;

export type ColorToken = keyof typeof colors;
