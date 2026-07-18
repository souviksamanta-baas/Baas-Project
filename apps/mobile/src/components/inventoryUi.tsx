import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { StockTone } from '../api/inventoryMockData';
import {
  Badge,
  Chip,
  DangerButton as DsDangerButton,
  DisplayField,
  InfoBanner as DsInfoBanner,
  OutlineButton as DsOutlineButton,
  PrimaryButton as DsPrimaryButton,
  ScreenHeader,
  SearchActionRow,
  SectionCard as DsSectionCard,
  SecondaryButton as DsSecondaryButton,
  colors,
  radius,
  shadows,
  type BadgeTone,
} from '../design-system';
import { useHeaderChromeOptional } from '../context/HeaderChromeProvider';
import { Icon } from './icons';
import type { IconKind } from './icons';

function stockToneToBadgeTone(tone?: StockTone | 'neutral'): BadgeTone {
  if (tone === 'blue') return 'blue';
  if (tone === 'orange') return 'orange';
  if (tone === 'red') return 'red';
  if (tone === 'neutral') return 'neutral';
  return 'green';
}

export function InventoryScreenTitle(props: {
  onBack?: () => void;
  showBack?: boolean;
  subtitle: string;
  title: string;
}): ReactElement {
  const chrome = useHeaderChromeOptional();

  useEffect(() => {
    chrome.setChrome({ collapseEnabled: true, title: props.title });
  }, [chrome.setChrome, props.title]);

  return (
    <ScreenHeader
      onBack={props.onBack}
      showBack={props.showBack}
      subtitle={props.subtitle}
      title={props.title}
    />
  );
}

export function SearchFilterRow(props: {
  onChangeText?: (text: string) => void;
  searchValue?: string;
}): ReactElement {
  return (
    <SearchActionRow
      onChangeText={props.onChangeText}
      placeholder="Buscar por producto o categoria"
      searchValue={props.searchValue}
      showCamera
      showFilter
    />
  );
}

export function ProductThumb(): ReactElement {
  return (
    <View style={styles.thumb}>
      <View style={styles.thumbHighlight} />
      <Text style={styles.thumbBrand}>HARINA</Text>
      <Text style={styles.thumbSub}>DE TRIGO</Text>
      <Text style={styles.thumbQty}>100 kg</Text>
    </View>
  );
}

export function StockBadge(props: { label: string; tone?: StockTone | 'neutral' }): ReactElement {
  return <Badge label={props.label} tone={stockToneToBadgeTone(props.tone)} />;
}

