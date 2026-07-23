import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const shadowValues = {
  sm: {
    shadowColor: colors.navy,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  md: {
    shadowColor: colors.navy,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  lg: {
    shadowColor: colors.navy,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
  },
} as const;

export const shadows = StyleSheet.create({
  card: {
    elevation: 2,
    shadowColor: colors.navy,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  dock: {
    elevation: 8,
    shadowColor: colors.navy,
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  sm: { ...shadowValues.sm, elevation: 2 },
  md: { ...shadowValues.md, elevation: 4 },
  lg: { ...shadowValues.lg, elevation: 8 },
});
