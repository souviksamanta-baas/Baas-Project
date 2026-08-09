import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listInvoices, type InvoiceListItem } from '../api/billing';
import { Card, ScreenContent, ScreenTitle, useHeaderCollapseOnScroll } from '../components/ui';
import { formatCurrency } from '../lib/sellCart';
import { colors } from '../theme';

const VOUCHER_LABELS: Record<string, string> = {
  FA: 'Factura A',
  FB: 'Factura B',
  FC: 'Factura C',
  NCA: 'NC A',
  NCB: 'NC B',
  NCC: 'NC C',
  NDA: 'ND A',
  NDB: 'ND B',
  NDC: 'ND C',
};

function formatInvoiceNumber(invoice: InvoiceListItem): string {
  const pv = String(invoice.point_of_sale).padStart(5, '0');
  const num = String(invoice.voucher_number ?? 0).padStart(8, '0');
  return `${pv}-${num}`;
}

function formatDate(value: string): string {
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

export function InvoicesListScreen(props: {
  onBack: () => void;
  onOpenInvoice: (invoiceId: string) => void;
  organizationId: string;
}): ReactElement {
  const onScrollOffset = useHeaderCollapseOnScroll();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setInvoices(await listInvoices(props.organizationId));
    } catch (error) {
      setInvoices([]);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar las facturas.');
    } finally {
      setIsLoading(false);
    }
  }, [props.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContent disableScroll title="Facturas">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Facturas" />
        </View>
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
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={invoices}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Todavía no hay facturas electrónicas. Emití una desde un presupuesto cobrado.
              </Text>
            </Card>
          }
          onScroll={(event) => onScrollOffset(event.nativeEvent.contentOffset.y)}
          renderItem={({ item }) => (
            <Pressable onPress={() => props.onOpenInvoice(item.id)} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>
                  {VOUCHER_LABELS[item.voucher_type] ?? item.voucher_type}{' '}
                  {formatInvoiceNumber(item)}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatDate(item.issue_date)}
                  {item.customer_name ? ` · ${item.customer_name}` : ''}
                </Text>
                <Text style={styles.rowCae}>
                  {item.cae ? `CAE ${item.cae}` : item.arca_status}
                </Text>
              </View>
              <Text style={styles.rowAmount}>{formatCurrency(item.total_amount_cents)}</Text>
            </Pressable>
          )}
          scrollEventThrottle={16}
        />
      )}
    </ScreenContent>
  );
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
  emptyCard: {
    marginTop: 8,
    padding: 16,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 8,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  listContent: {
    gap: 8,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  loader: {
    marginTop: 24,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    backgroundColor: '#fff',
    borderColor: '#edf2f4',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowAmount: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  rowCae: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  rowMeta: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
});
