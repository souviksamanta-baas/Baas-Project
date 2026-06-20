import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '../tokens';

export type CardVariant = 'default' | 'soft' | 'mint' | 'info';

type CardProps = {
  children: ReactNode;
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export function Card(props: CardProps): ReactElement {
  const variant = props.variant ?? 'default';
  return (
    <View style={[styles.base, variantStyles[variant], props.flush && styles.flush, props.style]}>
      {props.children}
    </View>
  );
}

export function SectionCard(props: CardProps): ReactElement {
  return <Card {...props} style={[styles.section, props.style]} />;
}

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  info: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
    borderWidth: 1,
  },
  mint: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(8, 189, 102, 0.18)',
    borderWidth: 1,
  },
  soft: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
  },
});

const styles = StyleSheet.create({
  base: {
    ...shadows.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  flush: {
    overflow: 'hidden',
    padding: 0,
  },
  section: {
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
});
