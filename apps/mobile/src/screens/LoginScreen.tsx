import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { styles } from '../styles';

export function LoginScreen(props: {
  canSubmitPhone: boolean;
  isSubmitting: boolean;
  onChangePhone: (phone: string) => void;
  onRequestOtp: () => void;
  phone: string;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Log in with phone</Text>
      <Text style={styles.bodyText}>Use your business phone number to receive a one-time code.</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="phone-pad"
        onChangeText={props.onChangePhone}
        placeholder="+15555550100"
        style={styles.input}
        value={props.phone}
      />
      <PrimaryButton
        disabled={props.isSubmitting || !props.canSubmitPhone}
        label="Send code"
        onPress={props.onRequestOtp}
      />
    </View>
  );
}
