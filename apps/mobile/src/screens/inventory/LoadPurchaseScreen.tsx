import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  InventoryDateField,
  InventorySupplierField,
} from '../../components/ProductEditFormFields';
import { Icon } from '../../components/icons';
import {
  InfoBanner,
  InventoryPagination,
  InventoryScreenTitle,
  PrimaryButton,
  ProductThumb,
  RowActions,
  SearchFilterRow,
  SectionCard,
  StockBadge,
} from '../../components/inventoryUi';
import { ScreenContent } from '../../components/ui';
import { ListBox } from '../../design-system';
import type { LoadPurchaseLine } from '../../context/LoadPurchaseProvider';
import {
  filterInventoryProducts,
  getVisiblePageNumbers,
  paginateItems,
} from '../../lib/inventoryPresentation';
import { isPurchaseNumberTaken } from '../../lib/purchases';
import { formatCurrency } from '../../lib/sellCart';
import { listSuppliers } from '../../lib/suppliers';
import {
  inventoryProducts,
  type InventoryProductMock,
} from '../../api/inventoryMockData';
import { colors, radius } from '../../theme';

const PAGE_SIZE = 10;

function InventoryListRow(props: {
  isLast?: boolean;
  onAddStock?: () => void;
  product: InventoryProductMock;
}): ReactElement {
  return (
    <View
      style={[
        styles.inventoryRow,
        props.product.indent && styles.inventoryRowIndent,
        props.isLast && styles.inventoryRowLast,
      ]}
    >
      <View style={styles.inventoryRowMain}>
        <ProductThumb />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{props.product.name}</Text>
          <Text style={styles.rowMeta}>{props.product.category}</Text>
          <View style={styles.stockRow}>
            <Text style={styles.stockValueInline}>{props.product.stock}</Text>
            <StockBadge label={props.product.status} tone={props.product.statusTone} />
          </View>
        </View>
        <RowActions onAddStock={props.onAddStock} />
      </View>
    </View>
  );
}

