import { useMemo, type ReactElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatCurrency } from '../lib/sellCart';
import {
  computePurchaseTotals,
  normalizeIvaRatePercent,
  IVA_RATE_OPTIONS,
  type AdjustmentKind,
  type AdjustmentMode,
  type IvaRatePercent,
} from '../lib/purchaseTotals';
import { colors, radius } from '../theme';

export interface PurchaseTotalsDraft {
  adjustmentKind: AdjustmentKind | null;
  adjustmentMode: AdjustmentMode | null;
  adjustmentValue: number;
  ivaEnabled: boolean;
  ivaRatePercent: number;
  lineSubtotalCents: number;
}

export interface PurchaseTotalsHandlers {
  onAdjustmentKindChange?: (value: AdjustmentKind | null) => void;
  onAdjustmentModeChange?: (value: AdjustmentMode) => void;
  onAdjustmentValueChange?: (value: number) => void;
  onIvaEnabledChange?: (value: boolean) => void;
  onIvaRateChange?: (value: IvaRatePercent) => void;
}

export function formatAdjustmentInputValue(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return '';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(value).replace('.', ',');
}

function parseAdjustmentInput(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) {
    return 0;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

export function PurchaseTotalsBlock(
  props: PurchaseTotalsDraft & PurchaseTotalsHandlers & { readOnly?: boolean },
): ReactElement {
  const readOnly = props.readOnly === true;
  const totals = useMemo(
    () =>
      computePurchaseTotals({
        adjustmentKind: props.adjustmentKind,
        adjustmentMode: props.adjustmentMode,
        adjustmentValue: props.adjustmentValue,
        ivaEnabled: props.ivaEnabled,
        ivaRatePercent: props.ivaRatePercent,
        lineSubtotalCents: props.lineSubtotalCents,
      }),
    [
      props.adjustmentKind,
      props.adjustmentMode,
      props.adjustmentValue,
      props.ivaEnabled,
      props.ivaRatePercent,
      props.lineSubtotalCents,
    ],
  );

  const adjustmentActive = props.adjustmentKind != null && props.adjustmentMode != null;
  const adjustmentSign = totals.adjustmentCents < 0 ? '−' : totals.adjustmentCents > 0 ? '+' : '';
  const adjustmentAbsCents = Math.abs(totals.adjustmentCents);
  const rate = normalizeIvaRatePercent(props.ivaRatePercent);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Subtotal</Text>
        <Text style={styles.rowValue}>{formatCurrency(props.lineSubtotalCents)}</Text>
      </View>

      <View style={styles.adjustmentBlock}>
        <View style={styles.adjustmentHeader}>
          <Text style={styles.rowLabel}>Ajuste</Text>
          {adjustmentActive ? (
            <Text style={styles.rowValue}>
              {adjustmentSign}
              {formatCurrency(adjustmentAbsCents)}
            </Text>
          ) : (
            <Text style={styles.rowMuted}>Sin ajuste</Text>
          )}
        </View>

        {readOnly ? null : (
          <>
            <View style={styles.segmentedRow}>
              <SegmentButton
                active={props.adjustmentKind === 'discount'}
                label="Descuento"
                onPress={() =>
                  props.onAdjustmentKindChange?.(
                    props.adjustmentKind === 'discount' ? null : 'discount',
                  )
                }
              />
              <SegmentButton
                active={props.adjustmentKind === 'surcharge'}
                label="Recargo"
                onPress={() =>
                  props.onAdjustmentKindChange?.(
                    props.adjustmentKind === 'surcharge' ? null : 'surcharge',
                  )
                }
              />
            </View>

            {props.adjustmentKind ? (
              <View style={styles.adjustmentInputsRow}>
                <View style={styles.modeToggle}>
                  <Pressable
                    onPress={() => props.onAdjustmentModeChange?.('percent')}
                    style={[
                      styles.modeToggleOption,
                      props.adjustmentMode === 'percent' && styles.modeToggleOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        props.adjustmentMode === 'percent' && styles.modeToggleTextActive,
                      ]}
                    >
                      %
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => props.onAdjustmentModeChange?.('fixed')}
                    style={[
                      styles.modeToggleOption,
                      props.adjustmentMode === 'fixed' && styles.modeToggleOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        props.adjustmentMode === 'fixed' && styles.modeToggleTextActive,
                      ]}
                    >
                      $
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.adjustmentInputBox}>
                  {props.adjustmentMode === 'fixed' ? (
                    <Text style={styles.adjustmentPrefix}>$</Text>
                  ) : null}
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      props.onAdjustmentValueChange?.(parseAdjustmentInput(value))
                    }
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.adjustmentInput,
                      Platform.OS === 'web' && styles.webNoOutline,
                    ]}
                    value={formatAdjustmentInputValue(props.adjustmentValue)}
                  />
                  {props.adjustmentMode === 'percent' ? (
                    <Text style={styles.adjustmentSuffix}>%</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.ivaBlock}>
        <Pressable
          disabled={readOnly}
          onPress={() => props.onIvaEnabledChange?.(!props.ivaEnabled)}
          style={styles.ivaToggleRow}
        >
          <View
            style={[styles.checkbox, props.ivaEnabled && styles.checkboxChecked]}
          >
            {props.ivaEnabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.ivaToggleLabel}>Aplicar IVA</Text>
        </Pressable>

        {props.ivaEnabled ? (
          <>
            <View style={styles.ivaRateRow}>
              {IVA_RATE_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  disabled={readOnly}
                  onPress={() => props.onIvaRateChange?.(option)}
                  style={[
                    styles.ivaRateChip,
                    option === rate && styles.ivaRateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.ivaRateChipText,
                      option === rate && styles.ivaRateChipTextActive,
                    ]}
                  >
                    {option}%
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>IVA ({rate}%)</Text>
              <Text style={styles.rowValue}>{formatCurrency(totals.ivaCents)}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(totals.totalCents)}</Text>
      </View>
    </View>
  );
}

function SegmentButton(props: { active?: boolean; label: string; onPress?: () => void }): ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.segmentButton, props.active && styles.segmentButtonActive]}
    >
      <Text
        style={[styles.segmentButtonText, props.active && styles.segmentButtonTextActive]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: colors.slate,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  rowMuted: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '400',
  },
  rowValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  adjustmentBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  adjustmentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentedRow: {
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flex: 1,
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  segmentButtonText: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: colors.primary,
  },
  adjustmentInputsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  modeToggle: {
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  modeToggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeToggleOptionActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '600',
  },
  modeToggleTextActive: {
    color: colors.surface,
  },
  adjustmentInputBox: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  adjustmentInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 0,
    paddingVertical: 6,
    textAlign: 'right',
  },
  adjustmentPrefix: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '600',
  },
  adjustmentSuffix: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: '600',
  },
  webNoOutline: {
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  ivaBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 12,
  },
  ivaToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ivaToggleLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  ivaRateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ivaRateChip: {
    alignItems: 'center',
    borderColor: colors.borderInput,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ivaRateChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  ivaRateChipText: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
  ivaRateChipTextActive: {
    color: colors.primary,
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  totalLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
