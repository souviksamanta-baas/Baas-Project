import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { ScreenContent, ScreenTitle } from '../components/ui';
import { supabase } from '../lib/supabase';
import { requestLoginOtp, verifyLoginOtp } from '../services/auth';
import {
  authChannelLabel,
  getStaffPhoneAuthChannels,
  type AuthOtpChannel,
} from '../services/authChannel';
import { normalizePhoneNumber } from '../services/phone';
import { acceptStaffInvite } from '../services/staffInvites';
import { colors } from '../theme';
import { VerifyOtpScreen } from './VerifyOtpScreen';
import { styles } from '../styles';

export function StaffInviteAcceptScreen(props: {
  inviteToken: string;
  onAccepted: () => void;
}): ReactElement {
  const phoneChannels = getStaffPhoneAuthChannels();
  const [phase, setPhase] = useState<'login' | 'verify' | 'done'>('login');
  const [channel, setChannel] = useState<AuthOtpChannel>(phoneChannels[0] ?? 'sms');
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canSubmitLogin = normalizePhoneNumber(identifier) !== null;

  if (!props.inviteToken) {
    return (
      <ScreenContent>
        <ScreenTitle subtitle="Falta el token de invitación" title="Invitación inválida" />
        <View style={styles.card}>
          <Text style={styles.bodyText}>Escaneá el QR que te compartió el dueño del negocio.</Text>
        </View>
      </ScreenContent>
    );
  }

  async function handleRequestOtp(): Promise<void> {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await requestLoginOtp({ channel, identifier });
      setPhase('verify');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo enviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyAndAccept(): Promise<void> {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await verifyLoginOtp({ channel, identifier, otpCode });

      const verifiedPhoneE164 = normalizePhoneNumber(identifier);

      if (!verifiedPhoneE164) {
        throw new Error('La invitación requiere verificar un número de teléfono.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No hay sesión activa después de verificar el código.');
      }

      await acceptStaffInvite({
        authorizationToken: session.access_token,
        inviteToken: props.inviteToken,
        verifiedPhoneE164,
      });

      setPhase('done');
      setStatusMessage('Invitación aceptada. Ya tenés acceso al negocio.');
      props.onAccepted();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo aceptar la invitación.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === 'done') {
    return (
      <ScreenContent>
        <ScreenTitle subtitle="Tu perfil quedó vinculado al negocio" title="Listo" />
        <View style={styles.card}>
          <Text style={styles.bodyText}>{statusMessage}</Text>
        </View>
      </ScreenContent>
    );
  }

  if (phase === 'verify') {
    return (
      <ScreenContent>
        <ScreenTitle
          subtitle="Verificá el mismo número que el dueño registró en la invitación"
          title="Confirmá tu acceso"
        />
        <VerifyOtpScreen
          channel={channel}
          destination={identifier}
          isSubmitting={isSubmitting}
          onChangeOtpCode={setOtpCode}
          onVerifyOtp={() => void handleVerifyAndAccept()}
          otpCode={otpCode}
        />
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
      </ScreenContent>
    );
  }

  return (
    <ScreenContent>
      <ScreenTitle
        subtitle={
          phoneChannels.length > 1
            ? 'Usá WhatsApp o SMS con el número que te invitaron'
            : 'Usá SMS con el número que te invitaron'
        }
        title="Aceptar invitación"
      />
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Verificá el mismo teléfono que registró el dueño. Los códigos de Nexolia no vienen del
          WhatsApp del negocio.
        </Text>
        {phoneChannels.length > 1 ? (
        <View style={localStyles.channelRow}>
          {phoneChannels.map((option) => (
            <Pressable
              key={option}
              onPress={() => setChannel(option)}
              style={[localStyles.channelChip, channel === option && localStyles.channelChipActive]}
            >
              <Text
                style={[
                  localStyles.channelChipText,
                  channel === option && localStyles.channelChipTextActive,
                ]}
              >
                {authChannelLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
        ) : null}
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setIdentifier}
          placeholder="+5411… o 011…"
          style={localStyles.input}
          value={identifier}
        />
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        <PrimaryButton
          disabled={isSubmitting || !canSubmitLogin}
          label={isSubmitting ? 'Enviando…' : 'Enviar código'}
          onPress={() => void handleRequestOtp()}
        />
      </View>
    </ScreenContent>
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
  },
  channelChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    borderColor: colors.borderInput,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
