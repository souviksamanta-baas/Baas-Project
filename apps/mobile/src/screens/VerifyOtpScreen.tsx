import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import type { AuthOtpChannel } from '../services/authChannel';
import { authChannelLabel } from '../services/authChannel';
import { styles } from '../styles';

export function VerifyOtpScreen(props: {
  channel: AuthOtpChannel;
  destination: string;
  isSubmitting: boolean;
  onChangeOtpCode: (otpCode: string) => void;
  onVerifyOtp: () => void;
  otpCode: string;
}): ReactElement {
  const senderLabel =
    props.channel === 'whatsapp'
      ? 'Nexolia por WhatsApp'
      : props.channel === 'sms'
        ? 'SMS'
        : 'correo electrónico';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Ingresá el código</Text>
      <Text style={styles.bodyText}>
        Enviamos un código por {senderLabel} a {props.destination}.
      </Text>
      {props.channel === 'whatsapp' ? (
        <Text style={styles.bodyText}>
          Este mensaje viene de Nexolia, no del WhatsApp de tu negocio.
        </Text>
      ) : null}
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
      <Text style={styles.bodyText}>Canal: {authChannelLabel(props.channel)}</Text>
    </View>
  );
}
