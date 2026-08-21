import * as WebBrowser from 'expo-web-browser';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  completeFacebookOAuth,
  disconnectFacebook,
  startFacebookOAuth,
  type FacebookConnectionSummary,
} from '../api/facebook';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, colors, spacing } from '../design-system';

WebBrowser.maybeCompleteAuthSession();

const APP_OAUTH_RETURN_URL = 'baas-owner://facebook-oauth';

function parseOAuthCallbackUrl(url: string): { code?: string; error?: string; state?: string } {
  const parsed = new URL(url);
  return {
    code: parsed.searchParams.get('code') ?? undefined,
    error: parsed.searchParams.get('error') ?? undefined,
    state: parsed.searchParams.get('state') ?? undefined,
  };
}

export function FacebookConnectScreen(props: {
  connection: FacebookConnectionSummary | null;
  onBack: () => void;
  onConnected: () => Promise<void>;
  organizationId: string;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const connected = props.connection?.status === 'connected';

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const { authUrl, redirectUri } = await startFacebookOAuth({
        organizationId: props.organizationId,
      });
      if (!/^https:\/\//i.test(redirectUri)) {
        throw new Error(
          `El servidor envió un redirect inválido (${redirectUri}). Tiene que ser HTTPS registrado en Meta Facebook Login.`,
        );
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_OAUTH_RETURN_URL);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return;
        }
        throw new Error(
          `No se completó la autorización. Verificá en Meta que el OAuth redirect URI sea exactamente:\n${redirectUri}`,
        );
      }

      const { code, error, state } = parseOAuthCallbackUrl(result.url);
      if (error) {
        throw new Error('La autorización fue cancelada o rechazada.');
      }
      if (!code || !state) {
        throw new Error('Faltan parámetros de autorización.');
      }

      await completeFacebookOAuth({ code, state });
      await props.onConnected();
      Alert.alert('Facebook conectado', 'La página quedó vinculada a Nexolia.');
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Error';
      Alert.alert('No se pudo conectar', raw);
    } finally {
      setBusy(false);
    }
  }, [props.onConnected, props.organizationId]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectFacebook({ organizationId: props.organizationId });
      await props.onConnected();
      Alert.alert('Facebook desconectado', 'La página quedó desvinculada de Nexolia.');
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
    <ScreenContent title="Conectar Facebook Messenger">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Conectar Facebook Messenger" />
        </View>
      </View>

      <Card>
        {connected ? (
          <>
            <Text style={styles.statusLabel}>Página conectada</Text>
            <Text style={styles.statusValue}>
              {props.connection?.pageName ?? props.connection?.pageId ?? 'Página de Facebook'}
            </Text>
            {props.connection?.lastError ? (
              <Text style={styles.errorText}>{props.connection.lastError}</Text>
            ) : (
              <Text style={styles.hint}>
                Vamos a recibir los mensajes nuevos de tu página. Podés responder desde el Inbox
                dentro de la ventana de 24 horas.
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
              Vas a autorizar Nexolia en Meta y elegir la página de Facebook. Al terminar, volvés
              automáticamente a la app.
            </Text>
            <PrimaryButton
              disabled={busy}
              label={busy ? 'Abriendo Meta…' : 'Conectar página de Facebook'}
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
