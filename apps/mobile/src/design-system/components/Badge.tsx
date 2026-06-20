import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '../../components/icons';
import { colors, radius, textStyles } from '../tokens';

export type BadgeTone = 'green' | 'blue' | 'orange' | 'red' | 'neutral' | 'whatsapp' | 'instagram' | 'facebook' | 'email';

type BadgeProps = {
  icon?: 'box';
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: BadgeTone;
};

const toneStyles = StyleSheet.create({
  blue: {
    backgroundColor: colors.badgeBlueBg,
    color: colors.info,
  },
  email: {
    backgroundColor: colors.badgeNeutralBg,
    color: colors.email,
  },
  facebook: {
    backgroundColor: colors.badgeNeutralBg,
    color: colors.facebook,
  },
  green: {
    backgroundColor: colors.badgeGreenBg,
    color: colors.primary,
  },
  instagram: {
    backgroundColor: colors.badgeNeutralBg,
    color: colors.instagram,
  },
  neutral: {
    backgroundColor: colors.badgeNeutralBg,
    color: colors.slate,
  },
  orange: {
    backgroundColor: colors.badgeOrangeBg,
    color: colors.warning,
  },
  red: {
    backgroundColor: colors.badgeRedBg,
    color: colors.danger,
  },
  whatsapp: {
    backgroundColor: colors.badgeGreenBg,
    color: colors.whatsapp,
  },
});

export function Badge(props: BadgeProps): ReactElement {
  const tone = props.tone ?? 'green';
  const toneStyle = toneStyles[tone];

  return (
    <View style={[styles.badge, toneStyle, props.style]}>
      {props.icon === 'box' ? (
        <View style={styles.iconRow}>
          <Icon color={colors.info} kind="box" size={12} strokeWidth={1.9} />
          <Text style={[textStyles.badge, toneStyle]}>{props.label}</Text>
        </View>
      ) : (
        <Text style={[textStyles.badge, toneStyle]}>{props.label}</Text>
      )}
    </View>
  );
}

export function ChannelBadge(props: { channel: 'whatsapp' | 'instagram' | 'facebook' | 'email' }): ReactElement {
  return <Badge label={props.channel} tone={props.channel} />;
}

export function StatusDot(props: { tone?: 'primary' | 'danger' | 'warning' }): ReactElement {
  const tone = props.tone ?? 'primary';
  return <View style={[styles.dot, tone === 'danger' && styles.dotDanger, tone === 'warning' && styles.dotWarning]} />;
}

type ChipProps = {
  active?: boolean;
  label: string;
  small?: boolean;
};

export function Chip(props: ChipProps): ReactElement {
  return (
    <View style={[styles.chip, props.small && styles.chipSmall, props.active && styles.chipActive]}>
      <Text style={[styles.chipText, props.active && styles.chipTextActive]}>{props.label}</Text>
    </View>
  );
}

export function InfoBanner(props: { children: ReactNode }): ReactElement {
  return (
    <View style={styles.infoBanner}>
      <Icon color={colors.info} kind="info" size={14} strokeWidth={1.8} />
      <Text style={styles.infoBannerText}>{props.children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chip: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipSmall: {
    height: 24,
  },
  chipText: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  dotDanger: {
    backgroundColor: colors.danger,
  },
  dotWarning: {
    backgroundColor: colors.warning,
  },
  iconRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  infoBanner: {
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBannerText: {
    color: colors.navy,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 15,
  },
});
