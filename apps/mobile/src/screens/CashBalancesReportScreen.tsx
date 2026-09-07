import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { getCashRangeReport, type CashRangeReport } from '../api/cash';
import { Card, ScreenContent, ScreenTitle, useHeaderCollapseOnScroll } from '../components/ui';
import { todayIsoDate } from '../lib/cashPostings';
import { formatCurrency } from '../lib/sellCart';
import { escapeHtml, shareHtmlAsPdf } from '../lib/sharePdf';
import { colors } from '../theme';

function shiftMonthStart(isoDate: string): string {
  return `${isoDate.slice(0, 8)}01`;
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function CashBalancesReportScreen(props: {
  businessCenterId: string;
  businessCenterName?: string | null;
  onBack: () => void;
  organizationId: string;
  timezone?: string | null;
}): ReactElement {
  const onScrollOffset = useHeaderCollapseOnScroll();
  const today = todayIsoDate(props.timezone);
  const [fromDate, setFromDate] = useState(() => shiftMonthStart(today));
  const [toDate, setToDate] = useState(today);
  const [report, setReport] = useState<CashRangeReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) {
      setErrorMessage('Usá fechas en formato AAAA-MM-DD.');
      return;
    }
    if (fromDate > toDate) {
      setErrorMessage('La fecha desde no puede ser posterior a hasta.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      setReport(
        await getCashRangeReport({
          businessCenterId: props.businessCenterId,
          fromDate: fromDate.trim(),
          organizationId: props.organizationId,
          toDate: toDate.trim(),
        }),
      );
    } catch (error) {
      setReport(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo generar el reporte.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, props.businessCenterId, props.organizationId, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharePdf = async () => {
    if (!report) {
      return;
    }
    const rows = report.days
      .map(
        (day) => `<tr>
          <td>${escapeHtml(formatDisplayDate(day.entryDate))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.saldoInicialCents))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.ingresosCents))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.egresosCents))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.saldoFinalCents))}</td>
        </tr>`,
      )
      .join('');

    const center = props.businessCenterName ? escapeHtml(props.businessCenterName) : 'Sucursal';
    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 13px; margin: 2px 0; }
        .summary { margin: 16px 0; }
        .summary div { margin: 4px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        td, th { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; font-size: 12px; text-align: left; }
      </style></head><body>
        <h1>Reporte de balances</h1>
        <p class="meta">${center}</p>
        <p class="meta">Desde ${escapeHtml(formatDisplayDate(report.fromDate))} hasta ${escapeHtml(formatDisplayDate(report.toDate))}</p>
        <div class="summary">
          <div><strong>Saldo inicial:</strong> ${escapeHtml(formatCurrency(report.openingCents))}</div>
          <div><strong>Ingresos del período:</strong> ${escapeHtml(formatCurrency(report.ingresosCents))}</div>
          <div><strong>Egresos del período:</strong> ${escapeHtml(formatCurrency(report.egresosCents))}</div>
          <div><strong>Saldo final:</strong> ${escapeHtml(formatCurrency(report.closingCents))}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th style="text-align:right">Inicial</th>
              <th style="text-align:right">Ingresos</th>
              <th style="text-align:right">Egresos</th>
              <th style="text-align:right">Final</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`;

    await shareHtmlAsPdf({
      fileName: `balances-${report.fromDate}_${report.toDate}.pdf`,
      html,
      shareTitle: 'Reporte de balances',
    });
  };

  const shareExcel = async () => {
    if (!report) {
      return;
    }
    const header = 'Fecha;Saldo inicial;Ingresos;Egresos;Saldo final';
    const lines = report.days.map(
      (day) =>
        `${day.entryDate};${(day.saldoInicialCents / 100).toFixed(2)};${(day.ingresosCents / 100).toFixed(2)};${(day.egresosCents / 100).toFixed(2)};${(day.saldoFinalCents / 100).toFixed(2)}`,
    );
    const summary = [
      `Resumen;;;`,
      `Saldo inicial;${(report.openingCents / 100).toFixed(2)};;;`,
      `Ingresos;${(report.ingresosCents / 100).toFixed(2)};;;`,
      `Egresos;${(report.egresosCents / 100).toFixed(2)};;;`,
      `Saldo final;${(report.closingCents / 100).toFixed(2)};;;`,
    ];
    const csv = `\uFEFF${summary.join('\n')}\n\n${header}\n${lines.join('\n')}`;
    const fileName = `balances-${report.fromDate}_${report.toDate}.csv`;
    const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${fileName}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Exportar balances (Excel)',
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exportado', `Archivo guardado en ${fileUri}`);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo exportar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  };

  return (
    <ScreenContent disableScroll title="Balances">
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Reportes · Balances" />
          {props.businessCenterName ? (
            <Text style={styles.subtitle}>{props.businessCenterName}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => onScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <Card style={styles.filtersCard}>
          <Text style={styles.fieldLabel}>Desde (AAAA-MM-DD)</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setFromDate}
            style={styles.input}
            value={fromDate}
          />
          <Text style={styles.fieldLabel}>Hasta (AAAA-MM-DD)</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setToDate}
            style={styles.input}
            value={toDate}
          />
          <Pressable onPress={() => void load()} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>Actualizar</Text>
          </Pressable>
        </Card>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : errorMessage ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </Card>
        ) : report ? (
          <>
            <Card style={styles.summaryCard}>
              <SummaryRow label="Saldo inicial" value={formatCurrency(report.openingCents)} />
              <SummaryRow label="Ingresos del período" value={formatCurrency(report.ingresosCents)} />
              <SummaryRow label="Egresos del período" value={formatCurrency(report.egresosCents)} />
              <SummaryRow label="Saldo final" value={formatCurrency(report.closingCents)} />
            </Card>

            <View style={styles.exportRow}>
              <Pressable onPress={() => void sharePdf()} style={styles.exportButton}>
                <Text style={styles.exportButtonText}>PDF</Text>
              </Pressable>
              <Pressable onPress={() => void shareExcel()} style={styles.exportButton}>
                <Text style={styles.exportButtonText}>Excel</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Detalle diario</Text>
            {report.days.map((day) => (
              <Card key={day.entryDate} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{formatDisplayDate(day.entryDate)}</Text>
                <Text style={styles.dayMeta}>
                  Inicial {formatCurrency(day.saldoInicialCents)} · Ingresos{' '}
                  {formatCurrency(day.ingresosCents)} · Egresos {formatCurrency(day.egresosCents)}
                </Text>
                <Text style={styles.dayFinal}>Final {formatCurrency(day.saldoFinalCents)}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenContent>
  );
}

function SummaryRow(props: { label: string; value: string }): ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{props.label}</Text>
      <Text style={styles.summaryValue}>{props.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backPressable: {
    marginRight: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  backText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  dayCard: {
    marginBottom: 8,
    padding: 12,
  },
  dayFinal: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  dayMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyCard: {
    padding: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
  },
  exportButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  exportRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
  filtersCard: {
    marginBottom: 12,
    padding: 14,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loader: {
    marginTop: 24,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 12,
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: -4,
  },
  summaryCard: {
    marginBottom: 12,
    padding: 14,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
