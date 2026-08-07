import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  cart: SellCartLine[];
  clientLabel: string;
  isConfirming?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onAddMoreProducts: () => void;
  onBack: () => void;
  onClientLabelChange: (value: string) => void;
  onConfirmPayment: () => Promise<void>;
  onDecreaseLine: (lineId: string) => void;
  onFocusLineGrams: (lineId: string) => void;
  onIncreaseLine: (lineId: string) => void;
  onReceiptLabelChange: (value: string) => void;
  onRemoveLine: (lineId: string) => void;
  onSaveChanges: () => Promise<void>;
  onSetLineGrams: (lineId: string, value: string) => void;
  quote: SavedSellQuote | null;
  quoteId?: string | null;
  receiptLabel: string;
}): ReactElement {
  const quote = props.quote;
  const pageTitle = quote?.id ?? props.quoteId ?? 'Presupuesto';
  const canEdit = quote != null && quote.status !== 'cobrado' && quote.status !== 'cancelado';
  const cartDirty =
    quote != null && JSON.stringify(props.cart) !== JSON.stringify(quote.draft.cart);
  const dirty =
    quote != null &&
    (cartDirty ||
      props.clientLabel.trim() !== quote.draft.clientLabel.trim() ||
      props.receiptLabel.trim() !== quote.draft.receiptLabel.trim());

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

      <View style={styles.fieldsCard}>
        <EditableField
          editable={canEdit}
          label="Cliente"
          onChangeText={props.onClientLabelChange}
          value={props.clientLabel}
        />
        <EditableField
          editable={canEdit}
          label="Comprobante"
          onChangeText={props.onReceiptLabelChange}
          value={props.receiptLabel}
        />
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
    </ScreenContent>
  );
}

function EditableField(props: {
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      {props.editable ? (
        <TextInput
          onChangeText={props.onChangeText}
          placeholder="Estandar"
          placeholderTextColor={colors.slate}
          style={styles.fieldInput}
          value={props.value}
        />
      ) : (
        <Text style={styles.fieldValue}>{props.value}</Text>
      )}
    </View>
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
  field: {
    flex: 1,
    gap: 6,
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldLabel: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '500',
  },
  fieldValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldsCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
    marginTop: 8,
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
    fontWeight: '600',
    marginTop: 2,
  },
  statusTitle: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '500',
  },
  totalsWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
