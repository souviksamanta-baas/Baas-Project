import { useFocusEffect } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/icons';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import {
  formatCurrency,
  getCartLineSubtotalCents,
  getEffectiveGrams,
  getSellQuoteTotalCents,
  listSellQuotes,
  SELL_QUOTE_STATUS_LABELS,
  SELL_QUOTE_STATUS_ORDER,
  type SavedSellQuote,
  type SellCartLine,
  type SellQuoteStatus,
  updateSellQuoteStatus,
} from '../lib/sellCart';
import { colors } from '../theme';

const FILTERS: Array<{ id: SellQuoteStatus | 'all'; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'guardado', label: 'Guardados' },
  { id: 'enviado', label: 'Enviados' },
  { id: 'aceptado', label: 'Aceptados' },
  { id: 'cobrado', label: 'Cobrados' },
  { id: 'cancelado', label: 'Cancelados' },
];

function statusTone(status: SellQuoteStatus): { backgroundColor: string; color: string } {
  switch (status) {
    case 'cobrado':
      return { backgroundColor: colors.primarySoft, color: colors.primaryDark };
    case 'aceptado':
      return { backgroundColor: colors.infoSoft, color: colors.info };
    case 'enviado':
      return { backgroundColor: colors.warningSoft, color: colors.warning };
    case 'cancelado':
    case 'vencido':
      return { backgroundColor: colors.dangerSoft, color: colors.danger };
    case 'guardado':
    default:
      return { backgroundColor: colors.borderSoft, color: colors.textSecondary };
  }
}

function formatQuoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLineQuantity(line: SellCartLine): string {
  if (line.soldByWeight) {
    return `${getEffectiveGrams(line)} g`;
  }

  return `${line.quantity} u`;
}

export function BillingQuotesScreen(props: {
  onBack: () => void;
  onOpenSell: () => void;
}): ReactElement {
  const [quotes, setQuotes] = useState<SavedSellQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<SellQuoteStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setQuotes(await listSellQuotes());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleQuotes = useMemo(() => {
    if (activeFilter === 'all') {
      return quotes;
    }

    return quotes.filter((quote) => quote.status === activeFilter);
  }, [activeFilter, quotes]);

  async function handleStatusChange(quoteId: string, status: SellQuoteStatus): Promise<void> {
    setIsSaving(true);
    try {
      await updateSellQuoteStatus(quoteId, status);
      setQuotes(await listSellQuotes());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenContent title="Facturación">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle
            subtitle="Presupuestos con estado de seguimiento"
            title="Facturación"
          />
        </View>
      </View>

      <Pressable onPress={props.onOpenSell} style={styles.sellLink}>
        <Text style={styles.sellLinkText}>+ Crear desde Vender productos</Text>
      </Pressable>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            onPress={() => setActiveFilter(filter.id)}
            style={[styles.filterPill, activeFilter === filter.id && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter.id && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && visibleQuotes.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            No hay presupuestos{activeFilter === 'all' ? '' : ' en este estado'}. Guardá uno desde
            Vender productos con “Guardar presupuesto”.
          </Text>
        </Card>
      ) : (
        visibleQuotes.map((quote) => {
          const tone = statusTone(quote.status);
          const itemCount = quote.draft.cart.length;
          const isExpanded = expandedId === quote.id;

          return (
            <Card key={quote.id} style={styles.quoteCard}>
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : quote.id)}
                style={styles.quoteHeader}
              >
                <View style={[styles.expandButton, isExpanded && styles.expandButtonOpen]}>
                  <Icon
                    color={isExpanded ? colors.surface : colors.primary}
                    kind="plus"
                    size={14}
                    strokeWidth={2.2}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.quoteId}>{quote.id}</Text>
                  <Text style={styles.quoteMeta}>
                    {formatQuoteDate(quote.createdAt)} · {itemCount} ítem
                    {itemCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: tone.backgroundColor }]}>
                  <Text style={[styles.statusText, { color: tone.color }]}>
                    {SELL_QUOTE_STATUS_LABELS[quote.status]}
                  </Text>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.expandedBody}>
                  {quote.draft.cart.map((line) => (
                    <View key={line.id} style={styles.lineRow}>
                      <View style={styles.flex}>
                        <Text style={styles.lineName}>{line.name}</Text>
                        <Text style={styles.lineMeta}>
                          {formatLineQuantity(line)} · {formatCurrency(line.unitPriceCents)}
                          {line.soldByWeight ? '/kg' : ' c/u'}
                        </Text>
                      </View>
                      <Text style={styles.lineTotal}>
                        {formatCurrency(getCartLineSubtotalCents(line))}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(getSellQuoteTotalCents(quote))}
                    </Text>
                  </View>

                  <Text style={styles.statusHint}>Cambiar estado</Text>
                  <View style={styles.statusChipRow}>
                    {SELL_QUOTE_STATUS_ORDER.map((status) => (
                      <Pressable
                        disabled={isSaving || quote.status === status}
                        key={status}
                        onPress={() => void handleStatusChange(quote.id, status)}
                        style={[
                          styles.statusChip,
                          quote.status === status && styles.statusChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            quote.status === status && styles.statusChipTextActive,
                          ]}
                        >
                          {SELL_QUOTE_STATUS_LABELS[status]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  expandButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  expandButtonOpen: {
    backgroundColor: colors.primary,
  },
  expandedBody: {
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  filterPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.primaryDark,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  lineMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  lineName: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  lineRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  lineTotal: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  quoteCard: {
    gap: 0,
  },
  quoteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  quoteId: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  quoteMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sellLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  sellLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: colors.surface,
  },
  statusHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
    marginTop: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  totalValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
});
