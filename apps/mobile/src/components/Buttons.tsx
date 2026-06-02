import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { styles } from '../styles';

export function PrimaryButton(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.primaryButton, props.disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function SecondaryButton(props: { label: string; onPress: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}
