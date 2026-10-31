import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { apiFetchAuthJson } from '../../src/api/client';
import { BarcodeScannerScreen } from '../../src/screens/BarcodeScannerScreen';
import { colors } from '../../src/theme';

const BROWSER_SESSION_WEB_URL = 'https://web.nexolia.com.ar';
const BROWSER_SESSION_WEB_HOST = 'web.nexolia.com.ar';

function resolveBrowserSessionUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Not a bare URL — try common QR payloads without scheme.
  }

  if (/^[\w.-]+\.[\w.-]+(\/.*)?$/i.test(value)) {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export default function BrowserSessionScanRoute(): ReactElement {
  const router = useRouter();

  async function handleScanned(payload: {
    unlock: () => void;
    value: string;
  }): Promise<void> {
    const url = resolveBrowserSessionUrl(payload.value);

    const parsed = url ? safeUrl(url) : null;
    const challengeId = parsed?.searchParams.get('c') ?? '';
    const isDesktopPair =
      parsed?.hostname === BROWSER_SESSION_WEB_HOST &&
      parsed.pathname.replace(/\/$/, '') === '/pair' &&
      challengeId.length > 0;

    if (isDesktopPair) {
      try {
        await apiFetchAuthJson('/auth/browser-sessions/approve', {
          body: JSON.stringify({ challengeId }),
          method: 'POST',
        });
        Alert.alert('Listo', 'La computadora ya puede usar tu sesión.', [
          { onPress: () => router.back(), text: 'Cerrar' },
        ]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos vincular esta computadora.';
        Alert.alert('No se pudo vincular', message, [
          { onPress: payload.unlock, text: 'Reintentar' },
          { onPress: () => router.back(), style: 'cancel', text: 'Cerrar' },
        ]);
      }
      return;
    }

    if (parsed?.hostname === BROWSER_SESSION_WEB_HOST) {
      Alert.alert(
        'Código no válido',
        `Abrí ${BROWSER_SESSION_WEB_URL} en la computadora y escaneá el código QR que aparece en pantalla.`,
        [
          { onPress: payload.unlock, text: 'Reintentar' },
          { onPress: () => router.back(), style: 'cancel', text: 'Cerrar' },
        ],
      );
      return;
    }

    if (!url) {
      Alert.alert(
        'Código no válido',
        `Abrí ${BROWSER_SESSION_WEB_URL} en la computadora y escaneá el código QR que aparece en pantalla.`,
        [
          { onPress: payload.unlock, text: 'Reintentar' },
          { onPress: () => router.back(), style: 'cancel', text: 'Cerrar' },
        ],
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error('unsupported');
      }
      await Linking.openURL(url);
      router.back();
    } catch {
      Alert.alert(
        'No se pudo abrir',
        'No pudimos abrir esa sesión en el navegador. Probá de nuevo.',
        [
          { onPress: payload.unlock, text: 'Reintentar' },
          { onPress: () => router.back(), style: 'cancel', text: 'Cerrar' },
        ],
      );
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>Sesión en el navegador</Text>
        <Text style={styles.messageBody}>
          En tu computadora abrí{' '}
          <Text
            onPress={() => {
              void Linking.openURL(BROWSER_SESSION_WEB_URL);
            }}
            style={styles.link}
          >
            {BROWSER_SESSION_WEB_HOST}
          </Text>
          y escaneá el código QR que aparece en pantalla.
        </Text>
      </View>
      <View style={styles.scannerWrap}>
        <BarcodeScannerScreen
          hint="Escaneá el código QR del navegador en tu computadora"
          onBack={() => router.back()}
          onScanned={(payload) => {
            void handleScanned(payload);
          }}
          qrOnly
          title="Escanear QR"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.info,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  messageBody: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  messageCard: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  root: {
    flex: 1,
  },
  scannerWrap: {
    flex: 1,
  },
});
