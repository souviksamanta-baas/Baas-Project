import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, screenPadding, spacing, textStyles } from '../tokens';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Screen(props: ScreenProps): ReactElement {
  return <View style={[styles.screen, props.style]}>{props.children}</View>;
}

export function ScreenContent(props: ScreenProps): ReactElement {
  return <View style={styles.content}>{props.children}</View>;
}

export function ScreenHeader(props: {
  onBack?: () => void;
  showBack?: boolean;
  subtitle?: string;
  title: string;
}): ReactElement {
  return (
    <View style={styles.headerRow}>
      {props.showBack !== false && props.onBack ? (
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <Text style={textStyles.pageTitle}>{props.title}</Text>
        {props.subtitle ? <Text style={textStyles.pageSubtitle}>{props.subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SectionHeader(props: {
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
}): ReactElement {
  return (
    <View style={[styles.sectionHeader, props.style]}>
      <Text style={textStyles.sectionTitle}>{props.title}</Text>
      {props.actionLabel ? (
        <Pressable onPress={props.onAction}>
          <Text style={styles.sectionAction}>{props.actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Stack(props: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }): ReactElement {
  return <View style={[styles.stack, { gap: props.gap ?? spacing.sm }, props.style]}>{props.children}</View>;
}

export function Row(props: {
  align?: 'center' | 'flex-start' | 'flex-end';
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}): ReactElement {
  return (
    <View
      style={[
        styles.row,
        { alignItems: props.align ?? 'center', gap: props.gap ?? spacing.xs },
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}

export function Divider(props: { style?: StyleProp<ViewStyle> }): ReactElement {
  return <View style={[styles.divider, props.style]} />;
}

const styles = StyleSheet.create({
  backPressable: {
    marginLeft: -6,
    marginTop: -8,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
  },
  content: {
    flex: 1,
    paddingBottom: screenPadding.y,
    paddingHorizontal: screenPadding.x,
  },
  divider: {
    backgroundColor: colors.divider,
    height: 1,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionAction: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '300',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  stack: {
    flexDirection: 'column',
  },
});
