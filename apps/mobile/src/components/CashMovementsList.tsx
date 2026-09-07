import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CashLedgerEntry } from '../api/cash';
import { colors, radius, shadows, spacing } from '../design-system';
import { formatCashDateLong, formatCashMovementAmount } from '../lib/cashUi';
import { Icon } from './icons';

function sourceLabel(entry: CashLedgerEntry): string {
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

function entryConcept(entry: CashLedgerEntry): string {
  const concept = entry.concept.trim();
  return concept || sourceLabel(entry);
}

function splitLongDate(isoDate: string): { day: string; rest: string } {
  const long = formatCashDateLong(isoDate);
  const match = /^(\d{1,2})\s+(.*)$/.exec(long.trim());
  if (!match) {
    return { day: '', rest: long };
  }
  return { day: match[1]!, rest: match[2]! };
}

export function CashMovementDateHeader(props: {
  date: string;
  /** When true, omit horizontal margins (parent already pads). */
  embedded?: boolean;
}): ReactElement {
  const { day, rest } = splitLongDate(props.date);
  return (
    <View style={[styles.dateHeader, props.embedded ? styles.noHorizontalMargin : null]}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeDay}>{day || '·'}</Text>
      </View>
      <View style={styles.dateTextCol}>
        <Text style={styles.dateRest}>{rest}</Text>
        <View style={styles.dateRule} />
      </View>
    </View>
  );
}

export function CashMovementRow(props: {
  disabled?: boolean;
  /** When true, omit horizontal margins (parent already pads). */
  embedded?: boolean;
  entry: CashLedgerEntry;
  onLongPress?: () => void;
  onPress?: () => void;
}): ReactElement {
  const isIngreso = props.entry.entryType === 'ingreso';
  const signed = isIngreso ? props.entry.amountCents : -props.entry.amountCents;
  const rowStyle = [
    styles.row,
    isIngreso ? styles.rowIngreso : styles.rowEgreso,
    props.embedded ? styles.noHorizontalMargin : null,
  ];

  const content = (
    <>
      <View style={[styles.typeMark, isIngreso ? styles.typeMarkIngreso : styles.typeMarkEgreso]}>
        <Text
          style={[
            styles.typeMarkText,
            isIngreso ? styles.typeMarkTextIngreso : styles.typeMarkTextEgreso,
          ]}
        >
          {isIngreso ? '+' : '−'}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={styles.concept}>
          {entryConcept(props.entry)}
        </Text>
        <Text style={styles.meta}>{sourceLabel(props.entry)}</Text>
      </View>
      <Text style={[styles.amount, isIngreso ? styles.amountIngreso : styles.amountEgreso]}>
        {formatCashMovementAmount(signed)}
      </Text>
    </>
  );

  if (props.onPress || props.onLongPress) {
    return (
      <Pressable
        disabled={props.disabled}
        onLongPress={props.onLongPress}
        onPress={props.onPress}
        style={({ pressed }) => [...rowStyle, pressed ? styles.rowPressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

export function CashMovementsEmpty(props: {
  embedded?: boolean;
  message?: string;
}): ReactElement {
  return (
    <View style={[styles.empty, props.embedded ? styles.noHorizontalMargin : null]}>
      <View style={styles.emptyIcon}>
        <Icon color={colors.textMuted} kind="cash" size={22} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>Sin movimientos</Text>
      <Text style={styles.emptyBody}>
        {props.message ?? 'Todavía no hay ingresos ni egresos en este período.'}
      </Text>
    </View>
  );
}

export function CashMovementsSectionTitle(props: {
  children: ReactNode;
  embedded?: boolean;
  trailing?: ReactNode;
}): ReactElement {
  return (
    <View style={[styles.sectionTitleRow, props.embedded ? styles.noHorizontalMargin : null]}>
      <Text style={styles.sectionTitle}>{props.children}</Text>
      {props.trailing}
    </View>
  );
}

const INGRESO = '#027a48';
const EGRESO = '#b42318';

const styles = StyleSheet.create({
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  amountEgreso: {
    color: EGRESO,
  },
  amountIngreso: {
    color: INGRESO,
  },
  concept: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  dateBadge: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 6,
  },
  dateBadgeDay: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  dateHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  dateRest: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateRule: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginTop: 6,
    width: '100%',
  },
  dateTextCol: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 28,
    ...shadows.card,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMint,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 44,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  noHorizontalMargin: {
    marginHorizontal: 0,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderLeftWidth: 4,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...shadows.card,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowEgreso: {
    borderLeftColor: EGRESO,
  },
  rowIngreso: {
    borderLeftColor: INGRESO,
  },
  rowPressed: {
    opacity: 0.92,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  typeMark: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 32,
  },
  typeMarkEgreso: {
    backgroundColor: colors.badgeRedBg,
  },
  typeMarkIngreso: {
    backgroundColor: colors.badgeGreenBg,
  },
  typeMarkText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  typeMarkTextEgreso: {
    color: EGRESO,
  },
  typeMarkTextIngreso: {
    color: INGRESO,
  },
});
