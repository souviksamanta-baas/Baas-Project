import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ProductBarcodeSvg } from '../components/ProductBarcodeSvg';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { OutlineButton, PrimaryButton, TextField } from '../design-system';
import {
  isProductCodeUnavailable,
  readProductCodeType,
  readProductCodeValue,
  type ProductCodeTypeSlug,
} from '../lib/productCatalog';
import { generateProductCodeValue } from '../lib/productCodes';
import { colors } from '../theme';
import type { Product } from '../types/products';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

export function ProductCodeScreen(props: {
  isSaving?: boolean;
  onBack: () => void;
  onSaveCode: (input: { code: string; codeType: ProductCodeTypeSlug }) => Promise<void>;
  product: Product;
}): ReactElement {
  const existingUnavailable = isProductCodeUnavailable(props.product);
  const existingType = readProductCodeType(props.product);
  const existingValue = readProductCodeValue(props.product);
  const [codeType, setCodeType] = useState<ProductCodeTypeSlug>(
    existingUnavailable ? 'codigo_de_barras' : existingType,
  );
  const [codeValue, setCodeValue] = useState(
    existingUnavailable ? generateProductCodeValue(props.product, 'codigo_de_barras') : existingValue,
  );
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);

  const previewValue = useMemo(() => {
    if (!existingUnavailable && codeType === existingType && codeValue === existingValue) {
      return existingValue;
    }

    return codeValue;
  }, [codeType, codeValue, existingType, existingUnavailable, existingValue]);

  function selectType(nextType: ProductCodeTypeSlug): void {
    setCodeType(nextType);
    if (existingUnavailable || nextType !== existingType) {
      setCodeValue(generateProductCodeValue(props.product, nextType));
    } else {
      setCodeValue(existingValue);
    }
  }

  function applyExternalCode(value: string, nextType: ProductCodeTypeSlug): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setCodeType(nextType);
    setCodeValue(trimmed);
    setManualCode(trimmed);
  }

  async function handleSave(): Promise<void> {
    try {
      await props.onSaveCode({ code: previewValue, codeType });
      Alert.alert('Código guardado', 'El código quedó asociado al producto.');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  async function handleShare(): Promise<void> {
    await Share.share({
      message: `Código ${codeType === 'qr' ? 'QR' : 'de barras'} de ${props.product.name}: ${previewValue}`,
    });
  }

  function handleRegenerate(): void {
    setCodeValue(generateProductCodeValue(props.product, codeType, { forceNew: true }));
  }

  function handleAssociateManual(): void {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      Alert.alert('Código vacío', 'Ingresá o escaneá un código para asociarlo.');
      return;
    }

    applyExternalCode(trimmed, codeType);
  }

  if (scanning) {
    return (
      <BarcodeScannerScreen
        onBack={() => setScanning(false)}
        onScanned={(value, kind) => {
          applyExternalCode(value, kind ?? 'codigo_de_barras');
          setScanning(false);
        }}
      />
    );
  }

  return (
    <ScreenContent title="Código del producto">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle={props.product.name}
            title="Gestionar código"
          />
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Tipo de código</Text>
        <View style={styles.typeRow}>
          <Pressable
            onPress={() => selectType('codigo_de_barras')}
            style={[styles.typeChip, codeType === 'codigo_de_barras' && styles.typeChipActive]}
          >
            <Text
              style={[
                styles.typeChipText,
                codeType === 'codigo_de_barras' && styles.typeChipTextActive,
              ]}
            >
              Código de barras
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectType('qr')}
            style={[styles.typeChip, codeType === 'qr' && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipText, codeType === 'qr' && styles.typeChipTextActive]}>
              Código QR
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Vista previa</Text>
        <View style={styles.preview}>
          {codeType === 'qr' ? (
            <QRCode size={180} value={previewValue} />
          ) : (
            <ProductBarcodeSvg value={previewValue} />
          )}
          <Text selectable style={styles.codeValue}>
            {previewValue}
          </Text>
          <Text style={styles.meta}>
            {codeType === 'qr' ? 'Código QR' : 'Código de barras'}
            {existingUnavailable ? ' · sin asociar' : ''}
          </Text>
        </View>

        <Text style={styles.label}>Asociar código del envase</Text>
        <Text style={styles.helper}>
          Escaneá el código de barras o QR del paquete, o pegalo manualmente.
        </Text>
        <OutlineButton
          fullWidth
          label="Escanear con la cámara"
          onPress={() => setScanning(true)}
        />
        <TextField
          autoCapitalize="characters"
          label="Código existente"
          onChangeText={setManualCode}
          placeholder="Ej. 7790001234567"
          value={manualCode}
        />
        <Pressable onPress={handleAssociateManual} style={styles.shareLink}>
          <Text style={styles.shareText}>Usar este código en la vista previa</Text>
        </Pressable>

        <Pressable onPress={handleRegenerate} style={styles.shareLink}>
          <Text style={styles.shareText}>Regenerar código nuevo</Text>
        </Pressable>

        <PrimaryButton
          disabled={props.isSaving}
          fullWidth
          label={props.isSaving ? 'Guardando…' : 'Guardar código'}
          onPress={() => void handleSave()}
        />
        <Pressable onPress={() => void handleShare()} style={styles.shareLink}>
          <Text style={styles.shareText}>Compartir / imprimir</Text>
        </Pressable>
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  backPressable: {
    paddingRight: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  card: {
    gap: 12,
  },
  codeValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 10,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMint,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  shareLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  shareText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  typeChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.primaryDark,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
