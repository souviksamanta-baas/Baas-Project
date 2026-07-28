import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getCenterLots,
  getCenterMovements,
  type CenterLotRow,
  type CenterMovementRow,
} from '../api/inventory';
import { Icon } from '../components/icons';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { formatLotCost } from '../lib/inventoryLotsPresentation';
import { formatLotQuantityLabel } from '../lib/inventoryPresentation';
import { colors } from '../theme';

const DATES_PAGE_SIZE = 10;
const FETCH_LIMIT = 250;

type DateGroup<T> = {
  dateKey: string;
  items: T[];
  label: string;
};

function toDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatGroupDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function groupByDate<T>(items: T[], getTimestamp: (item: T) => string): DateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const dateKey = toDateKey(getTimestamp(item));
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(dateKey, [item]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, groupItems]) => ({
      dateKey,
      items: groupItems,
      label: formatGroupDateLabel(dateKey),
    }));
}

function itemCountLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function LotsMovementsScreen(props: { onBack: () => void }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [lots, setLots] = useState<CenterLotRow[]>([]);
  const [movements, setMovements] = useState<CenterMovementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedLotDateKey, setExpandedLotDateKey] = useState<string | null>(null);
  const [expandedMovementDateKey, setExpandedMovementDateKey] = useState<string | null>(null);
  const [visibleLotDateCount, setVisibleLotDateCount] = useState(DATES_PAGE_SIZE);
  const [visibleMovementDateCount, setVisibleMovementDateCount] = useState(DATES_PAGE_SIZE);

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
        getCenterLots(organizationId, businessCenterId, FETCH_LIMIT),
        getCenterMovements(organizationId, businessCenterId, FETCH_LIMIT),
      ]);
      setLots(nextLots);
      setMovements(nextMovements);
      setExpandedLotDateKey(null);
      setExpandedMovementDateKey(null);
      setVisibleLotDateCount(DATES_PAGE_SIZE);
      setVisibleMovementDateCount(DATES_PAGE_SIZE);
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

  const lotDateGroups = useMemo(() => groupByDate(lots, (lot) => lot.receivedAt), [lots]);
  const movementDateGroups = useMemo(
    () => groupByDate(movements, (movement) => movement.createdAt),
    [movements],
  );
  const visibleLotGroups = lotDateGroups.slice(0, visibleLotDateCount);
  const visibleMovementGroups = movementDateGroups.slice(0, visibleMovementDateCount);

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
        {!isLoading && lotDateGroups.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay lotes registrados.</Text>
        ) : (
          visibleLotGroups.map((group) => {
            const isExpanded = expandedLotDateKey === group.dateKey;

            return (
              <View key={`lot-${group.dateKey}`} style={styles.groupBlock}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedLotDateKey((current) => (current === group.dateKey ? null : group.dateKey))
                  }
                  style={styles.groupHeader}
                >
                  <Icon
                    color={colors.navy}
                    kind={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    strokeWidth={2}
                  />
                  <Text style={styles.groupDate}>{group.label}</Text>
                  <Text style={styles.groupCount}>
                    {itemCountLabel(group.items.length, 'producto', 'productos')}
                  </Text>
                </Pressable>

                {isExpanded
                  ? group.items.map((lot) => (
                      <View key={lot.id} style={styles.detailRow}>
                        <View style={styles.flex}>
                          <Text style={styles.rowTitle}>{lot.productName}</Text>
                          <Text style={styles.rowMeta}>{lot.lotCode ?? 'Sin código'}</Text>
                        </View>
                        <View style={styles.rightCol}>
                          <Text style={styles.qtyText}>
                            {formatLotQuantityLabel(lot.remainingQuantity, lot.unitCode)}
                          </Text>
                          <Text style={styles.costText}>
                            {formatLotCost(lot, {
                              baseUnitEquivalent: lot.baseUnitEquivalent,
                              isSubproduct: lot.parentProductId != null,
                            })}
                          </Text>
                          <Text
                            style={[
                              styles.statusText,
                              lot.remainingQuantity > 0 ? styles.open : styles.closed,
                            ]}
                          >
                            {lot.remainingQuantity > 0 ? 'Abierto' : 'Cerrado'}
                          </Text>
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            );
          })
        )}

        {visibleLotDateCount < lotDateGroups.length ? (
          <Pressable
            onPress={() => setVisibleLotDateCount((count) => count + DATES_PAGE_SIZE)}
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>Ver más fechas</Text>
          </Pressable>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
      <Card>
        {!isLoading && movementDateGroups.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay movimientos.</Text>
        ) : (
          visibleMovementGroups.map((group) => {
            const isExpanded = expandedMovementDateKey === group.dateKey;

            return (
              <View key={`movement-${group.dateKey}`} style={styles.groupBlock}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedMovementDateKey((current) =>
                      current === group.dateKey ? null : group.dateKey,
                    )
                  }
                  style={styles.groupHeader}
                >
                  <Icon
                    color={colors.navy}
                    kind={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    strokeWidth={2}
                  />
                  <Text style={styles.groupDate}>{group.label}</Text>
                  <Text style={styles.groupCount}>
                    {itemCountLabel(group.items.length, 'movimiento', 'movimientos')}
                  </Text>
                </Pressable>

                {isExpanded
                  ? group.items.map((movement) => (
                      <View key={movement.id} style={styles.detailRow}>
                        <View style={styles.flex}>
                          <Text style={styles.rowTitle}>{movement.label}</Text>
                          <Text style={styles.rowMeta}>{movement.productName}</Text>
                        </View>
                        <View style={styles.rightCol}>
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
                          {movement.price ? <Text style={styles.priceText}>{movement.price}</Text> : null}
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            );
          })
        )}

        {visibleMovementDateCount < movementDateGroups.length ? (
          <Pressable
            onPress={() => setVisibleMovementDateCount((count) => count + DATES_PAGE_SIZE)}
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>Ver más fechas</Text>
          </Pressable>
        ) : null}
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
  costText: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMint,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
  groupBlock: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
  },
  groupCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  groupDate: {
    color: colors.navy,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingVertical: 10,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  open: {
    color: colors.success,
  },
  priceText: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '600',
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
