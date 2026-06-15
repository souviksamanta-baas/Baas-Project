import { StyleSheet } from 'react-native';

export const colors = {
  background: '#fbfcfb',
  border: '#e4ebef',
  borderSoft: '#eef3f6',
  danger: '#ff315f',
  email: '#6b4fc3',
  facebook: '#1877f2',
  instagram: '#d94a8c',
  navy: '#101935',
  primary: '#08bd66',
  primaryDark: '#04a85a',
  primarySoft: '#e9f8ef',
  slate: '#56627b',
  slateLight: '#7b86a0',
  surface: '#ffffff',
  warning: '#ff7f2e',
  warningSoft: '#fff0e4',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 22,
  pill: 999,
};

export const typography = {
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  title: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
};

export const shadows = StyleSheet.create({
  card: {
    shadowColor: colors.navy,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  dock: {
    shadowColor: colors.navy,
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
});