function PurchaseLineRow(props: {
  isLast?: boolean;
  line: LoadPurchaseLine;
  onRemove?: () => void;
}): ReactElement {
  return (
    <View style={[styles.purchaseLineRow, props.isLast && styles.purchaseLineRowLast]}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{props.line.productName}</Text>
        <Text style={styles.rowMeta}>
          {props.line.quantity} {props.line.unitCode} · {formatCurrency(props.line.unitCostCents)} c/u
        </Text>
      </View>
      <Text style={styles.purchaseLineTotal}>{formatCurrency(props.line.lineTotalCents)}</Text>
      {props.onRemove ? (
        <Pressable accessibilityLabel="Quitar ítem" hitSlop={8} onPress={props.onRemove}>
          <Icon color={colors.danger} kind="trash" size={15} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadPurchaseScreen(props: {
  businessCenterId: string | null;
  editingPurchaseId?: string | null;
  errorMessage?: string | null;
  isLoading?: boolean;
  isSaving?: boolean;
  lines: LoadPurchaseLine[];
  onAddStockProduct: (productId: string) => void;
  onBack: () => void;
  onClearDraft?: () => void;
  onDateChange: (value: string) => void;
  onPurchaseNumberChange: (value: string) => void;
  onRemoveLine?: (lineId: string) => void;
  onSavePurchase: () => Promise<void>;
  onSupplierChange: (value: string) => void;
  organizationId: string | null;
  products?: InventoryProductMock[];
  purchaseDate: string;
  purchaseNumber: string;
  purchaseNumberLocked?: boolean;
  supplier: string;
  totalCostCents: number;
  totalItems: number;
}): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [purchaseNumberStatus, setPurchaseNumberStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'empty'
  >('empty');
  const products = props.products ?? inventoryProducts;
  const filteredProducts = useMemo(
    () => filterInventoryProducts(products, searchQuery),
    [products, searchQuery],
  );
  const pagination = useMemo(
    () => paginateItems(filteredProducts, currentPage, PAGE_SIZE),
    [filteredProducts, currentPage],
  );
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(pagination.page, pagination.pageCount),
    [pagination.page, pagination.pageCount],
  );
  const productCountLabel = `${filteredProducts.length} producto${filteredProducts.length === 1 ? '' : 's'}`;
  const supplierMatched = useMemo(() => {
    const trimmed = props.supplier.trim().toLowerCase();

    if (!trimmed) {
      return false;
    }

    return supplierNames.some((name) => name.toLowerCase() === trimmed);
  }, [props.supplier, supplierNames]);

  const loadSuppliers = useCallback(async () => {
    const contacts = await listSuppliers();
    const uniqueNames = [...new Set(contacts.map((contact) => contact.name))];
    setSupplierNames(uniqueNames);
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > pagination.pageCount) {
      setCurrentPage(pagination.pageCount);
    }
  }, [currentPage, pagination.pageCount]);

  useEffect(() => {
    const trimmed = props.purchaseNumber.trim();

    if (!trimmed) {
      setPurchaseNumberStatus('empty');
      return;
    }

    if (!props.organizationId || !props.businessCenterId) {
      setPurchaseNumberStatus('idle');
      return;
    }

    let cancelled = false;
    setPurchaseNumberStatus('checking');

    const timeout = setTimeout(() => {
      void isPurchaseNumberTaken({
        businessCenterId: props.businessCenterId!,
        excludePurchaseId: props.editingPurchaseId ?? undefined,
        organizationId: props.organizationId!,
        purchaseNumber: trimmed,
      }).then((taken) => {
        if (cancelled) {
          return;
        }

        setPurchaseNumberStatus(taken ? 'taken' : 'available');
      });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    props.businessCenterId,
    props.editingPurchaseId,
    props.organizationId,
    props.purchaseNumber,
  ]);

  function handleAddStock(productId: string): void {
    if (!props.purchaseNumber.trim()) {
      Alert.alert('Falta el número', 'Ingresá el número de compra antes de agregar stock.');
      return;
    }

    if (purchaseNumberStatus === 'taken') {
      Alert.alert('Número repetido', 'Ese número de compra ya existe. Usá uno distinto.');
      return;
    }

    if (purchaseNumberStatus === 'checking') {
      Alert.alert('Un momento', 'Estamos verificando el número de compra.');
      return;
    }

    if (!props.purchaseDate.trim()) {
      Alert.alert('Falta la fecha', 'Ingresá la fecha de compra.');
      return;
    }

    if (!supplierMatched) {
      Alert.alert(
        'Proveedor inválido',
        'Elegí un proveedor de la lista. Solo se permiten proveedores existentes.',
      );
      return;
    }

    props.onAddStockProduct(productId);
  }

  async function handleSave(): Promise<void> {
    try {
      await props.onSavePurchase();
      Alert.alert(
        'Compra guardada',
        'La compra quedó pendiente de confirmación. El stock se ingresará cuando la confirmes en Gestionar compras.',
      );
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent title="Cargar compra">
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle={
          props.editingPurchaseId
            ? 'Editá el remito pendiente y guardá los cambios'
            : 'Armá el remito y guardalo pendiente de confirmación'
        }
        title={props.editingPurchaseId ? 'Editar compra' : 'Cargar compra'}
      />

      <SectionCard title="Datos de la compra">
        <View style={styles.purchaseNumberField}>
          <Text style={styles.fieldLabel}>Número de compra</Text>
          <View style={styles.purchaseNumberInputRow}>
            <TextInput
              editable={!props.purchaseNumberLocked}
              onChangeText={props.onPurchaseNumberChange}
              placeholder="Ej. FC-00421"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.purchaseNumberInput,
                props.purchaseNumberLocked && styles.purchaseNumberInputLocked,
              ]}
              value={props.purchaseNumber}
            />
            {purchaseNumberStatus === 'available' ? (
              <View style={styles.purchaseNumberCheck}>
                <Icon color={colors.primary} kind="check" size={16} strokeWidth={2.2} />
              </View>
            ) : null}
          </View>
          {purchaseNumberStatus === 'taken' ? (
            <Text style={styles.purchaseNumberError}>Ese número de compra ya existe.</Text>
          ) : purchaseNumberStatus === 'available' ? (
            <Text style={styles.purchaseNumberOk}>Número disponible.</Text>
          ) : null}
        </View>

        <View style={styles.headerFieldRow}>
          {props.purchaseNumberLocked ? (
            <>
              <View style={styles.lockedField}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <Text style={styles.lockedFieldValue}>{props.purchaseDate}</Text>
              </View>
              <View style={styles.lockedField}>
                <Text style={styles.fieldLabel}>Proveedor</Text>
                <Text style={styles.lockedFieldValue}>{props.supplier}</Text>
              </View>
            </>
          ) : (
            <>
              <InventoryDateField
                label="Fecha"
                onChange={props.onDateChange}
                value={props.purchaseDate}
              />
              <InventorySupplierField
                existingOnly
                label="Proveedor"
                onChangeText={props.onSupplierChange}
                suggestions={supplierNames}
                value={props.supplier}
              />
            </>
          )}
        </View>
        {props.purchaseNumberLocked ? (
          <Text style={styles.lockedHint}>
            Los datos de la compra quedan fijos al agregar el primer ítem.
          </Text>
        ) : null}
      </SectionCard>

      {props.errorMessage ? <InfoBanner>{props.errorMessage}</InfoBanner> : null}

      <SearchFilterRow onChangeText={setSearchQuery} searchValue={searchQuery} />

      <ListBox headerMeta={productCountLabel} title="Productos en inventario">
        {props.isLoading ? (
          <Text style={styles.loadingText}>Cargando inventario...</Text>
        ) : products.length === 0 ? (
          <Text style={styles.loadingText}>No hay productos cargados en esta sucursal.</Text>
        ) : filteredProducts.length === 0 ? (
          <Text style={styles.loadingText}>No se encontraron productos para esta búsqueda.</Text>
        ) : (
          <>
            {pagination.items.map((product, index) => (
              <InventoryListRow
                key={`${product.id}-${index}`}
                isLast={index === pagination.items.length - 1}
                onAddStock={() => handleAddStock(product.id)}
                product={product}
              />
            ))}
            <InventoryPagination
              onPageChange={setCurrentPage}
              page={pagination.page}
              pageCount={pagination.pageCount}
              rangeEnd={pagination.rangeEnd}
              rangeStart={pagination.rangeStart}
              total={pagination.total}
              visiblePages={visiblePages}
            />
          </>
        )}
      </ListBox>

      <ListBox
        headerMeta={`${props.lines.length} ítem${props.lines.length === 1 ? '' : 's'}`}
        title="Resumen de la compra"
      >
        {props.lines.length === 0 ? (
          <Text style={styles.loadingText}>
            Agregá stock con el ícono + para ir armando el resumen del remito.
          </Text>
        ) : (
          <>
            {props.lines.map((line, index) => (
              <PurchaseLineRow
                key={line.id}
                isLast={index === props.lines.length - 1}
                line={line}
                onRemove={
                  props.onRemoveLine && !props.isSaving
                    ? () => props.onRemoveLine?.(line.id)
                    : undefined
                }
              />
            ))}
            <View style={styles.purchaseTotals}>
              <View>
                <Text style={styles.purchaseTotalsLabel}>Ítems cargados</Text>
                <Text style={styles.purchaseTotalsValue}>{props.totalItems}</Text>
              </View>
              <View style={styles.purchaseTotalsRight}>
                <Text style={styles.purchaseTotalsLabel}>Costo total</Text>
                <Text style={styles.purchaseTotalsValue}>
                  {formatCurrency(props.totalCostCents)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ListBox>

      {props.lines.length > 0 ? (
        <PrimaryButton
          fullWidth
          label={props.isSaving ? 'Guardando...' : 'Guardar compra'}
          onPress={() => {
            if (!props.isSaving) {
              void handleSave();
            }
          }}
        />
      ) : null}

      {props.lines.length > 0 && props.onClearDraft ? (
        <Pressable
          disabled={props.isSaving}
          onPress={() => {
            Alert.alert(
              'Nueva compra',
              '¿Querés limpiar el resumen y empezar otra compra?',
              [
                { style: 'cancel', text: 'Cancelar' },
                {
                  onPress: props.onClearDraft,
                  style: 'destructive',
                  text: 'Empezar otra',
                },
              ],
            );
          }}
          style={styles.newPurchaseButton}
        >
          <Text style={styles.newPurchaseButtonText}>Empezar otra compra</Text>
        </Pressable>
      ) : null}
    </ScreenContent>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  headerFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inventoryRow: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inventoryRowIndent: {
    paddingLeft: 28,
  },
  inventoryRowLast: {
    borderBottomWidth: 0,
  },
  inventoryRowMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingText: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedField: {
    flex: 1,
    minWidth: 140,
  },
  lockedFieldValue: {
    borderColor: '#dfe7ec',
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.85,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedHint: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '300',
    marginTop: 8,
  },
  newPurchaseButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 12,
  },
  newPurchaseButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  purchaseLineRow: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  purchaseLineRowLast: {
    borderBottomWidth: 0,
  },
  purchaseLineTotal: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  purchaseNumberCheck: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  purchaseNumberError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 6,
  },
  purchaseNumberField: {
    marginBottom: 10,
    width: '100%',
  },
  purchaseNumberInput: {
    color: colors.navy,
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 10,
  },
  purchaseNumberInputLocked: {
    opacity: 0.7,
  },
  purchaseNumberInputRow: {
    alignItems: 'center',
    borderColor: '#dfe7ec',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  purchaseNumberOk: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 6,
  },
  purchaseTotals: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  purchaseTotalsLabel: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '400',
  },
  purchaseTotalsRight: {
    alignItems: 'flex-end',
  },
  purchaseTotalsValue: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  rowMeta: {
    color: colors.slate,
    fontSize: 13,
    fontWeight: '300',
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stockValueInline: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '500',
  },
});
