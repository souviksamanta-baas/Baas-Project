import type { ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icons';
import { PrimaryButton, colors, radius, shadows, spacing, textStyles } from '../design-system';

export function BrandSuccessModal(props: {
  body: string;
  buttonLabel?: string;
  onClose: () => void;
  title: string;
  visible: boolean;
}): ReactElement {
  return (
    <Modal animationType="fade" onRequestClose={props.onClose} transparent visible={props.visible}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" onPress={props.onClose} style={styles.backdrop} />
        <View style={styles.island}>
          <View style={styles.iconWrap}>
            <Icon color={colors.primary} kind="check" size={26} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.body}>{props.body}</Text>
          <PrimaryButton
            fullWidth
            label={props.buttonLabel ?? 'Entendido'}
            onPress={props.onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 25, 53, 0.42)',
  },
  body: {
    ...textStyles.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 52,
  },
  island: {
    ...shadows.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    marginHorizontal: spacing.xl,
    maxWidth: 340,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    width: '100%',
    zIndex: 1,
  },
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...textStyles.listTitle,
    color: colors.navy,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
