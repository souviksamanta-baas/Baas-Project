import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createCashManualEntry,
  deleteCashManualEntry,
  getCashDay,
  updateCashManualEntry,
  type CashDayBalances,
  type CashEntryType,
  type CashLedgerEntry,
} from '../api/cash';
import { Card, ScreenContent, ScreenTitle, useHeaderCollapseOnScroll } from '../components/ui';
import { formatCurrency } from '../lib/sellCart';
import { todayIsoDate } from '../lib/cashPostings';
import { colors } from '../theme';

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
  });
}

function sourceLabel(entry: CashLedgerEntry): string {
  switch (entry.source) {
    case 'venta':
      return 'Venta';
    case 'compra':
      return 'Compra';
    case 'stock':
      return 'Stock';
    default:
      return 'Manual';
  }
}

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

export function CashScreen(props: {
  businessCenterId: string;
  businessCenterName?: string | null;
  onBack: () => void;
  organizationId: string;
  timezone?: string | null;
}): ReactElement {
  const onScrollOffset = useHeaderCollapseOnScroll();
  const [entryDate, setEntryDate] = useState(() => todayIsoDate(props.timezone));
  const [day, setDay] = useState<CashDayBalances | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CashLedgerEntry | null>(null);
  const [draftType, setDraftType] = useState<CashEntryType>('ingreso');
  const [draftConcept, setDraftConcept] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setDay(
        await getCashDay({
          businessCenterId: props.businessCenterId,
          entryDate,
          organizationId: props.organizationId,
        }),
      );
    } catch (error) {
      setDay(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo cargar la caja del día.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [entryDate, props.businessCenterId, props.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (type: CashEntryType) => {
    setEditing(null);
    setDraftType(type);
    setDraftConcept('');
    setDraftAmount('');
    setEditorOpen(true);
  };

  const openEdit = (entry: CashLedgerEntry) => {
    if (entry.source !== 'manual') {
      return;
    }
    setEditing(entry);
    setDraftType(entry.entryType);
    setDraftConcept(entry.concept);
    setDraftAmount((entry.amountCents / 100).toLocaleString('es-AR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      useGrouping: false,
    }));
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    const amountCents = parseAmountToCents(draftAmount);
    const concept = draftConcept.trim();
    if (!amountCents) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero.');
      return;
    }
    if (!concept) {
      Alert.alert('Concepto', 'Ingresá un concepto para el movimiento.');
      return;
    }

    setIsSaving(true);
    try {
      if (editing) {
        await updateCashManualEntry({
          amountCents,
          concept,
          entryId: editing.id,
          entryType: draftType,
          organizationId: props.organizationId,
        });
      } else {
        await createCashManualEntry({
          amountCents,
          businessCenterId: props.businessCenterId,
          concept,
          entryDate,
          entryType: draftType,
          organizationId: props.organizationId,
        });
      }
      setEditorOpen(false);
      await load();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (entry: CashLedgerEntry) => {
    if (entry.source !== 'manual') {
      return;
    }
    Alert.alert('Eliminar movimiento', '¿Querés eliminar este movimiento manual?', [
      { style: 'cancel', text: 'Cancelar' },
      {
        style: 'destructive',
        text: 'Eliminar',
        onPress: () => {
          void (async () => {
            try {
              await deleteCashManualEntry({
                entryId: entry.id,
                organizationId: props.organizationId,
              });
              await load();
            } catch (error) {
              Alert.alert(
                'No se pudo eliminar',
                error instanceof Error ? error.message : 'Error desconocido',
              );
            }
          })();
        },
      },
    ]);
  };

  const subtitle = useMemo(() => {
    if (props.businessCenterName) {
      return props.businessCenterName;
    }
    return null;
  }, [props.businessCenterName]);

  return (
    <ScreenContent disableScroll title="Caja">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Caja" />
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.dayNav}>
        <Pressable
          accessibilityLabel="Día anterior"
          onPress={() => setEntryDate((current) => shiftIsoDate(current, -1))}
          style={styles.dayNavButton}
        >
          <Text style={styles.dayNavButtonText}>‹</Text>
        </Pressable>
        <View style={styles.dayNavCenter}>
          <Text style={styles.dayNavLabel}>{formatDisplayDate(entryDate)}</Text>
          <Pressable onPress={() => setEntryDate(todayIsoDate(props.timezone))}>
            <Text style={styles.todayLink}>Hoy</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel="Día siguiente"
          onPress={() => setEntryDate((current) => shiftIsoDate(current, 1))}
          style={styles.dayNavButton}
        >
          <Text style={styles.dayNavButtonText}>›</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Card>
      ) : day ? (
        <>
          <View style={styles.balancesRow}>
            <Card style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo inicial</Text>
              <Text style={styles.balanceValue}>{formatCurrency(day.saldoInicialCents)}</Text>
            </Card>
            <Card style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo final</Text>
              <Text style={styles.balanceValue}>{formatCurrency(day.saldoFinalCents)}</Text>
            </Card>
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={() => openCreate('ingreso')} style={styles.ingresoButton}>
              <Text style={styles.actionButtonText}>+ Ingreso</Text>
            </Pressable>
            <Pressable onPress={() => openCreate('egreso')} style={styles.egresoButton}>
              <Text style={styles.actionButtonText}>+ Egreso</Text>
            </Pressable>
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={day.entries}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>No hay movimientos en este día.</Text>
              </Card>
            }
            onScroll={(event) => onScrollOffset(event.nativeEvent.contentOffset.y)}
            renderItem={({ item }) => {
              const isIngreso = item.entryType === 'ingreso';
              const canEdit = item.source === 'manual';
              return (
                <Pressable
                  disabled={!canEdit}
                  onLongPress={() => confirmDelete(item)}
                  onPress={() => openEdit(item)}
                  style={styles.entryRow}
                >
                  <View style={styles.flex}>
                    <Text style={styles.entryConcept}>{item.concept || sourceLabel(item)}</Text>
                    <Text style={styles.entryMeta}>
                      {sourceLabel(item)}
                      {item.sourceId ? ` · ${item.sourceId}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.entryAmount, isIngreso ? styles.ingreso : styles.egreso]}>
                    {isIngreso ? '+' : '−'}
                    {formatCurrency(item.amountCents)}
                  </Text>
                </Pressable>
              );
            }}
            scrollEventThrottle={16}
          />
        </>
      ) : null}

      <Modal animationType="slide" transparent visible={editorOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Editar movimiento' : draftType === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo egreso'}
            </Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setDraftType('ingreso')}
                style={[styles.typeChip, draftType === 'ingreso' && styles.typeChipActiveIngreso]}
              >
                <Text style={styles.typeChipText}>Ingreso</Text>
              </Pressable>
              <Pressable
                onPress={() => setDraftType('egreso')}
                style={[styles.typeChip, draftType === 'egreso' && styles.typeChipActiveEgreso]}
              >
                <Text style={styles.typeChipText}>Egreso</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Concepto</Text>
            <TextInput
              onChangeText={setDraftConcept}
              placeholder="Ej. Ajuste de caja"
              style={styles.input}
              value={draftConcept}
            />
            <Text style={styles.fieldLabel}>Monto</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setDraftAmount}
              placeholder="0"
              style={styles.input}
              value={draftAmount}
            />
            <View style={styles.modalActions}>
              <Pressable
                disabled={isSaving}
                onPress={() => setEditorOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={() => void saveEditor()}
                style={styles.modalPrimary}
              >
                <Text style={styles.modalPrimaryText}>{isSaving ? 'Guardando…' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  backPressable: {
    marginRight: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
  },
  balanceCard: {
    flex: 1,
    padding: 12,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  balancesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  dayNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  dayNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayNavButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
  dayNavCenter: {
    alignItems: 'center',
    gap: 2,
  },
  dayNavLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  egreso: {
    color: '#b42318',
  },
  egresoButton: {
    alignItems: 'center',
    backgroundColor: '#b42318',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  emptyCard: {
    marginHorizontal: 16,
    padding: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  entryAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  entryConcept: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  entryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  entryRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    marginBottom: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  ingreso: {
    color: '#027a48',
  },
  ingresoButton: {
    alignItems: 'center',
    backgroundColor: '#027a48',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listContent: {
    paddingBottom: 120,
    paddingTop: 4,
  },
  loader: {
    marginTop: 40,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalPrimary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondary: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  modalSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: -4,
  },
  todayLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  typeChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeChipActiveEgreso: {
    backgroundColor: '#fee4e2',
  },
  typeChipActiveIngreso: {
    backgroundColor: '#d1fadf',
  },
  typeChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
