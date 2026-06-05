import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { styles } from '../styles';

export function VerifyOtpScreen(props: {
  email: string;
  isSubmitting: boolean;
  onChangeOtpCode: (otpCode: string) => void;
  onVerifyOtp: () => void;
  otpCode: string;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Enter verification code</Text>
      <Text style={styles.bodyText}>We sent an OTP to {props.email}.</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={props.onChangeOtpCode}
        placeholder="123456"
        style={styles.input}
        value={props.otpCode}
      />
      <PrimaryButton
        disabled={props.isSubmitting || props.otpCode.trim().length === 0}
        label="Verify"
        onPress={props.onVerifyOtp}
      />
    </View>
  );
}
