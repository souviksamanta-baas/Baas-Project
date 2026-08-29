import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/icons';
import { InventoryScreenTitle } from '../components/inventoryUi';
import { Card, ScreenContent } from '../components/ui';
import { useLoadPurchase } from '../context/LoadPurchaseProvider';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';
import { useProductCatalog } from '../context/ProductCatalogProvider';
import {
  getPurchaseById,
  purchaseStatusLabel,
  type PurchaseRecord,
} from '../lib/purchases';
import { confirmPurchaseStock, unconfirmPurchaseStock } from '../lib/purchaseStock';
import { formatCurrency } from '../lib/sellCart';
import { sharePurchasePdf } from '../lib/sharePurchasePdf';
import { colors, radius } from '../theme';

export function PurchaseDetailScreen(props: {
  onBack: () => void;
  onOpenLoadPurchase: () => void;
  purchaseId: string;
}): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const { products, reloadProducts } = useProductCatalog();
  const { loadDraftFromPurchase } = useLoadPurchase();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || !businessCenterId) {
      setPurchase(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const next = await getPurchaseById({
        businessCenterId,
        organizationId,
        purchaseId: props.purchaseId,
      });
      setPurchase(next);
    } catch {
      setPurchase(null);
    } finally {
      setIsLoading(false);
    }
  }, [businessCenterId, organizationId, props.purchaseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleToggleStatus(): Promise<void> {
    if (!purchase || !organizationId || !businessCenterId) {
      return;
    }

    setIsBusy(true);
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
      setPurchase(updated);
      await reloadProducts();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsBusy(false);
    }
  }

  function handleEdit(): void {
    if (!purchase) {
      return;
    }
    if (purchase.status === 'confirmed') {
      Alert.alert(
        'Compra confirmada',
        'Para editarla, primero marcá la compra como pendiente de confirmación.',
      );
      return;
    }
    loadDraftFromPurchase(purchase);
    props.onOpenLoadPurchase();
  }

  async function handleShare(): Promise<void> {
    if (!purchase) {
      return;
    }
    try {
      await sharePurchasePdf(purchase);
    } catch (error) {
      Alert.alert(
        'No se pudo compartir',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  if (isLoading) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={props.onBack} title="Compra" />
        <ActivityIndicator color={colors.primary} />
      </ScreenContent>
    );
  }

  if (!purchase) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={props.onBack} title="Compra" />
        <Card>
          <Text style={styles.emptyText}>No se encontró esta compra.</Text>
        </Card>
      </ScreenContent>
    );
  }

  const isConfirmed = purchase.status === 'confirmed';

  return (
    <ScreenContent>
      <View style={styles.titleRow}>
        <View style={styles.titleGrow}>
          <InventoryScreenTitle onBack={props.onBack} title={purchase.number} />
        </View>
        <Pressable
          accessibilityLabel="Compartir compra"
          hitSlop={8}
          onPress={() => {
            void handleShare();
          }}
          style={styles.shareButton}
        >
          <Icon color={colors.primary} kind="share" size={18} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View
        style={[
          styles.statusCard,
          isConfirmed ? styles.statusConfirmed : styles.statusPending,
        ]}
      >
        <Icon
          color={isConfirmed ? colors.primary : colors.warning}
          kind={isConfirmed ? 'check' : 'clock'}
          size={18}
          strokeWidth={1.8}
        />
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>Estado</Text>
          <Text style={styles.statusSubtitle}>{purchaseStatusLabel(purchase.status)}</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.metaLabel}>Proveedor</Text>
        <Text style={styles.metaValue}>{purchase.supplier || '—'}</Text>
        <Text style={styles.metaLabel}>Fecha</Text>
        <Text style={styles.metaValue}>{purchase.date || '—'}</Text>
        <Text style={styles.metaLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(purchase.totalCostCents)}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Ítems</Text>
        {purchase.lines.length === 0 ? (
          <Text style={styles.emptyText}>Sin ítems.</Text>
        ) : (
          purchase.lines.map((line, index) => (
            <View
              key={line.id}
              style={[
                styles.lineRow,
                index < purchase.lines.length - 1 && styles.lineRowDivider,
              ]}
            >
              <View style={styles.flex}>
                <Text style={styles.lineName}>{line.productName}</Text>
                <Text style={styles.lineMeta}>
                  {line.quantity} {line.unitCode}
                  {line.expiresDate ? ` · Vence ${line.expiresDate}` : ''}
                </Text>
              </View>
              <Text style={styles.lineCost}>{formatCurrency(line.lineTotalCents)}</Text>
            </View>
          ))
        )}
      </Card>

      <Pressable
        disabled={isBusy}
        onPress={() => {
          void handleToggleStatus();
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>
          {isConfirmed
            ? 'Marcar como pendiente de confirmación'
            : 'Marcar como confirmada'}
        </Text>
      </Pressable>

      <Pressable disabled={isBusy} onPress={handleEdit} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Editar compra</Text>
      </Pressable>

      <Pressable
        disabled={isBusy}
        onPress={() => {
          void handleShare();
        }}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Compartir PDF</Text>
      </Pressable>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.slate,
    fontSize: 14,
  },
  flex: {
    flex: 1,
  },
  lineCost: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  lineMeta: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  lineName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  lineRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  lineRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: {
    color: colors.slate,
    fontSize: 12,
    marginTop: 8,
  },
  metaValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  shareButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusConfirmed: {
    backgroundColor: colors.primarySoft,
  },
  statusPending: {
    backgroundColor: '#fff7ed',
  },
  statusSubtitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  statusTitle: {
    color: colors.slate,
    fontSize: 12,
  },
  titleGrow: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  totalValue: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
  },
});
