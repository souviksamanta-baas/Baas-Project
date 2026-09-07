import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createCashManualEntry,
  deleteCashManualEntry,
  getCashDay,
  getCashRangeReport,
  rangeDayToBalances,
  updateCashManualEntry,
  type CashDayBalances,
  type CashEntryType,
  type CashLedgerEntry,
  type CashRangeDay,
} from '../api/cash';
import { Card, ScreenContent, ScreenTitle, useHeaderCollapseOnScroll } from '../components/ui';
import { Icon } from '../components/icons';
import {
  CashMovementDateHeader,
  CashMovementRow,
  CashMovementsEmpty,
  CashMovementsSectionTitle,
} from '../components/CashMovementsList';
import { formatCurrency } from '../lib/sellCart';
import { todayIsoDate } from '../lib/cashPostings';
import {
  buildMonthCells,
  cashDayTone,
  CASH_WEEKDAY_LABELS,
  formatCashDateShort,
  formatMonthLabel,
  monthBounds,
  shiftIsoDate,
  shiftMonth,
  type CashDayTone,
} from '../lib/cashUi';
import { colors } from '../theme';

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

function tonesFromRangeDays(
  days: CashRangeDay[],
  yyyyMm: string,
  today: string,
): Record<string, CashDayTone> {
  const { fromDate, toDate } = monthBounds(yyyyMm);
  const end = toDate < today ? toDate : today;
  const byDate = new Map(days.map((day) => [day.entryDate, day]));
  const next: Record<string, CashDayTone> = {};
  let cursor = fromDate;
  while (cursor <= end) {
    const row = byDate.get(cursor);
    next[cursor] = cashDayTone(row?.ingresosCents ?? 0, row?.egresosCents ?? 0);
    cursor = shiftIsoDate(cursor, 1);
  }
  return next;
}

const MAX_MOVEMENT_DAYS = 30;
const MOVEMENT_PAGE_DAYS = 7;

type MovementListItem =
  | { kind: 'date'; date: string }
  | { kind: 'entry'; entry: CashLedgerEntry };

