import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import type { AuthOtpChannel } from '../services/authChannel';
import { styles } from '../styles';

export function VerifyOtpScreen(props: {
  channel: AuthOtpChannel;
  destination: string;
  isSubmitting: boolean;
  onChangeOtpCode: (otpCode: string) => void;
  onVerifyOtp: () => void;
  otpCode: string;
}): ReactElement {
  const destinationLabel = props.channel === 'sms' ? 'SMS' : 'email';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Ingresá el código</Text>
      <Text style={styles.bodyText}>
        Enviamos un código por {destinationLabel} a {props.destination}.
      </Text>
      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={props.onChangeOtpCode}
        placeholder="123456"
        style={styles.input}
        value={props.otpCode}
      />
      <PrimaryButton
        disabled={props.isSubmitting || props.otpCode.trim().length === 0}
        label="Verificar"
        onPress={props.onVerifyOtp}
      />
    </View>
  );
}
