import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProductCodeTypeSlug } from '../lib/productCatalog';
import { colors } from '../theme';

export function BarcodeScannerScreen(props: {
  onBack: () => void;
  onScanned: (value: string, kind?: ProductCodeTypeSlug) => void;
}): ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  function handleScanned(result: BarcodeScanningResult): void {
    if (lockedRef.current) {
      return;
    }

    const value = result.data?.trim();
    if (!value) {
      return;
    }

    lockedRef.current = true;
    const kind: ProductCodeTypeSlug = result.type === 'qr' ? 'qr' : 'codigo_de_barras';
    props.onScanned(value, kind);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={props.onBack}>
          <Text style={styles.backText}>‹ Cerrar</Text>
        </Pressable>
        <Text style={styles.title}>Escanear código</Text>
        <View style={styles.spacer} />
      </View>

      {!permission ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.centered}>
          <Text style={styles.message}>Necesitamos permiso de cámara para escanear códigos.</Text>
          <Pressable onPress={() => void requestPermission()} style={styles.permissionButton}>
            <Text style={styles.permissionText}>Permitir cámara</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
            }}
            onBarcodeScanned={ready ? handleScanned : undefined}
            onCameraReady={() => setReady(true)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.frame} />
          <Text style={styles.hint}>Apuntá al código de barras o QR del producto</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  frame: {
    alignSelf: 'center',
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 2,
    height: 220,
    marginTop: '35%',
    width: '78%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hint: {
    alignSelf: 'center',
    backgroundColor: 'rgba(16,25,53,0.72)',
    borderRadius: 999,
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permissionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  root: {
    backgroundColor: colors.navy,
    flex: 1,
  },
  spacer: {
    width: 64,
  },
  title: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
});
