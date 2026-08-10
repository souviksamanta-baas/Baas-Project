import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert, Linking } from 'react-native';

import { BarcodeScannerScreen } from '../../src/screens/BarcodeScannerScreen';

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
        'Escaneá el código QR que aparece en el navegador de tu computadora.',
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
    <BarcodeScannerScreen
      hint="Escaneá el código QR que ves en el navegador de tu computadora"
      onBack={() => router.back()}
      onScanned={(payload) => {
        void handleScanned(payload);
      }}
      qrOnly
      title="Sesión en el navegador"
    />
  );
}
