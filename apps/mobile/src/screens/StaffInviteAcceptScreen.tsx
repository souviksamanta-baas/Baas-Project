import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/Buttons';
import { ScreenContent, ScreenTitle } from '../components/ui';
import { requestLoginOtp, verifyLoginOtp } from '../api/auth';
import { acceptStaffInvite } from '../api/staffInvites';
import { supabase } from '../lib/supabase';
import {
  authChannelLabel,
  getStaffPhoneAuthChannels,
  type AuthOtpChannel,
} from '../services/authChannel';
import { formatAuthError } from '../services/authErrors';
import { normalizePhoneNumber } from '../services/phone';
import { colors } from '../theme';
import { VerifyOtpScreen } from './VerifyOtpScreen';
import { styles } from '../styles';

async function phoneFromCurrentUser(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  const rawPhone =
    typeof data.user.phone === 'string' && data.user.phone.trim()
      ? data.user.phone.trim()
      : null;
  if (!rawPhone) {
    return null;
  }

  return normalizePhoneNumber(rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`);
}

export function StaffInviteAcceptScreen(props: {
  inviteToken: string;
  onAccepted: () => void | Promise<void>;
  onRefreshSession?: (organizationId?: string) => Promise<void>;
}): ReactElement {
  const phoneChannels = getStaffPhoneAuthChannels();
  const [phase, setPhase] = useState<'login' | 'verify' | 'accepting' | 'done'>('login');
  const [channel, setChannel] = useState<AuthOtpChannel>(phoneChannels[0] ?? 'sms');
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const autoAcceptStarted = useRef(false);

  const canSubmitLogin = normalizePhoneNumber(identifier) !== null;

  const finishAccept = useCallback(
    async (verifiedPhoneE164: string): Promise<void> => {
      const result = await acceptStaffInvite({
        inviteToken: props.inviteToken,
        verifiedPhoneE164,
      });

      // Dashboard still has shouldOnboard until refresh; without this, app layout
      // bounces back to onboarding instead of home. Pass org id so preferred org
      // is set and a concurrent SIGNED_IN bootstrap cannot win the race.
      await props.onRefreshSession?.(result.organizationId);

      setPhase('done');
      setStatusMessage('Invitación aceptada. Ya tenés acceso al negocio.');
      await props.onAccepted();
    },
    [props.inviteToken, props.onAccepted, props.onRefreshSession],
  );

  useEffect(() => {
    if (!props.inviteToken || autoAcceptStarted.current) {
      return;
    }

    autoAcceptStarted.current = true;

    void (async () => {
      const phone = await phoneFromCurrentUser();
      if (!phone) {
        return;
      }

      setPhase('accepting');
      setIsSubmitting(true);
      setAuthError(null);

      try {
        await finishAccept(phone);
      } catch (error) {
        setAuthError(formatAuthError(error));
        setPhase('login');
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [finishAccept, props.inviteToken]);

  if (!props.inviteToken) {
    return (
      <ScreenContent>
        <ScreenTitle title="Invitación inválida" />
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
      setAuthError(formatAuthError(error));
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

      setPhase('accepting');
      await finishAccept(verifiedPhoneE164);
    } catch (error) {
      setAuthError(formatAuthError(error));
      setPhase('verify');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === 'done') {
    return (
      <ScreenContent>
        <ScreenTitle title="Listo" />
        <View style={styles.card}>
          <Text style={styles.bodyText}>{statusMessage}</Text>
        </View>
      </ScreenContent>
    );
  }

  if (phase === 'accepting') {
    return (
      <ScreenContent>
        <ScreenTitle title="Uniéndote al negocio" />
        <View style={styles.card}>
          <Text style={styles.bodyText}>Estamos activando tu acceso. Un momento…</Text>
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        </View>
      </ScreenContent>
    );
  }

  if (phase === 'verify') {
    return (
      <ScreenContent>
        <ScreenTitle title="Confirmá tu acceso" />
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
      <ScreenTitle title="Aceptar invitación" />
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
    fontSize: 15,
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
