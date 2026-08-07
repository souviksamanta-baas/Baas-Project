import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { getInvoice, type InvoiceDetail } from '../api/billing';
import { Card, ScreenContent, ScreenTitle } from '../components/ui';
import { OutlineButton, PrimaryButton } from '../design-system';
import { formatCurrency } from '../lib/sellCart';
import { colors } from '../theme';

const VOUCHER_LABELS: Record<string, string> = {
  FA: 'Factura A',
  FB: 'Factura B',
  FC: 'Factura C',
  NCA: 'Nota de crédito A',
  NCB: 'Nota de crédito B',
  NCC: 'Nota de crédito C',
  NDA: 'Nota de débito A',
  NDB: 'Nota de débito B',
  NDC: 'Nota de débito C',
};

function formatInvoiceNumber(invoice: InvoiceDetail): string {
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

async function writeInvoicePdfFile(params: {
  invoiceId: string;
  pdfBase64: string;
  voucherLabel: string;
}): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('No hay carpeta temporal disponible en este dispositivo.');
  }

  const safeName = params.voucherLabel.replace(/[^\w.-]+/g, '_');
  const path = `${cacheDir}factura-${safeName}-${params.invoiceId.slice(0, 8)}.pdf`;
  await FileSystem.writeAsStringAsync(path, params.pdfBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export function InvoiceDetailScreen(props: {
  invoiceId: string;
  onBack: () => void;
  organizationId: string;
}): ReactElement {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setInvoice(
        await getInvoice({
          invoiceId: props.invoiceId,
          organizationId: props.organizationId,
        }),
      );
    } catch (error) {
      Alert.alert(
        'No se pudo cargar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
      setInvoice(null);
    } finally {
      setIsLoading(false);
    }
  }, [props.invoiceId, props.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sharePdf(): Promise<void> {
    if (!invoice?.pdfBase64) {
      Alert.alert('PDF no disponible', 'Esta factura todavía no tiene un PDF generado.');
      return;
    }

    setIsSharingPdf(true);
    try {
      const voucherLabel = formatInvoiceNumber(invoice);
      const path = await writeInvoicePdfFile({
        invoiceId: invoice.id,
        pdfBase64: invoice.pdfBase64,
        voucherLabel,
      });

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${invoice.pdfBase64}`;
        link.download = `factura-${voucherLabel}.pdf`;
        link.click();
        return;
      }

      await Share.share({
        title: `Factura ${voucherLabel}`,
        url: path,
        message:
          Platform.OS === 'android'
            ? `Factura ${voucherLabel} — CAE ${invoice.cae ?? ''}`
            : undefined,
      });
    } catch (error) {
      Alert.alert(
        'No se pudo compartir el PDF',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSharingPdf(false);
    }
  }

  async function openQr(): Promise<void> {
    if (!invoice?.qr_url) {
      return;
    }
    Alert.alert(
      'Constancia ARCA',
      'La página de ARCA pide captcha y valida el CAE en sus sistemas. En homologación a veces falla. Para la factura usá Descargar / compartir PDF.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir ARCA',
          onPress: () => {
            void Linking.openURL(invoice.qr_url!).catch(() => {
              Alert.alert('No se pudo abrir el QR', invoice.qr_url ?? '');
            });
          },
        },
      ],
    );
  }

  const hasPdf = Boolean(invoice?.pdfBase64 || invoice?.hasPdf);

  return (
    <ScreenContent title="Factura">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle title="Detalle de factura" />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !invoice ? (
        <Card style={styles.card}>
          <Text style={styles.emptyText}>No se encontró esta factura.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.voucherType}>
              {VOUCHER_LABELS[invoice.voucher_type] ?? invoice.voucher_type}
            </Text>
            <Text style={styles.voucherNumber}>{formatInvoiceNumber(invoice)}</Text>
            <Text style={styles.meta}>Emitida el {formatDate(invoice.issue_date)}</Text>
            <Text style={styles.total}>{formatCurrency(invoice.total_amount_cents)}</Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{invoice.customer_name?.trim() || 'Consumidor final'}</Text>
            {invoice.customer_document_number ? (
              <Text style={styles.meta}>
                {invoice.customer_document_type ?? 'Doc'} {invoice.customer_document_number}
              </Text>
            ) : null}

            <Text style={[styles.label, styles.labelSpaced]}>Estado ARCA</Text>
            <Text style={styles.value}>{invoice.arca_status}</Text>

            <Text style={[styles.label, styles.labelSpaced]}>CAE</Text>
            <Text style={styles.value}>{invoice.cae ?? '—'}</Text>
            {invoice.cae_expiration ? (
              <Text style={styles.meta}>Vence {formatDate(invoice.cae_expiration)}</Text>
            ) : null}
          </Card>

          {hasPdf ? (
            <PrimaryButton
              disabled={isSharingPdf || !invoice.pdfBase64}
              fullWidth
              label={isSharingPdf ? 'Preparando PDF…' : 'Descargar / compartir PDF'}
              onPress={() => void sharePdf()}
            />
          ) : (
            <Text style={styles.pdfHint}>Esta factura no tiene PDF generado.</Text>
          )}

          {invoice.qr_url ? (
            <OutlineButton
              fullWidth
              label="Abrir constancia ARCA (QR)"
              onPress={() => void openQr()}
            />
          ) : null}

          <Text style={styles.pdfHint}>
            El PDF es el comprobante para guardar o enviar. La página de ARCA es solo para
            constatar el CAE (puede pedir captcha).
          </Text>
        </>
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
  card: {
    gap: 4,
    marginBottom: 12,
    padding: 16,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  label: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  labelSpaced: {
    marginTop: 12,
  },
  meta: {
    color: colors.slate,
    fontSize: 13,
    marginTop: 2,
  },
  pdfHint: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  total: {
    color: colors.navy,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 10,
  },
  value: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  voucherNumber: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  voucherType: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
