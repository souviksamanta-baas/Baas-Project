import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getCenterLots,
  getCenterMovements,
  type CenterLotRow,
  type CenterMovementRow,
} from '../api/inventory';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { formatLotQuantityLabel } from '../lib/inventoryPresentation';
import { colors } from '../theme';

function formatLotDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function LotsMovementsScreen(props: { onBack: () => void }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [lots, setLots] = useState<CenterLotRow[]>([]);
  const [movements, setMovements] = useState<CenterMovementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !businessCenterId) {
      setLots([]);
      setMovements([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextLots, nextMovements] = await Promise.all([
        getCenterLots(organizationId, businessCenterId),
        getCenterMovements(organizationId, businessCenterId),
      ]);
      setLots(nextLots);
      setMovements(nextMovements);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
      setLots([]);
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenContent title="Lotes y Movimientos">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Trazabilidad de ingresos y egresos"
            title="Lotes y Movimientos"
          />
        </View>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Text style={styles.sectionTitle}>Lotes recientes</Text>
      <Card>
        {!isLoading && lots.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay lotes registrados.</Text>
        ) : (
          lots.map((lot) => (
            <View key={lot.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{lot.productName}</Text>
                <Text style={styles.rowMeta}>
                  {lot.lotCode ?? 'Sin código'} · {formatLotDate(lot.receivedAt)}
                  {lot.supplierReference ? ` · ${lot.supplierReference}` : ''}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.qtyText}>
                  {formatLotQuantityLabel(lot.remainingQuantity, lot.unitCode)}
                </Text>
                <Text style={[styles.statusText, lot.remainingQuantity > 0 ? styles.open : styles.closed]}>
                  {lot.remainingQuantity > 0 ? 'Abierto' : 'Cerrado'}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
      <Card>
        {!isLoading && movements.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay movimientos.</Text>
        ) : (
          movements.map((movement) => (
            <View key={movement.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{movement.label}</Text>
                <Text style={styles.rowMeta}>
                  {movement.productName} · {movement.time}
                </Text>
              </View>
              {movement.amount ? (
                <Text
                  style={[
                    styles.amountText,
                    movement.tone === 'red'
                      ? styles.amountRed
                      : movement.tone === 'green'
                        ? styles.amountGreen
                        : null,
                  ]}
                >
                  {movement.amount}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  amountGreen: {
    color: colors.success,
  },
  amountRed: {
    color: colors.danger,
  },
  amountText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '700',
  },
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
  closed: {
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  open: {
    color: colors.success,
  },
  qtyText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
