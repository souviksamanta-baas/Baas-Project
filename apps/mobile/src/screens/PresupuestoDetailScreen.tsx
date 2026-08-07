import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/icons';
import {
  CartLineRow,
  ConfirmEditButton,
  ConfirmPrimaryButton,
  InventoryScreenTitle,
  SaleTotalsBlock,
} from '../components/inventoryUi';
import { Card, ScreenContent } from '../components/ui';
import { mapCartLineToView } from '../context/SellCartProvider';
import {
  computeCartSubtotalCents,
  computeDiscountCents,
  computeSaleTotalCents,
  formatCurrency,
  formatSignedCurrency,
  getCartLineSubtotalCents,
  SELL_QUOTE_STATUS_LABELS,
  type SavedSellQuote,
  type SellCartLine,
} from '../lib/sellCart';
import { colors } from '../theme';

export function PresupuestoDetailScreen(props: {
  arcaConnected?: boolean;
  cart: SellCartLine[];
  isConfirming?: boolean;
  isIssuingInvoice?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onAddMoreProducts: () => void;
  onBack: () => void;
  onConfirmPayment: () => Promise<void>;
  onDecreaseLine: (lineId: string) => void;
  onFocusLineGrams: (lineId: string) => void;
  onIncreaseLine: (lineId: string) => void;
  onIssueInvoice?: () => Promise<void>;
  onRemoveLine: (lineId: string) => void;
  onSaveChanges: () => Promise<void>;
  onSetLineGrams: (lineId: string, value: string) => void;
  quote: SavedSellQuote | null;
  quoteId?: string | null;
}): ReactElement {
  const quote = props.quote;
  const pageTitle = quote?.id ?? props.quoteId ?? 'Presupuesto';
  const canEdit = quote != null && quote.status !== 'cobrado' && quote.status !== 'cancelado';
  const dirty =
    quote != null && JSON.stringify(props.cart) !== JSON.stringify(quote.draft.cart);

  if (props.isLoading) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={props.onBack} title={pageTitle} />
        <ActivityIndicator color={colors.primary} />
      </ScreenContent>
    );
  }

  if (!quote) {
    return (
      <ScreenContent>
        <InventoryScreenTitle onBack={props.onBack} title={pageTitle} />
        <Card>
          <Text style={styles.emptyText}>No se encontró este presupuesto.</Text>
        </Card>
      </ScreenContent>
    );
  }

  const subtotalCents = computeCartSubtotalCents(props.cart);
  const discountTotalCents = computeDiscountCents(
    subtotalCents,
    quote.draft.discountMode,
    quote.draft.discountValue,
  );
  const totalCents = computeSaleTotalCents(
    subtotalCents,
    quote.draft.discountMode,
    quote.draft.discountValue,
  );
  const statusLabel = SELL_QUOTE_STATUS_LABELS[quote.status];
  const isGuardado = quote.status === 'guardado';

  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} title={pageTitle} />

      <View
        style={[
          styles.statusCard,
          isGuardado ? styles.statusCardGuardado : styles.statusCardOther,
        ]}
      >
        <Icon
          color={isGuardado ? colors.warning : colors.primary}
          kind={isGuardado ? 'clock' : 'check'}
          size={18}
          strokeWidth={1.8}
        />
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>Estado</Text>
          <Text style={styles.statusSubtitle}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Detalle</Text>
        </View>
        {props.cart.length === 0 ? (
          <Text style={styles.emptyCartText}>No hay productos en este presupuesto.</Text>
        ) : (
          props.cart.map((line, index) => {
            const view = mapCartLineToView(line);
            return (
              <CartLineRow
                gramsShowPlaceholder={view.gramsShowPlaceholder}
                gramsValue={view.gramsValue}
                inListCard
                isFirst={index === 0}
                item={{
                  id: line.id,
                  name: line.name,
                  price: formatCurrency(getCartLineSubtotalCents(line)),
                  qty: view.quantityLabel,
                  weight: line.soldByWeight,
                }}
                key={line.id}
                onDecrease={canEdit ? () => props.onDecreaseLine(line.id) : undefined}
                onGramsChange={canEdit ? (value) => props.onSetLineGrams(line.id, value) : undefined}
                onGramsFocus={canEdit ? () => props.onFocusLineGrams(line.id) : undefined}
                onIncrease={canEdit ? () => props.onIncreaseLine(line.id) : undefined}
                onRemove={canEdit ? () => props.onRemoveLine(line.id) : undefined}
              />
            );
          })
        )}

        {canEdit ? (
          <Pressable onPress={props.onAddMoreProducts} style={styles.addProductsButton}>
            <Text style={styles.addProductsText}>+ Agregar más productos</Text>
          </Pressable>
        ) : null}

        <View style={styles.totalsWrap}>
          <SaleTotalsBlock
            discountLabel={
              quote.draft.discountValue > 0
                ? quote.draft.discountMode === 'percent'
                  ? `Descuento ${quote.draft.discountValue}%`
                  : 'Descuento'
                : 'Descuento'
            }
            discountValue={
              discountTotalCents > 0
                ? formatSignedCurrency(discountTotalCents)
                : formatCurrency(0)
            }
            subtotal={formatCurrency(subtotalCents)}
            total={formatCurrency(totalCents)}
            totalLabel={quote.status === 'cobrado' ? 'Total cobrado' : 'Total'}
          />
        </View>
      </View>

      {canEdit ? (
        <>
          <ConfirmEditButton
            disabled={!dirty || props.isSaving || props.isConfirming}
            icon="bill"
            label={props.isSaving ? 'Guardando…' : 'Guardar cambios'}
            onPress={() => void props.onSaveChanges()}
          />
          {quote.status !== 'cobrado' ? (
            <ConfirmPrimaryButton
              disabled={props.isConfirming || props.isSaving || props.cart.length === 0}
              label={props.isConfirming ? 'Confirmando…' : 'Confirmar pago'}
              onPress={() => void props.onConfirmPayment()}
            />
          ) : null}
          <View style={styles.footerNote}>
            <Icon color={colors.primary} kind="shield" size={14} strokeWidth={1.8} />
            <Text style={styles.footerText}>
              Guardá cambios o confirmá el pago cuando lo recibas.
            </Text>
          </View>
        </>
      ) : null}

      {quote.status === 'cobrado' && props.arcaConnected && props.onIssueInvoice ? (
        <>
          <ConfirmPrimaryButton
            disabled={props.isIssuingInvoice || props.cart.length === 0}
            label={props.isIssuingInvoice ? 'Emitiendo factura…' : 'Emitir factura ARCA'}
            onPress={() => void props.onIssueInvoice?.()}
          />
          <View style={styles.footerNote}>
            <Icon color={colors.primary} kind="shield" size={14} strokeWidth={1.8} />
            <Text style={styles.footerText}>
              Se solicita CAE a ARCA y se genera el comprobante fiscal.
            </Text>
          </View>
        </>
      ) : null}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  addProductsButton: {
    alignItems: 'center',
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  addProductsText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCartText: {
    color: colors.slate,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 15,
  },
  flex: {
    flex: 1,
  },
  footerNote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  footerText: {
    color: colors.slate,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  listHeader: {
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusCardGuardado: {
    backgroundColor: colors.warningSoft,
  },
  statusCardOther: {
    backgroundColor: colors.primarySoft,
  },
  statusSubtitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  statusTitle: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
  totalsWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
