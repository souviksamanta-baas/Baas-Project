import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import type { AuthOtpChannel } from '../services/authChannel';
import { styles } from '../styles';

export function LoginScreen(props: {
  authError: string | null;
  canSubmitLogin: boolean;
  channel: AuthOtpChannel;
  isSubmitting: boolean;
  loginIdentifier: string;
  onChangeLoginIdentifier: (value: string) => void;
  onRequestOtp: () => void;
}): ReactElement {
  const isPhone = props.channel === 'sms';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{isPhone ? 'Ingresá con tu teléfono' : 'Log in with email'}</Text>
      <Text style={styles.bodyText}>
        {isPhone
          ? 'Te enviaremos un código por SMS. Podés usar 011…, +5411… o +54911….'
          : 'Use your email address to receive a one-time code.'}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoComplete={isPhone ? 'tel' : 'email'}
        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
        onChangeText={props.onChangeLoginIdentifier}
        placeholder={isPhone ? '+5411… o 011…' : 'owner@example.com'}
        style={styles.input}
        textContentType={isPhone ? 'telephoneNumber' : 'emailAddress'}
        value={props.loginIdentifier}
      />
      {props.authError ? <Text style={styles.errorText}>{props.authError}</Text> : null}
      <PrimaryButton
        disabled={props.isSubmitting || !props.canSubmitLogin}
        label={props.isSubmitting ? 'Enviando…' : 'Enviar código'}
        onPress={props.onRequestOtp}
      />
    </View>
  );
}
