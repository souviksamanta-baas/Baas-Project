import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconKind } from '../../components/icons';
import { Icon } from '../../components/icons';
import { colors, radius, spacing, textStyles } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'compact';

type ButtonProps = {
  disabled?: boolean;
  flex?: boolean;
  fullWidth?: boolean;
  icon?: IconKind;
  label: string;
  onPress?: () => void;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function Button(props: ButtonProps): ReactElement {
  const variant = props.variant ?? 'primary';
  const size = props.size ?? 'md';

  const variantStyle = styles[variant];
  const textStyle = textVariantStyles[variant];
  const iconColor = iconColors[variant];

  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.base,
        size === 'compact' && styles.compact,
        variantStyle,
        props.fullWidth && styles.fullWidth,
        props.flex && styles.flex,
        props.disabled && styles.disabled,
        props.style,
      ]}
    >
      {props.icon ? <Icon color={iconColor} kind={props.icon} size={14} strokeWidth={2} /> : null}
      <Text style={[textStyle, size === 'compact' && textStyles.buttonCompact]}>{props.label}</Text>
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>): ReactElement {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>): ReactElement {
  return <Button {...props} variant="secondary" />;
}

export function OutlineButton(props: Omit<ButtonProps, 'variant'>): ReactElement {
  return <Button {...props} variant="outline" />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>): ReactElement {
  return <Button {...props} variant="danger" />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>): ReactElement {
  return <Button {...props} variant="ghost" />;
}

const iconColors: Record<ButtonVariant, string> = {
  primary: colors.surface,
  secondary: colors.primary,
  outline: colors.navy,
  danger: colors.danger,
  ghost: colors.textSecondary,
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: spacing.md,
  },
  compact: {
    height: 40,
  },
  danger: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  flex: {
    flex: 1,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  ghost: {
    backgroundColor: 'transparent',
    height: 'auto',
    minHeight: 44,
    paddingHorizontal: 0,
  },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.navy,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(8, 189, 102, 0.28)',
    borderWidth: 1,
  },
});

const textVariantStyles = StyleSheet.create({
  danger: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  ghost: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  outline: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  primary: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  secondary: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
});
