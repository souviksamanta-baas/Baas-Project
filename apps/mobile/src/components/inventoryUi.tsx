import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StockTone } from '../api/inventoryMockData';
import { colors, radius, shadows } from '../theme';
import { Icon } from './icons';

export function InventoryScreenTitle(props: {
  onBack?: () => void;
  showBack?: boolean;
  subtitle: string;
  title: string;
}): ReactElement {
  return (
    <View style={styles.titleRow}>
      {props.showBack !== false && props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.backButton}>
          <Icon color={colors.navy} kind="arrow-left" size={20} strokeWidth={2.2} />
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.pageTitle}>{props.title}</Text>
        <Text style={styles.pageSubtitle}>{props.subtitle}</Text>
      </View>
    </View>
  );
}

export function SearchFilterRow(): ReactElement {
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchInput}>
        <Icon color="#65708a" kind="inbox" size={14} strokeWidth={1.8} />
        <Text style={styles.searchPlaceholder}>Buscar por producto o categoria</Text>
      </View>
      <Pressable style={styles.cameraButton}>
        <Icon color={colors.primary} kind="box" size={18} strokeWidth={1.9} />
      </Pressable>
      <Pressable style={styles.filterButton}>
        <Icon color="#56627b" kind="filter" size={17} strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}

export function ProductThumb(): ReactElement {
  return (
    <View style={styles.thumb}>
      <Text style={styles.thumbBrand}>HARINA</Text>
      <Text style={styles.thumbSub}>DE TRIGO</Text>
      <Text style={styles.thumbQty}>100 kg</Text>
    </View>
  );
}

export function StockBadge(props: { label: string; tone?: StockTone | 'neutral' }): ReactElement {
  const toneStyle =
    props.tone === 'blue'
      ? styles.badgeBlue
      : props.tone === 'orange'
        ? styles.badgeOrange
        : props.tone === 'red'
          ? styles.badgeRed
          : props.tone === 'neutral'
            ? styles.badgeNeutral
            : styles.badgeGreen;

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.badgeText, toneStyle]}>{props.label}</Text>
    </View>
  );
}

export function ProductSummaryCard(props: {
  showBarcode?: boolean;
  showMeta?: boolean;
  stock?: string;
  title: string;
}): ReactElement {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <ProductThumb />
        <View style={styles.flex}>
          <Text style={styles.summaryName}>{props.title}</Text>
          <Text style={styles.summaryCategory}>Almacen</Text>
          <StockBadge label="En stock" />
        </View>
        {props.stock ? (
          <View style={styles.stockCol}>
            <Text style={styles.stockLabel}>Stock actual</Text>
            <Text style={styles.stockValue}>{props.stock}</Text>
            {props.showBarcode ? <Text style={styles.barcode}>|||||</Text> : null}
          </View>
        ) : null}
      </View>
      {props.showMeta ? (
        <View style={styles.metaGrid}>
          <MetaItem label="Codigo" value="7791234567890" />
          <MetaItem label="Precio de venta" value="$1.900 / kg" />
          <MetaItem label="Tipo de codigo" value="Codigo de barras" />
          <MetaItem label="Costo" value="$1.250 / kg" />
          <MetaItem label="SKU" value="HAR-GRAN-100KG" />
          <MetaItem label="Margen" value="34%" />
          <MetaItem label="Unidad" value="kg" />
          <MetaItem label="Sucursal" value="Sucursal Centro" />
        </View>
      ) : null}
    </View>
  );
}

function MetaItem(props: { label: string; value: string }): ReactElement {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{props.label}</Text>
      <Text style={styles.metaValue}>{props.value}</Text>
    </View>
  );
}