export function ProductSummaryCard(props: {
  badge?: string;
  category?: string;
  changePhoto?: boolean;
  linkedTo?: string;
  meta?: {
    branch?: string;
    codeLabel?: string;
    codeUnavailable?: boolean;
    codeValue?: string;
    cost?: string;
    margin?: string;
    price?: string;
    sku?: string;
  };
  showBarcode?: boolean;
  showMeta?: boolean;
  statusLabel?: string;
  statusTone?: StockTone | 'neutral';
  stock?: string;
  title: string;
}): ReactElement {
  const meta = props.meta ?? {
    branch: 'Sucursal Centro',
    codeLabel: 'Codigo de barras',
    codeUnavailable: true,
    codeValue: 'No Disponible',
    cost: '$1.250',
    margin: '34%',
    price: '$1.900',
    sku: 'HAR-GRAN-100KG',
  };
  const codeLabel = meta.codeLabel ?? 'Codigo de barras';
  const codeValue = meta.codeValue ?? '—';
  const codeUnavailable = meta.codeUnavailable ?? false;
  const barcodeColor = codeUnavailable ? colors.danger : colors.navy;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View>
          <ProductThumb />
          {props.changePhoto ? (
            <View style={styles.changePhotoBadge}>
              <Icon color={colors.surface} kind="edit" size={10} strokeWidth={2} />
            </View>
          ) : null}
        </View>
        <View style={styles.flex}>
          <Text style={styles.summaryName}>{props.title}</Text>
          <Text style={styles.summaryCategory}>{props.category ?? 'Almacen'}</Text>
          {props.linkedTo ? <Text style={styles.linkedText}>Vinculado a: {props.linkedTo}</Text> : null}
          {props.badge ? (
            <Badge icon="box" label={props.badge} tone="blue" />
          ) : (
            <StockBadge label={props.statusLabel ?? 'En stock'} tone={props.statusTone} />
          )}
        </View>
        {props.stock ? (
          <View style={styles.stockCol}>
            <Text style={styles.stockLabel}>Stock actual</Text>
            <Text style={styles.stockValue}>{props.stock}</Text>
            {props.showBarcode ? (
              <View style={styles.barcodeWrap}>
                <Icon color={barcodeColor} kind="barcode" size={18} strokeWidth={1} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {props.showMeta ? (
        <View style={styles.metaGrid}>
          <MetaItem danger={codeUnavailable} label={codeLabel} value={codeValue} />
          <MetaItem label="Precio de venta" value={meta.price ?? '—'} />
          <MetaItem label="Costo" value={meta.cost ?? '—'} />
          <MetaItem label="SKU" value={meta.sku ?? '—'} />
          <MetaItem label="Margen" value={meta.margin ?? '—'} />
          <MetaItem label="Sucursal" value={meta.branch ?? '—'} />
        </View>
      ) : null}
    </View>
  );
}

function MetaItem(props: { danger?: boolean; label: string; value: string }): ReactElement {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{props.label}</Text>
      <Text style={[styles.metaValue, props.danger && styles.metaValueDanger]}>{props.value}</Text>
    </View>
  );
}

export function FormField(props: {
  calendar?: boolean;
  compactLabel?: boolean;
  full?: boolean;
  green?: boolean;
  label: string;
  select?: boolean;
  textarea?: boolean;
  value: string;
}): ReactElement {
  return (
    <View style={[styles.formField, props.full && styles.formFieldFull]}>
      <DisplayField
        calendar={props.calendar}
        compactLabel={props.compactLabel}
        highlight={props.green}
        label={props.label}
        select={props.select}
        textarea={props.textarea}
        value={props.value}
      />
    </View>
  );
}

export function PrimaryButton(props: {
  fullWidth?: boolean;
  icon?: IconKind;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <DsPrimaryButton
      flex={!props.fullWidth}
      fullWidth={props.fullWidth}
      icon={props.icon}
      label={props.label}
      onPress={props.onPress}
      size="compact"
      style={props.fullWidth ? styles.buttonFullWidth : undefined}
    />
  );
}

export function OutlineButton(props: {
  compact?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: IconKind;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <DsOutlineButton
      disabled={props.disabled}
      flex={!props.fullWidth}
      fullWidth={props.fullWidth}
      icon={props.icon}
      label={props.label}
      onPress={props.onPress}
      size={props.compact ? 'compact' : 'md'}
      style={props.fullWidth ? styles.buttonFullWidth : undefined}
    />
  );
}

export function SecondaryButton(props: {
  fullWidth?: boolean;
  icon?: IconKind;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <DsSecondaryButton
      flex={!props.fullWidth}
      fullWidth={props.fullWidth}
      icon={props.icon}
      label={props.label}
      onPress={props.onPress}
      size="md"
      style={props.fullWidth ? styles.formSecondaryButton : undefined}
    />
  );
}

export function DangerButton(props: { label: string; onPress?: () => void }): ReactElement {
  return (
    <DsDangerButton
      fullWidth
      icon="trash"
      label={props.label}
      onPress={props.onPress}
      size="compact"
      style={styles.dangerOutlineButton}
    />
  );
}

export function SolidDangerButton(props: {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.solidDangerButton, props.disabled && styles.solidDangerButtonDisabled]}
    >
      <Text style={styles.solidDangerButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function CobrarButton(props: { onPress?: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.cobrarButton}>
      <Text style={styles.cobrarSymbol}>$</Text>
      <Text style={styles.cobrarLabel}>Cobrar</Text>
    </Pressable>
  );
}

export function SectionCard(props: { children: ReactNode; title?: string; subtitle?: string }): ReactElement {
  return (
    <DsSectionCard style={styles.sectionCard}>
      {props.title ? <Text style={styles.sectionCardTitle}>{props.title}</Text> : null}
      {props.subtitle ? <Text style={styles.sectionCardSubtitle}>{props.subtitle}</Text> : null}
      <View style={styles.sectionCardBody}>{props.children}</View>
    </DsSectionCard>
  );
}

export function RowActions(props: {
  onAddStock?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}): ReactElement {
  return (
    <View style={styles.rowActions}>
      {props.onEdit ? (
        <Pressable
          accessibilityLabel="Editar producto"
          hitSlop={8}
          onPress={props.onEdit}
          style={styles.rowActionButton}
        >
          <Icon color={colors.info} kind="edit" size={15} strokeWidth={2} />
        </Pressable>
      ) : null}
      {props.onDelete ? (
        <Pressable
          accessibilityLabel="Eliminar producto"
          hitSlop={8}
          onPress={props.onDelete}
          style={styles.rowActionButton}
        >
          <Icon color={colors.danger} kind="trash" size={15} strokeWidth={1.8} />
        </Pressable>
      ) : null}
      {props.onAddStock ? (
        <Pressable
          accessibilityLabel="Agregar stock"
          hitSlop={8}
          onPress={props.onAddStock}
          style={styles.rowActionButton}
        >
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PaginationControlButton(props: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.paginationButton,
        props.active && styles.paginationButtonActive,
        props.disabled && styles.paginationButtonDisabled,
      ]}
    >
      <Text
        style={[
          styles.paginationButtonText,
          props.active && styles.paginationButtonTextActive,
          props.disabled && styles.paginationButtonTextDisabled,
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function InventoryPagination(props: {
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  rangeEnd: number;
  rangeStart: number;
  total: number;
  visiblePages: number[];
}): ReactElement {
  const rangeLabel =
    props.total === 0
      ? '0 productos'
      : `${props.rangeStart}-${props.rangeEnd} de ${props.total} producto${props.total === 1 ? '' : 's'}`;

  return (
    <View style={styles.paginationRow}>
      <Text style={styles.paginationMeta}>{rangeLabel}</Text>
      {props.pageCount > 1 ? (
        <View style={styles.paginationControls}>
          <PaginationControlButton
            disabled={props.page <= 1}
            label="<"
            onPress={() => props.onPageChange(props.page - 1)}
          />
          {props.visiblePages.map((pageNumber, index) => {
            const previousPage = props.visiblePages[index - 1];
            const showGap = previousPage != null && pageNumber - previousPage > 1;

            return (
              <View key={pageNumber} style={styles.paginationPageGroup}>
                {showGap ? <Text style={styles.paginationGap}>...</Text> : null}
                <PaginationControlButton
                  active={pageNumber === props.page}
                  label={String(pageNumber)}
                  onPress={() => props.onPageChange(pageNumber)}
                />
              </View>
            );
          })}
          <PaginationControlButton
            disabled={props.page >= props.pageCount}
            label=">"
            onPress={() => props.onPageChange(props.page + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function PaymentChip(props: { active?: boolean; label: string; small?: boolean }): ReactElement {
  return <Chip active={props.active} label={props.label} small={props.small} />;
}

export function DiscountToggle(props: {
  mode: 'amount' | 'percent';
  onChange: (mode: 'amount' | 'percent') => void;
}): ReactElement {
  return (
    <View style={styles.discountToggle}>
      <Pressable
        onPress={() => props.onChange('percent')}
        style={[styles.discountToggleOption, props.mode === 'percent' && styles.discountToggleOptionActive]}
      >
        <Text style={[styles.discountToggleText, props.mode === 'percent' && styles.discountToggleTextActive]}>%</Text>
      </Pressable>
      <Pressable
        onPress={() => props.onChange('amount')}
        style={[styles.discountToggleOption, props.mode === 'amount' && styles.discountToggleOptionActive]}
      >
        <Text style={[styles.discountToggleText, props.mode === 'amount' && styles.discountToggleTextActive]}>$</Text>
      </Pressable>
    </View>
  );
}

function DiscountInputField(props: {
  mode: 'amount' | 'percent';
  onChangeText: (value: string) => void;
  value: string;
}): ReactElement {
  return (
    <View style={[styles.discountInput, props.mode === 'percent' && styles.discountInputPercent]}>
      {props.mode === 'amount' ? <Text style={styles.discountInputPrefix}>$</Text> : null}
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={props.onChangeText}
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        style={[
          styles.discountInputText,
          props.mode === 'percent' && styles.discountInputTextPercent,
          Platform.OS === 'web' && styles.inputWebNoOutline,
        ]}
        value={props.value}
      />
      {props.mode === 'percent' ? <Text style={styles.discountInputSuffix}>%</Text> : null}
    </View>
  );
}

export function SaleTotalsBlock(props: {
  discountInput?: string;
  discountLabel?: string;
  discountMode?: 'amount' | 'percent';
  discountValue: string;
  onDiscountInputChange?: (value: string) => void;
  onDiscountModeChange?: (mode: 'amount' | 'percent') => void;
  subtotal: string;
  total: string;
  totalLabel?: string;
  withDiscountControls?: boolean;
}): ReactElement {
  const [internalDiscountMode, setInternalDiscountMode] = useState<'amount' | 'percent'>('percent');
  const discountMode = props.discountMode ?? internalDiscountMode;
  const setDiscountMode = props.onDiscountModeChange ?? setInternalDiscountMode;

  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalRow}>
        <Text style={styles.totalRowLabel}>Subtotal</Text>
        <Text style={styles.totalRowLabel}>{props.subtotal}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalRowLabel}>{props.discountLabel ?? 'Descuento'}</Text>
        {props.withDiscountControls ? (
          <View style={styles.discountControls}>
            <DiscountToggle mode={discountMode} onChange={setDiscountMode} />
            <DiscountInputField
              mode={discountMode}
              onChangeText={props.onDiscountInputChange ?? (() => undefined)}
              value={props.discountInput ?? ''}
            />
            <Text style={styles.discountValue}>{props.discountValue}</Text>
          </View>
        ) : (
          <Text style={styles.discountPercentValue}>{props.discountValue}</Text>
        )}
      </View>
      <View style={styles.totalRowFinal}>
        <Text style={styles.totalFinalLabel}>{props.totalLabel ?? 'Total'}</Text>
        <Text style={styles.totalFinalValue}>{props.total}</Text>
      </View>
    </View>
  );
}

export function CodeTypeIcon(props: { code: string; tone?: 'red'; small?: boolean }): ReactElement {
  const isQr = props.code.toLowerCase().includes('qr');
  const iconKind = isQr ? 'qr' : 'barcode';
  const iconColor = props.tone === 'red' ? colors.danger : colors.slate;
  const size = props.small ? 12 : 14;

  return <Icon color={iconColor} kind={iconKind} size={size} strokeWidth={1} />;
}

export function LinkedSubproductRow(props: {
  isLast?: boolean;
  name: string;
  onEditPress?: () => void;
  onPress?: () => void;
}): ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.linkedSubproductRow, props.isLast && styles.linkedSubproductRowLast]}
    >
      <ProductThumb />
      <View style={styles.flex}>
        <Text style={styles.linkedSubproductName}>{props.name}</Text>
        <Text style={styles.linkedSubproductMeta}>Usa stock del producto base</Text>
      </View>
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          props.onEditPress?.();
        }}
        style={styles.linkedSubproductAction}
      >
        <Icon color={colors.primary} kind="edit" size={12} strokeWidth={2} />
        <Text style={[styles.linkedSubproductActionText, styles.linkedSubproductEditText]}>Editar</Text>
        <Icon color={colors.primary} kind="chevron-right" size={12} strokeWidth={2.2} />
      </Pressable>
    </Pressable>
  );
}

export function RadioProductOption(props: {
  active?: boolean;
  meta: string;
  name: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.radioOption, props.active && styles.radioOptionActive]}
    >
      <View style={[styles.radioCircle, props.active && styles.radioCircleActive]}>
        {props.active ? <View style={styles.radioDot} /> : null}
      </View>
      <ProductThumb />
      <View style={styles.flex}>
        <Text style={styles.radioOptionName}>{props.name}</Text>
        <Text style={styles.radioOptionMeta}>{props.meta}</Text>
      </View>
    </Pressable>
  );
}

export function InfoBanner(props: { children: ReactNode }): ReactElement {
  return <DsInfoBanner>{props.children}</DsInfoBanner>;
}

export function LinkedDeleteRow(props: { name: string }): ReactElement {
  return (
    <View style={styles.linkedDeleteRow}>
      <ProductThumb />
      <Text style={styles.linkedDeleteName}>{props.name}</Text>
    </View>
  );
}

export function InfoBlock(props: { label: string; value: string }): ReactElement {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoBlockLabel}>{props.label}</Text>
      <Text style={styles.infoBlockValue}>{props.value}</Text>
    </View>
  );
}

