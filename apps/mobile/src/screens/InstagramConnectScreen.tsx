import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  disconnectInstagram,
  startInstagramOAuth,
  type InstagramConnectionSummary,
} from '../api/instagram';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, colors, spacing } from '../design-system';

export function InstagramConnectScreen(props: {
  connection: InstagramConnectionSummary | null;
  onBack: () => void;
  onConnected: () => Promise<void>;
  organizationId: string;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const connected = props.connection?.status === 'connected';

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const { authUrl } = await startInstagramOAuth({
        organizationId: props.organizationId,
      });
      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        throw new Error('No se pudo abrir el inicio de sesión de Meta.');
      }
      await Linking.openURL(authUrl);
    } catch (error) {
      Alert.alert('No se pudo conectar', error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  }, [props.organizationId]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectInstagram({ organizationId: props.organizationId });
      await props.onConnected();
      Alert.alert('Instagram desconectado', 'La cuenta quedó desvinculada de Nexolia.');
    } catch (error) {
      Alert.alert('No se pudo desconectar', error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  }, [props.onConnected, props.organizationId]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', () => {
      void props.onConnected();
    });
    return () => sub.remove();
  }, [props.onConnected]);

  return (
    <ScreenContent title="Conectar Instagram">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Conectá tu cuenta profesional con Instagram Business Login"
            title="Conectar Instagram"
          />
        </View>
      </View>

      <Card>
        {connected ? (
          <>
            <Text style={styles.statusLabel}>Cuenta conectada</Text>
            <Text style={styles.statusValue}>
              {props.connection?.igUsername
                ? `@${props.connection.igUsername}`
                : props.connection?.igUserId ?? 'Instagram'}
            </Text>
            {props.connection?.lastError ? (
              <Text style={styles.errorText}>{props.connection.lastError}</Text>
            ) : (
              <Text style={styles.hint}>
                El historial completo no siempre está disponible; sincronizamos lo reciente de forma
                aproximada.
              </Text>
            )}
            <PrimaryButton
              disabled={busy}
              label={busy ? 'Desconectando…' : 'Desconectar'}
              onPress={() => void handleDisconnect()}
            />
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              Vas a autorizar Nexolia en Meta. Al terminar, volvés a la app por el enlace
              baas-owner://instagram-oauth.
            </Text>
            <PrimaryButton
              disabled={busy}
              label={busy ? 'Abriendo Meta…' : 'Conectar cuenta existente'}
              onPress={() => void handleConnect()}
            />
          </>
        )}
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    paddingRight: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  flex: { flex: 1 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hint: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statusLabel: {
    color: colors.slate,
    fontSize: 13,
    marginBottom: 4,
  },
  statusValue: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
});