export function CashScreen(props: {
  businessCenterId: string;
  businessCenterName?: string | null;
  onBack: () => void;
  onOpenReports: () => void;
  organizationId: string;
  timezone?: string | null;
}): ReactElement {
  const onScrollOffset = useHeaderCollapseOnScroll();
  const today = todayIsoDate(props.timezone);
  const [entryDate, setEntryDate] = useState(today);
  const [day, setDay] = useState<CashDayBalances | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => today.slice(0, 7));
  const [dayTones, setDayTones] = useState<Record<string, CashDayTone>>({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [movementDays, setMovementDays] = useState(MOVEMENT_PAGE_DAYS);
  const [recentDays, setRecentDays] = useState<CashRangeDay[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CashLedgerEntry | null>(null);
  const [draftType, setDraftType] = useState<CashEntryType>('ingreso');
  const [draftConcept, setDraftConcept] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const daysByDateRef = useRef<Map<string, CashRangeDay>>(new Map());
  const tonesCacheRef = useRef<Record<string, Record<string, CashDayTone>>>({});
  const loadGenRef = useRef(0);
  const bootstrappedRef = useRef(false);

  const applyRangeDays = useCallback((days: CashRangeDay[]) => {
    const map = daysByDateRef.current;
    for (const row of days) {
      map.set(row.entryDate, row);
    }
  }, []);

  const sliceRecent = useCallback(
    (dayCount: number): CashRangeDay[] => {
      const fromDate = shiftIsoDate(today, -(dayCount - 1));
      const rows: CashRangeDay[] = [];
      let cursor = today;
      while (cursor >= fromDate) {
        const cached = daysByDateRef.current.get(cursor);
        if (cached && (cached.entries?.length ?? 0) > 0) {
          rows.push(cached);
        }
        cursor = shiftIsoDate(cursor, -1);
      }
      return rows;
    },
    [today],
  );

  const setDayFromCacheOrNull = useCallback(
    (date: string): boolean => {
      const cached = daysByDateRef.current.get(date);
      if (!cached) {
        return false;
      }
      setDay(
        rangeDayToBalances(cached, {
          businessCenterId: props.businessCenterId,
          organizationId: props.organizationId,
        }),
      );
      return true;
    },
    [props.businessCenterId, props.organizationId],
  );

  /** One /cash/report for the rolling window used by Caja. */
  const loadWindow = useCallback(
    async (dayCount: number): Promise<void> => {
      const fromDate = shiftIsoDate(today, -(dayCount - 1));
      const report = await getCashRangeReport({
        businessCenterId: props.businessCenterId,
        fromDate,
        organizationId: props.organizationId,
        toDate: today,
      });
      applyRangeDays(report.days);
    },
    [applyRangeDays, props.businessCenterId, props.organizationId, today],
  );

  const loadSelectedDay = useCallback(
    async (date: string): Promise<void> => {
      if (setDayFromCacheOrNull(date)) {
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      const gen = ++loadGenRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const detail = await getCashDay({
          businessCenterId: props.businessCenterId,
          entryDate: date,
          organizationId: props.organizationId,
        });
        if (gen !== loadGenRef.current) {
          return;
        }
        setDay(detail);
        applyRangeDays([
          {
            egresosCents: detail.egresosCents,
            entries: detail.entries ?? [],
            entryDate: detail.entryDate,
            ingresosCents: detail.ingresosCents,
            saldoFinalCents: detail.saldoFinalCents,
            saldoInicialCents: detail.saldoInicialCents,
          },
        ]);
      } catch (error) {
        if (gen !== loadGenRef.current) {
          return;
        }
        setDay(null);
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudo cargar la caja del día.',
        );
      } finally {
        if (gen === loadGenRef.current) {
          setIsLoading(false);
        }
      }
    },
    [applyRangeDays, props.businessCenterId, props.organizationId, setDayFromCacheOrNull],
  );

  // Initial load: a single range report covers balances + últimos movimientos.
  useEffect(() => {
    const gen = ++loadGenRef.current;
    let cancelled = false;
    bootstrappedRef.current = false;

    async function bootstrap(): Promise<void> {
      setIsLoading(true);
      setRecentLoading(true);
      setErrorMessage(null);
      daysByDateRef.current = new Map();
      tonesCacheRef.current = {};

      try {
        await loadWindow(MAX_MOVEMENT_DAYS);
        if (cancelled || gen !== loadGenRef.current) {
          return;
        }

        setRecentDays(sliceRecent(movementDays));
        if (!setDayFromCacheOrNull(entryDate)) {
          const detail = await getCashDay({
            businessCenterId: props.businessCenterId,
            entryDate,
            organizationId: props.organizationId,
          });
          if (cancelled || gen !== loadGenRef.current) {
            return;
          }
          setDay(detail);
          applyRangeDays([
            {
              egresosCents: detail.egresosCents,
              entries: detail.entries ?? [],
              entryDate: detail.entryDate,
              ingresosCents: detail.ingresosCents,
              saldoFinalCents: detail.saldoFinalCents,
              saldoInicialCents: detail.saldoInicialCents,
            },
          ]);
        }
        bootstrappedRef.current = true;
      } catch (error) {
        if (cancelled || gen !== loadGenRef.current) {
          return;
        }
        setDay(null);
        setRecentDays([]);
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudo cargar la caja.',
        );
        bootstrappedRef.current = true;
      } finally {
        if (!cancelled && gen === loadGenRef.current) {
          setIsLoading(false);
          setRecentLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // Intentionally only when org/center/today change — date changes use selectDate path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.businessCenterId, props.organizationId, today]);

  // Selected date changes after bootstrap (arrows / calendar).
  useEffect(() => {
    if (!bootstrappedRef.current) {
      return;
    }
    void loadSelectedDay(entryDate);
  }, [entryDate, loadSelectedDay]);

  // "Ver más" only re-slices the already-loaded 30-day window.
  useEffect(() => {
    if (!bootstrappedRef.current) {
      return;
    }
    setRecentDays(sliceRecent(movementDays));
  }, [movementDays, sliceRecent]);

  const loadMonthTones = useCallback(
    async (yyyyMm: string): Promise<void> => {
      const cached = tonesCacheRef.current[yyyyMm];
      if (cached) {
        setDayTones(cached);
        return;
      }

      const { fromDate, toDate } = monthBounds(yyyyMm);
      const end = toDate < today ? toDate : today;
      if (fromDate > end) {
        tonesCacheRef.current[yyyyMm] = {};
        setDayTones({});
        return;
      }

      let missing = false;
      let cursor = fromDate;
      while (cursor <= end) {
        if (!daysByDateRef.current.has(cursor)) {
          missing = true;
          break;
        }
        cursor = shiftIsoDate(cursor, 1);
      }

      if (!missing) {
        const localDays: CashRangeDay[] = [];
        cursor = fromDate;
        while (cursor <= end) {
          localDays.push(daysByDateRef.current.get(cursor)!);
          cursor = shiftIsoDate(cursor, 1);
        }
        const tones = tonesFromRangeDays(localDays, yyyyMm, today);
        tonesCacheRef.current[yyyyMm] = tones;
        setDayTones(tones);
        return;
      }

      setMonthLoading(true);
      try {
        const report = await getCashRangeReport({
          businessCenterId: props.businessCenterId,
          fromDate,
          organizationId: props.organizationId,
          toDate: end,
        });
        applyRangeDays(report.days);
        const tones = tonesFromRangeDays(report.days, yyyyMm, today);
        tonesCacheRef.current[yyyyMm] = tones;
        setDayTones(tones);
        setRecentDays(sliceRecent(movementDays));
      } catch {
        setDayTones({});
      } finally {
        setMonthLoading(false);
      }
    },
    [
      applyRangeDays,
      movementDays,
      props.businessCenterId,
      props.organizationId,
      sliceRecent,
      today,
    ],
  );

  useEffect(() => {
    if (!calendarOpen) {
      return;
    }
    void loadMonthTones(calendarMonth);
  }, [calendarOpen, calendarMonth, loadMonthTones]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setRecentLoading(true);
    setErrorMessage(null);
    tonesCacheRef.current = {};
    try {
      await loadWindow(MAX_MOVEMENT_DAYS);
      setRecentDays(sliceRecent(movementDays));
      if (!setDayFromCacheOrNull(entryDate)) {
        const detail = await getCashDay({
          businessCenterId: props.businessCenterId,
          entryDate,
          organizationId: props.organizationId,
        });
        setDay(detail);
      }
      if (calendarOpen) {
        delete tonesCacheRef.current[calendarMonth];
        await loadMonthTones(calendarMonth);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo actualizar la caja.',
      );
    } finally {
      setIsLoading(false);
      setRecentLoading(false);
    }
  }, [
    calendarMonth,
    calendarOpen,
    entryDate,
    loadMonthTones,
    loadWindow,
    movementDays,
    props.businessCenterId,
    props.organizationId,
    setDayFromCacheOrNull,
    sliceRecent,
  ]);

  const openCreate = (type: CashEntryType) => {
    setEditing(null);
    setDraftType(type);
    setDraftConcept('');
    setDraftAmount('');
    setEditorOpen(true);
  };

  const openEdit = (entry: CashLedgerEntry) => {
    if (entry.source !== 'manual') {
      return;
    }
    setEditing(entry);
    setDraftType(entry.entryType);
    setDraftConcept(entry.concept);
    setDraftAmount((entry.amountCents / 100).toLocaleString('es-AR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      useGrouping: false,
    }));
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    const amountCents = parseAmountToCents(draftAmount);
    const concept = draftConcept.trim();
    if (!amountCents) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero.');
      return;
    }
    if (!concept) {
      Alert.alert('Concepto', 'Ingresá un concepto para el movimiento.');
      return;
    }

    setIsSaving(true);
    try {
      if (editing) {
        await updateCashManualEntry({
          amountCents,
          concept,
          entryId: editing.id,
          entryType: draftType,
          organizationId: props.organizationId,
        });
      } else {
        await createCashManualEntry({
          amountCents,
          businessCenterId: props.businessCenterId,
          concept,
          entryDate,
          entryType: draftType,
          organizationId: props.organizationId,
        });
      }
      setEditorOpen(false);
      await refreshAll();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (entry: CashLedgerEntry) => {
    if (entry.source !== 'manual') {
      return;
    }
    Alert.alert('Eliminar movimiento', '¿Querés eliminar este movimiento manual?', [
      { style: 'cancel', text: 'Cancelar' },
      {
        style: 'destructive',
        text: 'Eliminar',
        onPress: () => {
          void (async () => {
            try {
              await deleteCashManualEntry({
                entryId: entry.id,
                organizationId: props.organizationId,
              });
              await refreshAll();
            } catch (error) {
              Alert.alert(
                'No se pudo eliminar',
                error instanceof Error ? error.message : 'Error desconocido',
              );
            }
          })();
        },
      },
    ]);
  };

  const subtitle = useMemo(() => props.businessCenterName ?? null, [props.businessCenterName]);
  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const canGoNextMonth = calendarMonth < today.slice(0, 7);
  const canShowMore = movementDays < MAX_MOVEMENT_DAYS;

  const movementItems = useMemo((): MovementListItem[] => {
    const items: MovementListItem[] = [];
    for (const dayRow of recentDays) {
      const entries = dayRow.entries ?? [];
      if (entries.length === 0) {
        continue;
      }
      items.push({ date: dayRow.entryDate, kind: 'date' });
      for (const entry of [...entries].reverse()) {
        items.push({ entry, kind: 'entry' });
      }
    }
    return items;
  }, [recentDays]);

  function toggleCalendar(): void {
    setCalendarOpen((open) => {
      const next = !open;
      if (next) {
        setCalendarMonth(entryDate.slice(0, 7));
      }
      return next;
    });
  }

  function selectCalendarDate(date: string): void {
    setEntryDate(date);
    setCalendarOpen(false);
  }

  const listHeader = (
    <>
      <View style={styles.headerRow}>
        <Pressable hitSlop={8} onPress={props.onBack} style={styles.backPressable}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScreenTitle onBack={props.onBack} title="Caja" />
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.dayNav}>
        <Pressable
          accessibilityLabel="Día anterior"
          onPress={() => {
            setCalendarOpen(false);
            setEntryDate((current) => shiftIsoDate(current, -1));
          }}
          style={styles.dayNavButton}
        >
          <Text style={styles.dayNavButtonText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Elegir fecha"
          accessibilityRole="button"
          onPress={toggleCalendar}
          style={styles.dayNavCenter}
        >
          <Text style={styles.dayNavLabel}>{formatCashDateShort(entryDate)}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Día siguiente"
          disabled={entryDate >= today}
          onPress={() => {
            if (entryDate >= today) {
              return;
            }
            setCalendarOpen(false);
            setEntryDate((current) => {
              const next = shiftIsoDate(current, 1);
              return next > today ? today : next;
            });
          }}
          style={[styles.dayNavButton, entryDate >= today ? styles.dayNavButtonDisabled : null]}
        >
          <Text style={styles.dayNavButtonText}>›</Text>
        </Pressable>
      </View>

      {calendarOpen ? (
        <Card style={styles.calendarCard}>
          <View style={styles.calendarMonthRow}>
            <Pressable
              accessibilityLabel="Mes anterior"
              onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))}
              style={styles.calendarMonthButton}
            >
              <Text style={styles.dayNavButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{formatMonthLabel(calendarMonth)}</Text>
            <Pressable
              accessibilityLabel="Mes siguiente"
              disabled={!canGoNextMonth}
              onPress={() => {
                if (!canGoNextMonth) {
                  return;
                }
                setCalendarMonth((current) => shiftMonth(current, 1));
              }}
              style={[
                styles.calendarMonthButton,
                !canGoNextMonth ? styles.dayNavButtonDisabled : null,
              ]}
            >
              <Text style={styles.dayNavButtonText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {CASH_WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {monthLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.calendarLoader} />
          ) : (
            <View style={styles.calendarGrid}>
              {monthCells.map((cell, index) => {
                if (!cell.date || cell.day == null) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />;
                }

                const selected = cell.date === entryDate;
                const isFuture = cell.date > today;
                const isToday = cell.date === today;
                const tone = dayTones[cell.date];
                const toneStyle =
                  tone === 'green'
                    ? styles.calendarCellGreen
                    : tone === 'red'
                      ? styles.calendarCellRed
                      : tone === 'grey'
                        ? styles.calendarCellGrey
                        : null;
                const textStyle =
                  tone === 'green'
                    ? styles.calendarDayGreen
                    : tone === 'red'
                      ? styles.calendarDayRed
                      : tone === 'grey'
                        ? styles.calendarDayGrey
                        : isFuture
                          ? styles.calendarDayMuted
                          : styles.calendarDayDefault;

                return (
                  <Pressable
                    disabled={isFuture}
                    key={cell.date}
                    onPress={() => selectCalendarDate(cell.date!)}
                    style={[
                      styles.calendarCell,
                      toneStyle,
                      selected ? styles.calendarCellSelected : null,
                      isToday && !selected ? styles.calendarCellToday : null,
                      isFuture ? styles.calendarCellDisabled : null,
                    ]}
                  >
                    <Text style={[styles.calendarDayText, textStyle]}>{cell.day}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.calendarCellGreen]} />
              <Text style={styles.legendText}>Saldo positivo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.calendarCellRed]} />
              <Text style={styles.legendText}>Saldo negativo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.calendarCellGrey]} />
              <Text style={styles.legendText}>Saldo cero</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={() => void refreshAll()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Card>
      ) : day ? (
        <>
          <View style={styles.balancesRow}>
            <Card style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo inicial</Text>
              <Text style={styles.balanceValue}>{formatCurrency(day.saldoInicialCents)}</Text>
            </Card>
            <Card style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo final</Text>
              <Text style={styles.balanceValue}>{formatCurrency(day.saldoFinalCents)}</Text>
            </Card>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityLabel="Nuevo ingreso"
              onPress={() => openCreate('ingreso')}
              style={styles.ingresoButton}
            >
              <Text style={styles.actionButtonText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Nuevo egreso"
              onPress={() => openCreate('egreso')}
              style={styles.egresoButton}
            >
              <Text style={styles.actionButtonText}>−</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Informe de movimientos"
              onPress={props.onOpenReports}
              style={styles.reportButton}
            >
              <Icon color="#fff" kind="document" size={22} strokeWidth={2} />
            </Pressable>
          </View>
        </>
      ) : null}

      <CashMovementsSectionTitle>Últimos movimientos</CashMovementsSectionTitle>
      {recentLoading && movementItems.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.recentLoader} />
      ) : null}
    </>
  );

  const listFooter = (
    <View style={styles.footerWrap}>
      {!recentLoading && movementItems.length === 0 ? (
        <CashMovementsEmpty />
      ) : null}
      {canShowMore ? (
        <Pressable
          onPress={() =>
            setMovementDays((current) => Math.min(MAX_MOVEMENT_DAYS, current + MOVEMENT_PAGE_DAYS))
          }
          style={styles.showMoreButton}
        >
          <Text style={styles.showMoreText}>
            {recentLoading ? 'Cargando…' : 'Ver más'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.showMoreCap}>Mostrando hasta 30 días</Text>
      )}
    </View>
  );

  return (
    <ScreenContent disableScroll title="Caja">
      <FlatList
        contentContainerStyle={styles.listContent}
        data={movementItems}
        keyExtractor={(item, index) =>
          item.kind === 'date' ? `date-${item.date}` : `entry-${item.entry.id}-${index}`
        }
        ListFooterComponent={listFooter}
        ListHeaderComponent={listHeader}
        onScroll={(event) => onScrollOffset(event.nativeEvent.contentOffset.y)}
        renderItem={({ item }) => {
          if (item.kind === 'date') {
            return <CashMovementDateHeader date={item.date} />;
          }

          const canEdit = item.entry.source === 'manual';
          return (
            <CashMovementRow
              disabled={!canEdit}
              entry={item.entry}
              onLongPress={() => confirmDelete(item.entry)}
              onPress={() => openEdit(item.entry)}
            />
          );
        }}
        scrollEventThrottle={16}
      />

      <Modal animationType="slide" transparent visible={editorOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing
                ? 'Editar movimiento'
                : draftType === 'ingreso'
                  ? 'Nuevo ingreso'
                  : 'Nuevo egreso'}
            </Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setDraftType('ingreso')}
                style={[styles.typeChip, draftType === 'ingreso' && styles.typeChipActiveIngreso]}
              >
                <Text style={styles.typeChipText}>Ingreso</Text>
              </Pressable>
              <Pressable
                onPress={() => setDraftType('egreso')}
                style={[styles.typeChip, draftType === 'egreso' && styles.typeChipActiveEgreso]}
              >
                <Text style={styles.typeChipText}>Egreso</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Concepto</Text>
            <TextInput
              onChangeText={setDraftConcept}
              placeholder="Ej. Ajuste de caja"
              style={styles.input}
              value={draftConcept}
            />
            <Text style={styles.fieldLabel}>Monto</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setDraftAmount}
              placeholder="0"
              style={styles.input}
              value={draftAmount}
            />
            <View style={styles.modalActions}>
              <Pressable
                disabled={isSaving}
                onPress={() => setEditorOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={() => void saveEditor()}
                style={styles.modalPrimary}
              >
                <Text style={styles.modalPrimaryText}>{isSaving ? 'Guardando…' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  actionButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
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
  balanceCard: {
    flex: 1,
    padding: 12,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  balancesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  calendarCard: {
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  calendarCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: 'center',
    padding: 2,
    width: `${100 / 7}%`,
  },
  calendarCellDisabled: {
    opacity: 0.45,
  },
  calendarCellGreen: {
    backgroundColor: colors.badgeGreenBg,
  },
  calendarCellGrey: {
    backgroundColor: colors.badgeNeutralBg,
  },
  calendarCellRed: {
    backgroundColor: colors.badgeRedBg,
  },
  calendarCellSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  calendarCellToday: {
    borderColor: colors.navy,
    borderWidth: 1,
  },
  calendarDayDefault: {
    color: colors.textPrimary,
  },
  calendarDayGreen: {
    color: '#027a48',
    fontWeight: '700',
  },
  calendarDayGrey: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  calendarDayMuted: {
    color: colors.textMuted,
  },
  calendarDayRed: {
    color: '#b42318',
    fontWeight: '700',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  calendarLoader: {
    marginVertical: 24,
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
  dayNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  dayNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayNavButtonDisabled: {
    opacity: 0.35,
  },
  dayNavButtonText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  dayNavCenter: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dayNavLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  egresoButton: {
    alignItems: 'center',
    backgroundColor: '#b42318',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
  },
  emptyCard: {
    marginHorizontal: 16,
    padding: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    marginBottom: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  flex: {
    flex: 1,
  },
  footerWrap: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  ingresoButton: {
    alignItems: 'center',
    backgroundColor: '#027a48',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  legendDot: {
    borderRadius: 4,
    height: 12,
    width: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 120,
    paddingTop: 4,
  },
  loader: {
    marginTop: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalPrimary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondary: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  modalSecondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  recentLoader: {
    marginBottom: 12,
    marginTop: 8,
  },
  reportButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
  },
  showMoreCap: {
    color: colors.textMuted,
    fontSize: 12,
    marginHorizontal: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  showMoreText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: -4,
  },
  typeChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeChipActiveEgreso: {
    backgroundColor: '#fee4e2',
  },
  typeChipActiveIngreso: {
    backgroundColor: '#d1fadf',
  },
  typeChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
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