export interface CartLineItemMock {
  id: string;
  name: string;
  price: string;
  qty: string;
  weight?: boolean;
}

export function CartLineRow(props: {
  gramsShowPlaceholder?: boolean;
  gramsValue?: string;
  inListCard?: boolean;
  isFirst?: boolean;
  item: CartLineItemMock;
  onDecrease?: () => void;
  onGramsChange?: (value: string) => void;
  onGramsFocus?: () => void;
  onIncrease?: () => void;
  onRemove?: () => void;
}): ReactElement {
  return (
    <View
      style={[
        styles.cartLineRow,
        props.inListCard && styles.cartLineRowList,
        props.isFirst && !props.inListCard && styles.cartLineRowFirst,
      ]}
    >
      <ProductThumb />
      <View style={styles.flex}>
        <View style={styles.cartNameRow}>
          <Text style={styles.cartName}>{props.item.name}</Text>
          {props.item.weight ? (
            <View style={styles.weightBadge}>
              <Text style={styles.weightBadgeText}>peso</Text>
            </View>
          ) : null}
        </View>
        {props.item.weight ? (
          <View style={styles.cartWeightInputBox}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={props.onGramsChange}
              onFocus={props.onGramsFocus}
              placeholder="1000"
              placeholderTextColor={colors.placeholder}
              style={[styles.cartWeightInput, Platform.OS === 'web' && styles.inputWebNoOutline]}
              value={props.gramsShowPlaceholder ? '' : (props.gramsValue ?? '')}
            />
            <Text style={styles.cartWeightSuffix}>g</Text>
          </View>
        ) : (
          <View style={styles.qtyControls}>
            <Pressable onPress={props.onDecrease} style={styles.qtyButton}>
              <Text style={styles.qtyButtonText}>-</Text>
            </Pressable>
            <Text style={styles.qtyValue}>{props.item.qty}</Text>
            <Pressable onPress={props.onIncrease} style={styles.qtyButton}>
              <Text style={styles.qtyButtonText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={styles.cartPrice}>{props.item.price}</Text>
      <Pressable accessibilityLabel="Quitar del carrito" hitSlop={8} onPress={props.onRemove}>
        <Icon color={colors.danger} kind="trash" size={14} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

export function ConfirmEditButton(props: {
  disabled?: boolean;
  icon?: 'bill' | 'edit';
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <DsOutlineButton
      disabled={props.disabled}
      fullWidth
      icon={props.icon ?? 'edit'}
      label={props.label}
      onPress={props.onPress}
      size="compact"
      style={styles.confirmEditButton}
    />
  );
}

export function ConfirmPrimaryButton(props: {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}): ReactElement {
  return (
    <DsPrimaryButton
      disabled={props.disabled}
      fullWidth
      icon="check"
      label={props.label}
      onPress={props.onPress}
      size="compact"
      style={styles.confirmPrimaryButton}
    />
  );
}

const styles = StyleSheet.create({
  backPressable: {
    marginLeft: -6,
    marginTop: -8,
  },
  backText: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 42,
    width: 28,
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
    color: colors.info,
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
  buttonFullWidth: {
    flex: 0,
    marginTop: 12,
    width: '100%',
  },
  formSecondaryButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 0,
    height: 44,
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    width: '100%',
  },
  barcodeWrap: {
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
  cartLineRow: {
    alignItems: 'center',
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  cartLineRowFirst: {
    borderTopWidth: 0,
    marginTop: 2,
    paddingTop: 0,
  },
  cartLineRowList: {
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cartName: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  cartNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cartPrice: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  changePhotoBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    bottom: -2,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 18,
  },
  confirmEditButton: {
    marginTop: 12,
  },
  confirmPrimaryButton: {
    marginTop: 10,
  },
  cobrarButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    justifyContent: 'center',
  },
  cobrarLabel: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  cobrarSymbol: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  dangerOutlineButton: {
    marginTop: 10,
  },
  discountActive: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountActiveText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '600',
  },
  discountControls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
  },
  discountInactive: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountInactiveText: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '600',
  },
  discountInput: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    minWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discountInputPercent: {
    maxWidth: 72,
    minWidth: 56,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  discountInputPrefix: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  discountInputSuffix: {
    color: colors.navy,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '600',
  },
  discountInputText: {
    color: colors.navy,
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    minWidth: 52,
    padding: 0,
    textAlign: 'center',
  },
  discountInputTextPercent: {
    flexShrink: 1,
    minWidth: 16,
  },
  cartWeightInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    minWidth: 0,
    padding: 0,
  },
  cartWeightInputBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 92,
  },
  cartWeightSuffix: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '600',
  },
  inputWebNoOutline: {
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  discountPercentValue: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '600',
  },
  discountToggle: {
    borderColor: '#dfe7ec',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  discountToggleOption: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountToggleOptionActive: {
    backgroundColor: colors.primary,
  },
  discountToggleText: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '600',
  },
  discountToggleTextActive: {
    color: colors.surface,
  },
  discountValue: {
    color: colors.info,
    fontSize: 10,
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
  fieldBoxTextarea: {
    alignItems: 'flex-start',
    height: 64,
    paddingVertical: 8,
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
  fieldValueTextarea: {
    lineHeight: 14,
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
  infoBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#eef8ff',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBannerText: {
    color: colors.navy,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 15,
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockLabel: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '300',
  },
  infoBlockValue: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 4,
  },
  linkedBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  linkedDeleteName: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  linkedDeleteRow: {
    alignItems: 'center',
    borderTopColor: '#ffd2dc',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
  },
  linkedSubproductAction: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
  },
  linkedSubproductActionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  linkedSubproductEditText: {
    color: colors.primary,
  },
  linkedSubproductMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 2,
  },
  linkedSubproductName: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  linkedSubproductRow: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkedSubproductRowLast: {
    borderBottomWidth: 0,
  },
  linkedText: {
    color: colors.info,
    fontSize: 9,
    fontWeight: '300',
    marginTop: 4,
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
  metaValueDanger: {
    color: colors.danger,
  },
  paginationButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderInput,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
  },
  paginationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '600',
  },
  paginationButtonTextActive: {
    color: colors.surface,
  },
  paginationButtonTextDisabled: {
    color: colors.slate,
  },
  paginationControls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
  },
  paginationGap: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  paginationMeta: {
    color: colors.slate,
    flex: 1,
    fontSize: 10,
    fontWeight: '300',
    minWidth: 0,
  },
  paginationPageGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  paginationRow: {
    alignItems: 'center',
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: colors.navy,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 44,
    justifyContent: 'center',
  },
  outlineButtonCompact: {
    height: 40,
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
    flexDirection: 'row',
    gap: 8,
    height: 44,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  qtyButton: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  qtyButtonText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  qtyControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  qtyInput: {
    borderColor: '#dfe7ec',
    borderRadius: 6,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
    height: 28,
    marginTop: 6,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyValue: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  radioCircle: {
    alignItems: 'center',
    borderColor: '#cfd8df',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  radioOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#dfe7ec',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  radioOptionActive: {
    backgroundColor: '#f6fffa',
    borderColor: colors.primary,
  },
  radioOptionMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  radioOptionName: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  rowActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: colors.navy,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  searchPlaceholder: {
    color: '#65708a',
    flex: 1,
    fontSize: 11,
    fontWeight: '300',
  },
  searchField: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionCard: {
    padding: 14,
  },
  sectionCardBody: {
    gap: 8,
    paddingBottom: 10,
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
    paddingBottom: 8,
  },
  solidDangerButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  solidDangerButtonDisabled: {
    opacity: 0.45,
  },
  solidDangerButtonText: {
    color: colors.surface,
    fontSize: 11,
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
    overflow: 'hidden',
    width: 52,
  },
  thumbBrand: {
    color: '#8a5a22',
    fontSize: 6,
    fontWeight: '600',
    lineHeight: 7,
  },
  thumbHighlight: {
    backgroundColor: '#fff8ea',
    height: '45%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
    gap: 4,
  },
  totalFinalLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  totalFinalValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalRowFinal: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  totalRowLabel: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  totalsBlock: {
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  weightBadge: {
    backgroundColor: '#eef8ff',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  weightBadgeText: {
    color: colors.info,
    fontSize: 8,
    fontWeight: '300',
  },
});
