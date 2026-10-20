import type { ReactElement } from 'react';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/Buttons';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { colors } from '../theme';
import { styles as baseStyles } from '../styles';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

type OnboardingStep = 'choice' | 'scan';

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
    props.initialStep === 'scan' ? 'scan' : 'choice',
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
              setStep('choice');
              props.onJoinWithInviteToken(token);
            }}
            title="Escanear invitación"
          />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <View style={baseStyles.card}>
      <Text style={baseStyles.heading}>¿Cómo querés continuar?</Text>
      <Text style={baseStyles.bodyText}>Si te invitaron a un negocio, escaneá el QR.</Text>

      <PrimaryButton label="Unirme con invitación (QR)" onPress={() => setStep('scan')} />

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
});
