import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import {
  getCashRangeReport,
  type CashLedgerEntry,
  type CashRangeDay,
  type CashRangeReport,
} from '../api/cash';
import {
  CashMovementDateHeader,
  CashMovementRow,
  CashMovementsEmpty,
  CashMovementsSectionTitle,
} from '../components/CashMovementsList';
import { Card, ScreenContent, ScreenTitle, useHeaderCollapseOnScroll } from '../components/ui';
import { Icon } from '../components/icons';
import { todayIsoDate } from '../lib/cashPostings';
import {
  buildMonthCells,
  CASH_WEEKDAY_LABELS,
  exceedsThreeMonthSpan,
  formatCashDateLong,
  formatCashDateShort,
  formatCashMovementAmount,
  formatMonthLabel,
  shiftMonth,
} from '../lib/cashUi';
import { formatCurrency } from '../lib/sellCart';
import { escapeHtml, shareHtmlAsPdf } from '../lib/sharePdf';
import { colors } from '../theme';

function shiftMonthStart(isoDate: string): string {
  return `${isoDate.slice(0, 8)}01`;
}

function entryConcept(entry: CashLedgerEntry): string {
  const concept = entry.concept.trim();
  if (concept) {
    return concept;
  }
  switch (entry.source) {
    case 'venta':
      return 'Venta';
    case 'compra':
      return 'Compra';
    case 'stock':
      return 'Stock';
    default:
      return 'Manual';
  }
}

