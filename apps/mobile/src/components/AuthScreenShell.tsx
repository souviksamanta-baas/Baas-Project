import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card, colors, spacing, textStyles } from '../design-system';

const AUTH_CARD_MAX_WIDTH = 420;

export function AuthScreenShell(props: {
  children: ReactNode;
  subtitle?: string;
  title?: string;
}): ReactElement {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.lg * 2, AUTH_CARD_MAX_WIDTH);

  return (
    <View style={styles.page}>
      <View style={[styles.cardWrap, { maxWidth: cardWidth, width: '100%' }]}>
        {props.title ? <Text style={textStyles.headingMd}>{props.title}</Text> : null}
        {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
        <Card style={styles.card}>{props.children}</Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  cardWrap: {
    alignSelf: 'center',
    width: '100%',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: '100%',
  },
  subtitle: {
    ...textStyles.bodyMd,
    marginTop: spacing.xs,
  },
});
