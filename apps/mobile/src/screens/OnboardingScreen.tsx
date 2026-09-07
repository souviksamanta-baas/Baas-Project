import type { ReactElement } from 'react';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { colors } from '../theme';
import { styles as baseStyles } from '../styles';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

const COMENZAR_URL = 'https://nexolia.com.ar/comenzar';

type OnboardingStep = 'choice' | 'scan' | 'create';

export function OnboardingScreen(props: {
  /** Kept for call-site compatibility; in-app create is retired. */
  businessName?: string;
  featureFlags?: unknown;
  initialStep?: OnboardingStep;
  isSubmitting?: boolean;
  navShortcut?: unknown;
  onBack?: () => void;
  onChangeBusinessName?: (businessName: string) => void;
  onChangeFeatureFlags?: (featureFlags: unknown) => void;
  onChangeNavShortcut?: (navShortcut: unknown) => void;
  onChangeVerticalId?: (verticalId: string | null) => void;
  onCreateOrganization?: () => void;
  onJoinWithInviteToken: (inviteToken: string) => void;
  onSignOut: () => void;
  submitLabel?: string;
  verticalId?: string | null;
}): ReactElement {
  const [step, setStep] = useState<OnboardingStep>(
    props.initialStep === 'scan' ? 'scan' : props.initialStep === 'create' ? 'create' : 'choice',
  );

  if (step === 'scan') {
    return (
      <Modal animationType="slide" onRequestClose={() => setStep('choice')} visible>
        <SafeAreaView edges={['top', 'bottom']} style={styles.scanModal}>
          <BarcodeScannerScreen
            hint="Apuntá al QR de invitación que te compartió el dueño"
            onBack={() => setStep('choice')}
            onScanned={({ unlock, value }) => {
              const token = parseStaffInviteToken(value);
              if (!token) {
                Alert.alert('QR inválido', 'Ese código no es una invitación de Nexolia.');
                unlock();
                return;
              }
              props.onJoinWithInviteToken(token);
            }}
            title="Escanear invitación"
          />
        </SafeAreaView>
      </Modal>
    );
  }

  const heading =
    step === 'create' || props.initialStep === 'create'
      ? 'Registro en la web'
      : '¿Cómo querés continuar?';
  const body =
    step === 'create' || props.initialStep === 'create'
      ? 'Ya no se crea el negocio desde la app. Completá el alta en nexolia.com.ar/comenzar y esperá la confirmación de Nexolia. Después iniciá sesión acá con el mismo email.'
      : 'Si te invitaron a un negocio, escaneá el QR. Si todavía no estás registrado como propietario, completá el alta en la web.';

  return (
    <View style={baseStyles.card}>
      <Text style={baseStyles.heading}>{heading}</Text>
      <Text style={baseStyles.bodyText}>{body}</Text>

      <PrimaryButton
        label="Abrir nexolia.com.ar/comenzar"
        onPress={() => {
          void Linking.openURL(COMENZAR_URL);
        }}
      />
      <View style={styles.spacer} />
      <SecondaryButton label="Unirme con invitación (QR)" onPress={() => setStep('scan')} />

      {props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.signOut}>
          <Text style={styles.signOutText}>‹ Volver</Text>
        </Pressable>
      ) : (
        <Pressable onPress={props.onSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scanModal: {
    backgroundColor: colors.navy,
    flex: 1,
  },
  signOut: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  signOutText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 10,
  },
});
