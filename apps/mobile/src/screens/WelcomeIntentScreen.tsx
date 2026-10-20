import type { ReactElement } from 'react';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreenShell } from '../components/AuthScreenShell';
import { PrimaryButton, colors, spacing, textStyles } from '../design-system';
import { parseStaffInviteToken } from '../lib/staffInviteToken';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

export function WelcomeIntentScreen(props: {
  onJoinWithInviteToken: (inviteToken: string) => void;
  /** When set, user already has a session without a business — show sign-out instead of sign-in. */
  onSignOut?: () => void;
  onSignIn?: () => void;
}): ReactElement {
  const [scanning, setScanning] = useState(false);
  const signedInWithoutBusiness = typeof props.onSignOut === 'function';

  return (
    <>
      <AuthScreenShell
        subtitle={
          signedInWithoutBusiness
            ? 'Tu sesión está activa, pero todavía no tenés un negocio. Escaneá una invitación para unirte.'
            : 'Elegí cómo querés empezar. Después te pedimos un código para verificar tu identidad.'
        }
        title="Bienvenido a Nexolia"
      >
        <PrimaryButton
          fullWidth
          label="Unirme con invitación (QR)"
          onPress={() => setScanning(true)}
        />
        {signedInWithoutBusiness ? (
          <Pressable onPress={props.onSignOut} style={styles.signIn}>
            <Text style={styles.signInText}>Cerrar sesión</Text>
          </Pressable>
        ) : props.onSignIn ? (
          <Pressable onPress={props.onSignIn} style={styles.signIn}>
            <Text style={styles.signInText}>Ya tengo cuenta — Iniciar sesión</Text>
          </Pressable>
        ) : null}
      </AuthScreenShell>

      <Modal animationType="slide" onRequestClose={() => setScanning(false)} visible={scanning}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.scanModal}>
          <BarcodeScannerScreen
            hint="Apuntá al QR de invitación que te compartió el dueño"
            onBack={() => setScanning(false)}
            onScanned={({ unlock, value }) => {
              const token = parseStaffInviteToken(value);
              if (!token) {
                Alert.alert('QR inválido', 'Ese código no es una invitación de Nexolia.');
                unlock();
                return;
              }
              setScanning(false);
              props.onJoinWithInviteToken(token);
            }}
            title="Escanear invitación"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scanModal: {
    backgroundColor: colors.background,
    flex: 1,
  },
  signIn: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  signInText: {
    ...textStyles.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
});
