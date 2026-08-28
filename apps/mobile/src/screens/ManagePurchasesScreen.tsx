import { useFocusEffect, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/icons';
import { InventoryScreenTitle } from '../components/inventoryUi';
import { MobileContainedModal } from '../components/MobileContainedModal';
import { Card, ScreenContent } from '../components/ui';
import { useLoadPurchase } from '../context/LoadPurchaseProvider';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { useProductCatalog } from '../context/ProductCatalogProvider';
import {
  listPurchases,
  purchaseStatusLabel,
  type PurchaseRecord,
} from '../lib/purchases';
import { confirmPurchaseStock, unconfirmPurchaseStock } from '../lib/purchaseStock';
import { formatCurrency } from '../lib/sellCart';
import { sharePurchasePdf } from '../lib/sharePurchasePdf';
import { purchaseDetailRoute, routes } from '../navigation/routes';
import { colors } from '../theme';

const DATES_PAGE_SIZE = 10;

type DateGroup = {
  dateKey: string;
  items: PurchaseRecord[];
  label: string;
};

function toDateKey(value: string): string {
  const parsedSlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());

  if (parsedSlash) {
    const day = parsedSlash[1]!.padStart(2, '0');
    const month = parsedSlash[2]!.padStart(2, '0');
    const year = parsedSlash[3]!;
    return `${year}-${month}-${day}`;
  }

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

function groupPurchasesByDate(purchases: PurchaseRecord[]): DateGroup[] {
  const groups = new Map<string, PurchaseRecord[]>();

  for (const purchase of purchases) {
    const dateKey = toDateKey(purchase.date || purchase.createdAt);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(purchase);
    } else {
      groups.set(dateKey, [purchase]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => ({
      dateKey,
      items,
      label: formatGroupDateLabel(dateKey),
    }));
}

function itemCountLabel(count: number): string {
  return count === 1 ? '1 compra' : `${count} compras`;
}

export function ManagePurchasesScreen(props: { onBack: () => void }): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const { products, reloadProducts } = useProductCatalog();
  const { loadDraftFromPurchase } = useLoadPurchase();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [visibleDateCount, setVisibleDateCount] = useState(DATES_PAGE_SIZE);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);
  const [menuPurchase, setMenuPurchase] = useState<PurchaseRecord | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !businessCenterId) {
      setPurchases([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await listPurchases(organizationId, businessCenterId);
      setPurchases(next);
      setExpandedDateKey(null);
      setVisibleDateCount(DATES_PAGE_SIZE);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar las compras.');
      setPurchases([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dateGroups = useMemo(() => groupPurchasesByDate(purchases), [purchases]);
  const visibleGroups = dateGroups.slice(0, visibleDateCount);

  async function handleToggleStatus(purchase: PurchaseRecord): Promise<void> {
    if (!organizationId || !businessCenterId) {
      return;
    }

    setMenuPurchase(null);
    setBusyPurchaseId(purchase.id);

    try {
      const updated =
        purchase.status === 'confirmed'
          ? await unconfirmPurchaseStock({
              businessCenterId,
              organizationId,
              products,
              purchaseId: purchase.id,
            })
          : await confirmPurchaseStock({
              businessCenterId,
              organizationId,
              products,
              purchaseId: purchase.id,
            });

      setPurchases((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await reloadProducts();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setBusyPurchaseId(null);
    }
  }

  function handleEditPurchase(purchase: PurchaseRecord): void {
    setMenuPurchase(null);

    if (purchase.status === 'confirmed') {
      Alert.alert(
        'Compra confirmada',
        'Para editarla, primero marcá la compra como pendiente de confirmación.',
      );
      return;
    }

    loadDraftFromPurchase(purchase);
    router.push(routes.inventoryLoadPurchase);
  }

  return (
    <ScreenContent title="Gestionar compras">
      <InventoryScreenTitle onBack={props.onBack} title="Gestionar compras" />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Card>
        {!isLoading && dateGroups.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay compras registradas.</Text>
        ) : (
          visibleGroups.map((group) => {
            const isExpanded = expandedDateKey === group.dateKey;

            return (
              <View key={group.dateKey} style={styles.groupBlock}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedDateKey((current) =>
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
                  <Text style={styles.groupCount}>{itemCountLabel(group.items.length)}</Text>
                </Pressable>

                {isExpanded
                  ? group.items.map((purchase) => {
                      const isConfirmed = purchase.status === 'confirmed';

                      return (
                        <View key={purchase.id} style={styles.detailRow}>
                          <Pressable
                            onPress={() => router.push(purchaseDetailRoute(purchase.id))}
                            style={styles.flex}
                          >
                            <Text style={styles.rowTitle}>{purchase.number}</Text>
                            <Text style={styles.rowMeta}>{purchase.supplier}</Text>
                            <Text style={styles.rowMeta}>
                              {purchase.itemCount} ítem{purchase.itemCount === 1 ? '' : 's'}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                isConfirmed
                                  ? styles.statusBadgeConfirmed
                                  : styles.statusBadgePending,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  isConfirmed
                                    ? styles.statusBadgeTextConfirmed
                                    : styles.statusBadgeTextPending,
                                ]}
                              >
                                {purchaseStatusLabel(purchase.status)}
                              </Text>
                            </View>
                          </Pressable>
                          <View style={styles.rightCol}>
                            <Text style={styles.costText}>
                              {formatCurrency(purchase.totalCostCents)}
                            </Text>
                            <Pressable
                              accessibilityLabel="Opciones de compra"
                              disabled={busyPurchaseId === purchase.id}
                              hitSlop={8}
                              onPress={() => setMenuPurchase(purchase)}
                              style={styles.menuButton}
                            >
                              <Icon
                                color={
                                  busyPurchaseId === purchase.id
                                    ? colors.slateLight
                                    : colors.slate
                                }
                                kind="dots-vertical"
                                size={18}
                                strokeWidth={2}
                              />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}

        {visibleDateCount < dateGroups.length ? (
          <Pressable
            onPress={() => setVisibleDateCount((count) => count + DATES_PAGE_SIZE)}
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>Ver más fechas</Text>
          </Pressable>
        ) : null}
      </Card>

      <MobileContainedModal
        animationType="slide"
        onClose={() => setMenuPurchase(null)}
        visible={menuPurchase != null}
      >
        <Text style={styles.modalTitle}>{menuPurchase?.number ?? 'Opciones'}</Text>
        {menuPurchase ? (
          <Text style={styles.modalSubtitle}>
            {purchaseStatusLabel(menuPurchase.status)}
          </Text>
        ) : null}

        <Pressable
          onPress={() => {
            if (menuPurchase) {
              const purchaseId = menuPurchase.id;
              setMenuPurchase(null);
              router.push(purchaseDetailRoute(purchaseId));
            }
          }}
          style={styles.actionRow}
        >
          <Text style={styles.actionRowText}>Ver detalle</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (menuPurchase) {
              void handleToggleStatus(menuPurchase);
            }
          }}
          style={styles.actionRow}
        >
          <Text style={styles.actionRowText}>
            {menuPurchase?.status === 'confirmed'
              ? 'Marcar como pendiente de confirmación'
              : 'Marcar como confirmada'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (menuPurchase) {
              handleEditPurchase(menuPurchase);
            }
          }}
          style={styles.actionRow}
        >
          <Text style={styles.actionRowText}>Editar compra</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!menuPurchase) {
              return;
            }
            const purchase = menuPurchase;
            setMenuPurchase(null);
            void (async () => {
              try {
                await sharePurchasePdf(purchase);
              } catch (error) {
                Alert.alert(
                  'No se pudo compartir',
                  error instanceof Error ? error.message : 'Error desconocido',
                );
              }
            })();
          }}
          style={[styles.actionRow, styles.actionRowLast]}
        >
          <Text style={styles.actionRowText}>Compartir PDF</Text>
        </Pressable>
      </MobileContainedModal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionRowText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '500',
  },
  costText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  detailRow: {
    alignItems: 'flex-start',
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '300',
    paddingVertical: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  groupBlock: {
    paddingVertical: 2,
  },
  groupCount: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '400',
  },
  groupDate: {
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  menuButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  modalSubtitle: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  rowMeta: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
    marginTop: 2,
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeConfirmed: {
    backgroundColor: colors.primarySoft,
  },
  statusBadgePending: {
    backgroundColor: '#fff4e5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeTextConfirmed: {
    color: colors.primary,
  },
  statusBadgeTextPending: {
    color: '#b86a00',
  },
});
