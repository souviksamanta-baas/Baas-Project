import type { ReactElement } from 'react';

import { AuthScreenShell } from '../components/AuthScreenShell';
import type { AuthOtpChannel } from '../services/authChannel';
import {
  getOtpCodeLength,
  isOtpCodeComplete,
  normalizeOtpInput,
} from '../services/authOtp';
import { PrimaryButton, TextField } from '../design-system';

export function VerifyOtpScreen(props: {
  channel: AuthOtpChannel;
  destination: string;
  isSubmitting: boolean;
  onChangeOtpCode: (otpCode: string) => void;
  onVerifyOtp: () => void;
  otpCode: string;
}): ReactElement {
  const codeLength = getOtpCodeLength(props.channel);
  const senderLabel =
    props.channel === 'whatsapp'
      ? 'Nexolia por WhatsApp'
      : props.channel === 'sms'
        ? 'SMS'
        : 'correo electrónico';

  const subtitle =
    props.channel === 'whatsapp'
      ? `Enviamos un código por ${senderLabel} a ${props.destination}. Este mensaje viene de Nexolia, no del WhatsApp de tu negocio.`
      : `Enviamos un código de ${codeLength} dígitos por ${senderLabel} a ${props.destination}.`;

  return (
    <AuthScreenShell subtitle={subtitle} title="Ingresá el código">
      <TextField
        autoComplete="one-time-code"
        keyboardType="number-pad"
        label={`Código de ${codeLength} dígitos`}
        maxLength={codeLength}
        onChangeText={(value) => props.onChangeOtpCode(normalizeOtpInput(value, props.channel))}
        placeholder={'0'.repeat(codeLength)}
        textContentType="oneTimeCode"
        value={props.otpCode}
      />
      <PrimaryButton
        disabled={props.isSubmitting || !isOtpCodeComplete(props.otpCode, props.channel)}
        fullWidth
        label={props.isSubmitting ? 'Verificando…' : 'Verificar'}
        onPress={props.onVerifyOtp}
      />
    </AuthScreenShell>
  );
}