type DateField = 'from' | 'to';

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
  const [pickerField, setPickerField] = useState<DateField | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => today.slice(0, 7));

  const load = useCallback(async () => {
    if (fromDate > toDate) {
      setErrorMessage('La fecha desde no puede ser posterior a hasta.');
      return;
    }
    if (exceedsThreeMonthSpan(fromDate, toDate)) {
      setErrorMessage('El rango no puede superar los 3 meses.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      setReport(
        await getCashRangeReport({
          businessCenterId: props.businessCenterId,
          fromDate,
          organizationId: props.organizationId,
          toDate,
        }),
      );
    } catch (error) {
      setReport(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo generar el informe.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, props.businessCenterId, props.organizationId, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthCells = useMemo(() => buildMonthCells(pickerMonth), [pickerMonth]);
  const canGoNextPickerMonth = pickerMonth < today.slice(0, 7);

  function openPicker(field: DateField): void {
    const current = field === 'from' ? fromDate : toDate;
    setPickerMonth(current.slice(0, 7));
    setPickerField(field);
  }

  function applyPickedDate(date: string): void {
    if (!pickerField) {
      return;
    }

    let nextFrom = fromDate;
    let nextTo = toDate;
    if (pickerField === 'from') {
      nextFrom = date;
      if (nextFrom > nextTo) {
        nextTo = nextFrom;
      }
      if (exceedsThreeMonthSpan(nextFrom, nextTo)) {
        Alert.alert('Rango inválido', 'Entre desde y hasta no puede haber más de 3 meses.');
        return;
      }
      setFromDate(nextFrom);
      setToDate(nextTo);
    } else {
      nextTo = date;
      if (nextTo < nextFrom) {
        nextFrom = nextTo;
      }
      if (exceedsThreeMonthSpan(nextFrom, nextTo)) {
        Alert.alert('Rango inválido', 'Entre desde y hasta no puede haber más de 3 meses.');
        return;
      }
      setFromDate(nextFrom);
      setToDate(nextTo);
    }
    setPickerField(null);
  }

  const sharePdf = async () => {
    if (!report) {
      return;
    }

    const bodyRows = report.days
      .flatMap((day) => {
        const summary = `<tr>
          <td><strong>${escapeHtml(formatCashDateLong(day.entryDate))}</strong></td>
          <td></td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.ingresosCents))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.egresosCents))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(day.saldoFinalCents))}</td>
        </tr>`;
        const entryRows = (day.entries ?? []).map((entry) => {
          const signed =
            entry.entryType === 'egreso' ? -entry.amountCents : entry.amountCents;
          return `<tr>
            <td></td>
            <td>${escapeHtml(entryConcept(entry))}</td>
            <td style="text-align:right">${entry.entryType === 'ingreso' ? escapeHtml(formatCurrency(entry.amountCents)) : ''}</td>
            <td style="text-align:right">${entry.entryType === 'egreso' ? escapeHtml(formatCurrency(entry.amountCents)) : ''}</td>
            <td style="text-align:right">${escapeHtml(formatCashMovementAmount(signed))}</td>
          </tr>`;
        });
        return [summary, ...entryRows];
      })
      .join('');

    const center = props.businessCenterName ? escapeHtml(props.businessCenterName) : 'Sucursal';
    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #101935; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #7b86a0; font-size: 13px; margin: 2px 0; }
        .summary { margin: 16px 0; }
        .summary div { margin: 4px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        td, th { border-bottom: 1px solid #e4ebef; padding: 8px 4px; font-size: 12px; text-align: left; }
      </style></head><body>
        <h1>Informe · Movimientos</h1>
        <p class="meta">${center}</p>
        <p class="meta">Desde ${escapeHtml(formatCashDateShort(report.fromDate))} hasta ${escapeHtml(formatCashDateShort(report.toDate))}</p>
        <div class="summary">
          <div><strong>Saldo inicial:</strong> ${escapeHtml(formatCurrency(report.openingCents))}</div>
          <div><strong>Ingresos del período:</strong> ${escapeHtml(formatCurrency(report.ingresosCents))}</div>
          <div><strong>Egresos del período:</strong> ${escapeHtml(formatCurrency(report.egresosCents))}</div>
          <div><strong>Saldo final:</strong> ${escapeHtml(formatCurrency(report.closingCents))}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th style="text-align:right">Ingresos</th>
              <th style="text-align:right">Egresos</th>
              <th style="text-align:right">Saldo</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body></html>`;

    await shareHtmlAsPdf({
      fileName: `informe-movimientos-${report.fromDate}_${report.toDate}.pdf`,
      html,
      shareTitle: 'Informe · Movimientos',
    });
  };

  const shareExcel = async () => {
    if (!report) {
      return;
    }
    const header = 'Fecha;Concepto;Ingresos;Egresos;Saldo';
    const lines: string[] = [];
    for (const day of report.days) {
      lines.push(
        `${day.entryDate};;${(day.ingresosCents / 100).toFixed(2)};${(day.egresosCents / 100).toFixed(2)};${(day.saldoFinalCents / 100).toFixed(2)}`,
      );
      for (const entry of day.entries ?? []) {
        const ingreso =
          entry.entryType === 'ingreso' ? (entry.amountCents / 100).toFixed(2) : '';
        const egreso =
          entry.entryType === 'egreso' ? (entry.amountCents / 100).toFixed(2) : '';
        const signed =
          entry.entryType === 'egreso' ? -entry.amountCents / 100 : entry.amountCents / 100;
        lines.push(
          `;${entryConcept(entry).replaceAll(';', ',')};${ingreso};${egreso};${signed.toFixed(2)}`,
        );
      }
    }
    const summary = [
      'Resumen;;;;',
      `Saldo inicial;${(report.openingCents / 100).toFixed(2)};;;`,
      `Ingresos;${(report.ingresosCents / 100).toFixed(2)};;;`,
      `Egresos;${(report.egresosCents / 100).toFixed(2)};;;`,
      `Saldo final;${(report.closingCents / 100).toFixed(2)};;;`,
    ];
    const csv = `\uFEFF${summary.join('\n')}\n\n${header}\n${lines.join('\n')}`;
    const fileName = `informe-movimientos-${report.fromDate}_${report.toDate}.csv`;
    const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!cacheDir) {
      Alert.alert('No se pudo exportar', 'No hay carpeta temporal disponible.');
      return;
    }
    const fileUri = `${cacheDir}${fileName}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Exportar informe (Excel)',
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
    <ScreenContent disableScroll>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => onScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <View style={styles.headerRow}>
          <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.flex}>
            <ScreenTitle
              onBack={props.onBack}
              stickyTitle="Movimiento"
              title="Informe · Movimientos"
            />
            {props.businessCenterName ? (
              <Text style={styles.subtitle}>{props.businessCenterName}</Text>
            ) : null}
          </View>
        </View>

        <Card style={styles.filtersCard}>
          <Text style={styles.fieldLabel}>Desde</Text>
          <Pressable onPress={() => openPicker('from')} style={styles.dateField}>
            <Text style={styles.dateFieldText}>{formatCashDateShort(fromDate)}</Text>
            <Icon color={colors.textMuted} kind="calendar" size={20} strokeWidth={1.8} />
          </Pressable>
          <Text style={styles.fieldLabel}>Hasta</Text>
          <Pressable onPress={() => openPicker('to')} style={styles.dateField}>
            <Text style={styles.dateFieldText}>{formatCashDateShort(toDate)}</Text>
            <Icon color={colors.textMuted} kind="calendar" size={20} strokeWidth={1.8} />
          </Pressable>

          {pickerField ? (
            <View style={styles.inlineCalendar}>
              <View style={styles.calendarMonthRow}>
                <Pressable
                  onPress={() => setPickerMonth((current) => shiftMonth(current, -1))}
                  style={styles.calendarMonthButton}
                >
                  <Text style={styles.navChevron}>‹</Text>
                </Pressable>
                <Text style={styles.calendarMonthLabel}>{formatMonthLabel(pickerMonth)}</Text>
                <Pressable
                  disabled={!canGoNextPickerMonth}
                  onPress={() => {
                    if (!canGoNextPickerMonth) {
                      return;
                    }
                    setPickerMonth((current) => shiftMonth(current, 1));
                  }}
                  style={[
                    styles.calendarMonthButton,
                    !canGoNextPickerMonth ? styles.disabled : null,
                  ]}
                >
                  <Text style={styles.navChevron}>›</Text>
                </Pressable>
              </View>
              <View style={styles.weekdayRow}>
                {CASH_WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {monthCells.map((cell, index) => {
                  if (!cell.date || cell.day == null) {
                    return <View key={`empty-${index}`} style={styles.calendarCell} />;
                  }
                  const selected =
                    cell.date === (pickerField === 'from' ? fromDate : toDate);
                  const isFuture = cell.date > today;
                  return (
                    <Pressable
                      disabled={isFuture}
                      key={cell.date}
                      onPress={() => applyPickedDate(cell.date!)}
                      style={[
                        styles.calendarCell,
                        selected ? styles.calendarCellSelected : null,
                        isFuture ? styles.disabled : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isFuture ? styles.mutedText : styles.primaryText,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => setPickerField(null)} style={styles.closePicker}>
                <Text style={styles.closePickerText}>Cerrar calendario</Text>
              </Pressable>
            </View>
          ) : null}

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

            <CashMovementsSectionTitle embedded>Movimientos</CashMovementsSectionTitle>
            {report.days.some((day) => (day.entries ?? []).length > 0) ? (
              report.days.map((day) => (
                <DayMovementsBlock key={day.entryDate} day={day} />
              ))
            ) : (
              <CashMovementsEmpty embedded />
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenContent>
  );
}

function DayMovementsBlock(props: { day: CashRangeDay }): ReactElement | null {
  const entries = props.day.entries ?? [];
  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.dayBlock}>
      <CashMovementDateHeader date={props.day.entryDate} embedded />
      {entries.map((entry) => (
        <CashMovementRow embedded entry={entry} key={entry.id} />
      ))}
    </View>
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
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
  },
  calendarCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: 'center',
    padding: 2,
    width: `${100 / 7}%`,
  },
  calendarCellSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarMonthButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  calendarMonthLabel: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  calendarMonthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  closePicker: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  closePickerText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  dateField: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateFieldText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dayBlock: {
    marginBottom: 4,
  },
  disabled: {
    opacity: 0.35,
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
    marginHorizontal: -4,
  },
  inlineCalendar: {
    marginTop: 12,
  },
  loader: {
    marginTop: 24,
  },
  mutedText: {
    color: colors.textMuted,
  },
  navChevron: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  primaryText: {
    color: colors.textPrimary,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.badgeNeutralBg,
    borderRadius: 10,
    marginTop: 12,
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  weekdayLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
});
