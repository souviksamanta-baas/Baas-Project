import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  confirmArcaDelegation,
  getArcaConnection,
  upsertArcaConnection,
  type ArcaConnectionSummary,
  type ArcaTaxCondition,
} from '../api/arca';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { PrimaryButton, colors as dsColors, spacing } from '../design-system';
import { colors } from '../theme';

const TAX_OPTIONS: Array<{ id: ArcaTaxCondition; label: string }> = [
  { id: 'monotributo', label: 'Monotributo' },
  { id: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { id: 'exento', label: 'Exento' },
  { id: 'no_responsable', label: 'No responsable' },
  { id: 'consumidor_final', label: 'Consumidor final' },
];

const DELEGATION_STEPS = [
  'Ingresá a ARCA con tu Clave Fiscal',
  'Abrí Administrador de Relaciones de Clave Fiscal',
  'Buscá y autorizá a Nexolia como representante de Web Services (WSFE)',
  'Creá un Punto de Venta dedicado a Web Services (no compartas el de otro sistema)',
  'Volvé a Nexolia y confirmá la autorización',
];

export function ArcaSettingsScreen(props: {
  onBack: () => void;
  organizationId: string;
}): ReactElement {
  const [connection, setConnection] = useState<ArcaConnectionSummary | null>(null);
  const [cuit, setCuit] = useState('');
  const [pointOfSale, setPointOfSale] = useState('3');
  const [taxCondition, setTaxCondition] = useState<ArcaTaxCondition>('monotributo');
  const [environment, setEnvironment] = useState<'homologacion' | 'production'>('homologacion');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await getArcaConnection(props.organizationId);
      setConnection(next);
      if (next.cuit) {
        setCuit(next.cuit);
      }
      if (next.pointOfSale) {
        setPointOfSale(String(next.pointOfSale));
      }
      if (next.taxCondition) {
        setTaxCondition(next.taxCondition);
      }
      if (next.environment) {
        setEnvironment(next.environment);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo cargar ARCA',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsLoading(false);
    }
  }, [props.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(): Promise<void> {
    const pv = Number.parseInt(pointOfSale, 10);
    if (!Number.isFinite(pv) || pv < 1) {
      Alert.alert('Punto de venta inválido', 'Ingresá un número de punto de venta mayor a 0.');
      return;
    }

    setIsSaving(true);
    try {
      const next = await upsertArcaConnection({
        organizationId: props.organizationId,
        cuit,
        pointOfSale: pv,
        taxCondition,
        environment,
      });
      setConnection(next);
      Alert.alert('ARCA actualizado', 'Los datos de facturación se guardaron correctamente.');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelegation(): Promise<void> {
    setIsSaving(true);
    try {
      const next = await confirmArcaDelegation(props.organizationId);
      setConnection(next);
      Alert.alert('ARCA conectado', 'Ya podés emitir facturas electrónicas desde Ventas.');
    } catch (error) {
      Alert.alert(
        'No se pudo confirmar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const statusLabel = connection
    ? statusCopy(connection.authorizationStatus)
    : 'Sin configurar';

  return (
    <ScreenContent title="Facturación ARCA">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle title="Facturación ARCA" />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.statusLabel}>Estado</Text>
            <Text style={styles.statusValue}>{statusLabel}</Text>
            {connection?.lastError ? (
              <Text style={styles.errorText}>{connection.lastError}</Text>
            ) : null}
            <Text style={styles.hint}>
              Ambiente: {environment === 'production' ? 'Producción' : 'Homologación'}
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>CUIT del emisor</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setCuit}
              placeholder="20123456789"
              style={styles.input}
              value={cuit}
            />

            <Text style={styles.fieldLabel}>Punto de venta (Web Services)</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setPointOfSale}
              placeholder="3"
              style={styles.input}
              value={pointOfSale}
            />

            <Text style={styles.fieldLabel}>Condición frente al IVA</Text>
            <View style={styles.optionList}>
              {TAX_OPTIONS.map((option) => {
                const selected = option.id === taxCondition;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setTaxCondition(option.id)}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Ambiente</Text>
            <View style={styles.envRow}>
              <Pressable
                onPress={() => setEnvironment('homologacion')}
                style={[
                  styles.envChip,
                  environment === 'homologacion' && styles.envChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.envChipText,
                    environment === 'homologacion' && styles.envChipTextSelected,
                  ]}
                >
                  Homologación
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEnvironment('production')}
                style={[styles.envChip, environment === 'production' && styles.envChipSelected]}
              >
                <Text
                  style={[
                    styles.envChipText,
                    environment === 'production' && styles.envChipTextSelected,
                  ]}
                >
                  Producción
                </Text>
              </Pressable>
            </View>

            <PrimaryButton
              disabled={isSaving}
              fullWidth
              label={isSaving ? 'Guardando…' : 'Guardar configuración'}
              onPress={() => void handleSave()}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Autorizar a Nexolia en ARCA</Text>
            <Text style={styles.hint}>
              No compartas tu Clave Fiscal. En producción Nexolia opera con certificado de
              plataforma; vos solo autorizás la representación en Administrador de Relaciones.
            </Text>
            {environment === 'production' ? (
              <Text style={styles.hint}>
                Al pasar a producción, tenés que completar la autorización y confirmarla acá
                antes de emitir facturas reales.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Homologación permite probar la emisión con CAE de prueba sin la autorización de
                producción.
              </Text>
            )}
            {DELEGATION_STEPS.map((step, index) => (
              <Text key={step} style={styles.step}>
                {index + 1}. {step}
              </Text>
            ))}
            {connection?.authorizationStatus === 'awaiting_delegation' ||
            connection?.authorizationStatus === 'pending' ||
            (environment === 'production' &&
              connection?.authorizationStatus !== 'connected') ? (
              <PrimaryButton
                disabled={isSaving}
                fullWidth
                label="Ya autoricé a Nexolia"
                onPress={() => void handleConfirmDelegation()}
              />
            ) : null}
          </Card>
        </>
      )}
    </ScreenContent>
  );
}

function statusCopy(status: ArcaConnectionSummary['authorizationStatus']): string {
  switch (status) {
    case 'connected':
      return 'ARCA conectado — listo para facturar';
    case 'awaiting_delegation':
      return 'Esperando autorización en Administrador de Relaciones';
    case 'error':
      return 'Error de conexión';
    case 'disabled':
      return 'Deshabilitado';
    default:
      return 'ARCA no conectado';
  }
}

const styles = StyleSheet.create({
  backPressable: {
    marginLeft: -6,
    marginTop: -4,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
  },
  card: {
    gap: 10,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  envChip: {
    borderColor: dsColors.borderInput,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  envChipSelected: {
    backgroundColor: dsColors.primarySoft,
    borderColor: colors.primary,
  },
  envChipText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  envChipTextSelected: {
    color: colors.primary,
  },
  envRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  fieldLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.sm,
  },
  hint: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: dsColors.surface,
    borderColor: dsColors.borderInput,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  optionList: {
    gap: 6,
  },
  optionRow: {
    borderColor: dsColors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowSelected: {
    backgroundColor: dsColors.primarySoft,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.navy,
    fontSize: 14,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  statusLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  step: {
    color: colors.navy,
    fontSize: 14,
    lineHeight: 20,
  },
});
