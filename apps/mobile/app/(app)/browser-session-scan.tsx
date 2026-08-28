import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BarcodeScannerScreen } from '../../src/screens/BarcodeScannerScreen';
import { colors, radius } from '../../src/theme';

const BROWSER_SESSION_WEB_URL = 'https://nexolia.com.ar';

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

export default function BrowserSessionScanRoute(): ReactElement {
  const router = useRouter();

  async function handleScanned(payload: {
    unlock: () => void;
    value: string;
  }): Promise<void> {
    const url = resolveBrowserSessionUrl(payload.value);

    if (!url) {
      Alert.alert(
        'Código no válido',
        `Abrí ${BROWSER_SESSION_WEB_URL} en la computadora, iniciá sesión y escaneá el código QR que aparece en pantalla.`,
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
            {BROWSER_SESSION_WEB_URL}
          </Text>
          , iniciá sesión y escaneá el código QR que aparece en pantalla.
        </Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(BROWSER_SESSION_WEB_URL);
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>Abrir enlace</Text>
        </Pressable>
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
  linkButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
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
