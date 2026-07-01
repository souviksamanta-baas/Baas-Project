import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenShell } from '../components/AuthScreenShell';
import type { AuthOtpChannel } from '../services/authChannel';
import {
  authChannelDeliveryHint,
  authChannelLabel,
  DEFAULT_AUTH_OTP_CHANNEL,
  getLoginAuthChannels,
} from '../services/authChannel';
import { colors, PrimaryButton, spacing, TextField, textStyles } from '../design-system';

export function LoginScreen(props: {
  authError: string | null;
  canSubmitLogin: boolean;
  channel: AuthOtpChannel;
  isSubmitting: boolean;
  loginIdentifier: string;
  onChangeChannel: (channel: AuthOtpChannel) => void;
  onChangeLoginIdentifier: (value: string) => void;
  onRequestOtp: () => void;
}): ReactElement {
  const channels = getLoginAuthChannels();
  const isPhone = props.channel === 'sms' || props.channel === 'whatsapp';
  const showChannelPicker = channels.length > 1;
  const subtitle = showChannelPicker
    ? 'Elegí cómo querés recibir el código. El número de ingreso no tiene que ser el WhatsApp de tu negocio.'
    : authChannelDeliveryHint(props.channel);

  return (
    <AuthScreenShell subtitle={subtitle} title="Ingresá a Nexolia">
      {showChannelPicker ? (
        <View style={localStyles.channelRow}>
          {channels.map((channel) => {
            const active = props.channel === channel;
            const recommended = channel === DEFAULT_AUTH_OTP_CHANNEL;

            return (
              <Pressable
                key={channel}
                onPress={() => props.onChangeChannel(channel)}
                style={[localStyles.channelChip, active && localStyles.channelChipActive]}
              >
                <Text style={[localStyles.channelChipText, active && localStyles.channelChipTextActive]}>
                  {authChannelLabel(channel)}
                  {recommended ? ' · recomendado' : channel === 'sms' ? ' · opcional' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <TextField
        autoCapitalize="none"
        autoComplete={isPhone ? 'tel' : 'email'}
        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
        label={isPhone ? 'Teléfono' : 'Correo electrónico'}
        onChangeText={props.onChangeLoginIdentifier}
        placeholder={isPhone ? '+5411… o 011…' : 'dueño@ejemplo.com'}
        textContentType={isPhone ? 'telephoneNumber' : 'emailAddress'}
        value={props.loginIdentifier}
      />
      {props.authError ? <Text style={localStyles.errorText}>{props.authError}</Text> : null}
      <PrimaryButton
        disabled={props.isSubmitting || !props.canSubmitLogin}
        fullWidth
        label={props.isSubmitting ? 'Enviando…' : 'Enviar código'}
        onPress={props.onRequestOtp}
      />
    </AuthScreenShell>
  );
}

const localStyles = StyleSheet.create({
  channelChip: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  channelChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  channelChipText: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '500',
  },
  channelChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorText: {
    ...textStyles.bodySm,
    color: colors.danger,
  },
});
