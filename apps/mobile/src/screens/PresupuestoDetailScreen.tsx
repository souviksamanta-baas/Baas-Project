import type { ReactElement } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { escapeHtml, shareHtmlAsPdf } from '../lib/sharePdf';
import { colors } from '../theme';

export function PresupuestoDetailScreen(props: {
  arcaConnected?: boolean;
  cart: SellCartLine[];
  isConfirming?: boolean;
  isIssuingInvoice?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  linkedInvoiceId?: string | null;
  onAddMoreProducts: () => void;
  onBack: () => void;
  onConfirmPayment: () => Promise<void>;
  onConsultInvoice?: () => void;
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
  const hasLinkedInvoice = Boolean(props.linkedInvoiceId);

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

  const activeQuote = quote;
  const subtotalCents = computeCartSubtotalCents(props.cart);
  const discountTotalCents = computeDiscountCents(
    subtotalCents,
    activeQuote.draft.discountMode,
    activeQuote.draft.discountValue,
  );
  const totalCents = computeSaleTotalCents(
    subtotalCents,
    activeQuote.draft.discountMode,
    activeQuote.draft.discountValue,
  );
  const statusLabel = SELL_QUOTE_STATUS_LABELS[activeQuote.status];
  const isGuardado = activeQuote.status === 'guardado';

  async function handleSharePdf(): Promise<void> {
    const linesHtml = props.cart
      .map((line) => {
        const view = mapCartLineToView(line);
        return `<tr>
          <td>${escapeHtml(view.name)}</td>
          <td>${escapeHtml(view.quantityLabel)}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(getCartLineSubtotalCents(line)))}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td, th { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; font-size: 13px; text-align: left; }
        .meta { color: #64748b; font-size: 13px; }
        .total { font-size: 16px; font-weight: 700; margin-top: 16px; text-align: right; }
      </style></head><body>
        <h1>Presupuesto ${escapeHtml(activeQuote.id)}</h1>
        <p class="meta">Cliente: ${escapeHtml(activeQuote.draft.clientLabel)}</p>
        <p class="meta">Estado: ${escapeHtml(statusLabel)}</p>
        <table>
          <thead><tr><th>Producto</th><th>Cant.</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>${linesHtml}</tbody>
        </table>
        <p class="total">Total: ${escapeHtml(formatCurrency(totalCents))}</p>
      </body></html>`;

    try {
      await shareHtmlAsPdf({
        fileName: `presupuesto-${activeQuote.id}.pdf`,
        html,
        shareTitle: `Presupuesto ${activeQuote.id}`,
      });
    } catch (error) {
      Alert.alert(
        'No se pudo compartir',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent>
      <View style={styles.titleRow}>
        <View style={styles.titleGrow}>
          <InventoryScreenTitle onBack={props.onBack} title={pageTitle} />
        </View>
        <Pressable
          accessibilityLabel="Compartir presupuesto"
          hitSlop={8}
          onPress={() => {
            void handleSharePdf();
          }}
          style={styles.shareButton}
        >
          <Icon color={colors.primary} kind="share" size={18} strokeWidth={1.8} />
        </Pressable>
      </View>
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

      {quote.status === 'cobrado' && hasLinkedInvoice && props.onConsultInvoice ? (
        <>
          <ConfirmPrimaryButton
            label="Consultar factura"
            onPress={() => props.onConsultInvoice?.()}
          />
          <View style={styles.footerNote}>
            <Icon color={colors.primary} kind="shield" size={14} strokeWidth={1.8} />
            <Text style={styles.footerText}>
              Este presupuesto ya tiene factura electrónica emitida.
            </Text>
          </View>
        </>
      ) : null}

      {quote.status === 'cobrado' &&
      !hasLinkedInvoice &&
      props.arcaConnected &&
      props.onIssueInvoice ? (
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
  shareButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginRight: 4,
    width: 36,
  },
  titleGrow: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