export function FormField(props: { compactLabel?: boolean; full?: boolean; green?: boolean; label: string; value: string }): ReactElement {
  return (
    <View style={[styles.formField, props.full && styles.formFieldFull]}>
      <Text style={[styles.fieldLabel, props.compactLabel && styles.fieldLabelCompact]}>{props.label}</Text>
      <View style={[styles.fieldBox, props.green && styles.fieldBoxGreen]}>
        <Text style={[styles.fieldValue, props.green && styles.fieldValueGreen]}>{props.value}</Text>
        <Icon color={colors.slate} kind="chevron-down" size={10} strokeWidth={2} />
      </View>
    </View>
  );
}

export function PrimaryButton(props: { label: string; onPress?: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function OutlineButton(props: { label: string; onPress?: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.outlineButton}>
      <Text style={styles.outlineButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function DangerButton(props: { label: string; onPress?: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.dangerButton}>
      <Text style={styles.dangerButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function SectionCard(props: { children: ReactNode; title?: string; subtitle?: string }): ReactElement {
  return (
    <View style={styles.sectionCard}>
      {props.title ? <Text style={styles.sectionCardTitle}>{props.title}</Text> : null}
      {props.subtitle ? <Text style={styles.sectionCardSubtitle}>{props.subtitle}</Text> : null}
      {props.children}
    </View>
  );
}

export function RowActions(): ReactElement {
  return (
    <View style={styles.rowActions}>
      <Icon color={colors.info} kind="gear" size={15} strokeWidth={2} />
      <Icon color={colors.danger} kind="alert" size={15} strokeWidth={2} />
      <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
    </View>
  );
}

export function PaymentChip(props: { active?: boolean; label: string; small?: boolean }): ReactElement {
  return (
    <View style={[styles.paymentChip, props.small && styles.paymentChipSmall, props.active && styles.paymentChipActive]}>
      <Text style={[styles.paymentChipText, props.active && styles.paymentChipTextActive]}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginTop: 2,
    width: 34,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeBlue: {
    backgroundColor: '#eef8ff',
    color: '#3978e8',
  },
  badgeGreen: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
  badgeNeutral: {
    backgroundColor: '#f1f3f5',
    color: colors.slate,
  },
  badgeOrange: {
    backgroundColor: '#fff0e4',
    color: colors.warning,
  },
  badgeRed: {
    backgroundColor: '#ffeaf0',
    color: colors.danger,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '300',
  },
  barcode: {
    color: colors.navy,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 4,
  },
  cameraButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 9,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  fieldBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    paddingHorizontal: 10,
  },
  fieldBoxGreen: {
    borderColor: colors.primary,
  },
  fieldLabel: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldLabelCompact: {
    fontSize: 11,
  },
  fieldValue: {
    color: colors.navy,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
  },
  fieldValueGreen: {
    color: colors.primary,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: 9,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  flex: {
    flex: 1,
  },
  formField: {
    flex: 1,
  },
  formFieldFull: {
    width: '100%',
  },
  metaGrid: {
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
  },
  metaItem: {
    width: '47%',
  },
  metaLabel: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '300',
  },
  metaValue: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: colors.navy,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  pageSubtitle: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 14,
    marginTop: 7,
  },
  pageTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  paymentChip: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  paymentChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  paymentChipSmall: {
    height: 24,
  },
  paymentChipText: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '600',
  },
  paymentChipTextActive: {
    color: colors.primary,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 34,
    paddingHorizontal: 12,
  },
  searchPlaceholder: {
    color: '#65708a',
    flex: 1,
    fontSize: 11,
    fontWeight: '300',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  sectionCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  sectionCardSubtitle: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 4,
  },
  sectionCardTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  stockCol: {
    alignItems: 'flex-end',
  },
  stockLabel: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '300',
  },
  stockValue: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  summaryCategory: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 2,
  },
  summaryName: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryTop: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: '#f2dfbf',
    borderColor: '#e4d5bc',
    borderRadius: 10,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  thumbBrand: {
    color: '#8a5a22',
    fontSize: 6,
    fontWeight: '600',
  },
  thumbQty: {
    color: colors.navy,
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  thumbSub: {
    color: '#8a5a22',
    fontSize: 5,
    fontWeight: '300',
  },
  titleRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
