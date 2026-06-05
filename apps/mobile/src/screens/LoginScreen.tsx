import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { styles } from '../styles';

export function LoginScreen(props: {
  canSubmitEmail: boolean;
  email: string;
  isSubmitting: boolean;
  onChangeEmail: (email: string) => void;
  onRequestOtp: () => void;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Log in with email</Text>
      <Text style={styles.bodyText}>Use your email address to receive a one-time code.</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={props.onChangeEmail}
        placeholder="owner@example.com"
        style={styles.input}
        value={props.email}
      />
      <PrimaryButton
        disabled={props.isSubmitting || !props.canSubmitEmail}
        label="Send code"
        onPress={props.onRequestOtp}
      />
    </View>
  );
}
