import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, textStyles } from '../tokens';

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

type ListBoxProps = {
  children: ReactNode;
  headerAction?: { label: string; onPress?: () => void };
  headerMeta?: string;
  headerRight?: ReactNode;
  headerSubtitle?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
};

/** Bordered list container with an internal title row — used across home and inventory screens. */
export function ListBox(props: ListBoxProps): ReactElement {
  return (
    <View style={[styles.listBox, props.style]}>
      <View style={[styles.listBoxHeader, props.headerSubtitle ? styles.listBoxHeaderStacked : null]}>
        <View style={styles.listBoxHeaderMain}>
          <Text style={textStyles.sectionTitle}>{props.title}</Text>
          {props.headerSubtitle ? <Text style={styles.listBoxSubtitle}>{props.headerSubtitle}</Text> : null}
        </View>
        {props.headerMeta ? <Text style={styles.listBoxMeta}>{props.headerMeta}</Text> : null}
        {props.headerRight ??
          (props.headerAction ? (
            <Pressable onPress={props.headerAction.onPress}>
              <Text style={styles.listBoxAction}>{props.headerAction.label} ›</Text>
            </Pressable>
          ) : null)}
      </View>
      {props.children}
    </View>
  );
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
  listBox: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listBoxAction: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '300',
  },
  listBoxHeader: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listBoxHeaderMain: {
    flex: 1,
  },
  listBoxHeaderStacked: {
    alignItems: 'flex-start',
  },
  listBoxMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  listBoxSubtitle: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 4,
  },
  section: {
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
});
