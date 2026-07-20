import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  baseProduct,
  batches,
  inventoryProducts,
  movements,
  sellProducts,
  subproducts,
  type InventoryProductMock,
  type SellProductMock,
  type SubproductMock,
} from '../../api/inventoryMockData';
import {
  DEFAULT_CLIENT_LABEL,
  DEFAULT_RECEIPT_LABEL,
  formatCurrency,
} from '../../lib/sellCart';
import {
  formatSaleDiscountLabel,
  formatSaleDiscountValue,
  mapCartLineToView,
  useSellCart,
} from '../../context/SellCartProvider';
import {
  InventoryDateField,
  InventoryDecimalField,
  InventoryIntegerField,
  InventoryMoneyField,
  InventoryPercentField,
  InventoryReadOnlyField,
  InventorySelectField,
  InventorySupplierField,
  InventoryTextField,
} from '../../components/ProductEditFormFields';
import {
  CartLineRow,
  CobrarButton,
  CodeTypeIcon,
  ConfirmEditButton,
  ConfirmPrimaryButton,
  DangerButton,
  FormField,
  InfoBanner,
  InfoBlock,
  InventoryPagination,
  InventoryScreenTitle,
  LinkedDeleteRow,
  OutlineButton,
  PrimaryButton,
  ProductSummaryCard,
  ProductThumb,
  RadioProductOption,
  RowActions,
  SaleTotalsBlock,
  SearchFilterRow,
  SectionCard,
  SolidDangerButton,
  StockBadge,
} from '../../components/inventoryUi';
import { ScreenContent } from '../../components/ui';
import { ListBox, TextField } from '../../design-system';
import {
  buildProductSummaryMeta,
  filterInventoryProducts,
  filterSellProducts,
  formatProductCost,
  formatProductStockLabel,
  formatProductUnitPrice,
  getProductStatusLabel,
  getVisiblePageNumbers,
  mapProductToInventoryRow,
  mapProductsToSellRows,
  paginateItems,
} from '../../lib/inventoryPresentation';
import {
  getProductCodeTypeLabel,
  readProductCodeType,
  readProductCodeValue,
  isProductCodeUnavailable,
  isGranelProduct,
} from '../../lib/productCatalog';
import {
  BASE_UNIT_OPTIONS,
  computeParentStockDeduction,
  formatSubproductBaseConversion,
  PRODUCT_STATUS_OPTIONS,
  sortOptionsAlphabetically,
  type ProductStatusSlug,
} from '../../lib/productCatalog';
import {
  applyAddProductCost,
  applyAddProductMargin,
  applyAddProductUnitPrice,
  createEmptyAddProductForm,
  createEmptyAddSubproductForm,
  scalePricingFromParentProduct,
} from '../../lib/productCreateForm';
import {
  applyCostToFormValues,
  applyMarginToFormValues,
  applyUnitPriceToFormValues,
  productToEditFormValues,
} from '../../lib/productEditForm';
import {
  previewLotCode,
  productToAddStockFormValues,
  applyAddStockCost,
  applyAddStockMargin,
  applyAddStockUnitPrice,
} from '../../lib/addStockForm';
import { mapLotsToBatchRows } from '../../lib/inventoryLotsPresentation';
import type { AddStockFormValues } from '../../types/inventoryLots';
import { colors, radius, shadows } from '../../theme';
import type { AddProductFormValues, Product, ProductEditFormValues } from '../../types/products';
import type { SellCartLine } from '../../lib/sellCart';
import { Icon } from '../../components/icons';

type InventoryNav = {
  onAddStock: () => void;
  onAddStockForProduct: (productId: string) => void;
  onDeleteProductById: (productId: string) => void;
  onOpenAddSubproduct: () => void;
  onOpenConfirmPayment: () => void;
  onOpenDeleteProduct: () => void;
  onOpenEditProduct: () => void;
  onOpenEditSubproduct: (subproductId: string) => void;
  onOpenProductDetail: (productId: string) => void;
  onOpenSellProducts: () => void;
};

const MANAGE_STOCK_PAGE_SIZE = 10;
const SELL_PAGE_SIZE = 10;

export function ManageStockScreen(
  props: {
    errorMessage?: string | null;
    initialLowStockOnly?: boolean;
    isLoading?: boolean;
    onAddStockProduct: (productId: string) => void;
    onAddProduct?: () => void;
    onDeleteProduct: (productId: string) => void;
    onEditProduct: (productId: string) => void;
    onOpenProductDetail: (productId: string) => void;
    onScanCode?: () => void;
    products?: InventoryProductMock[];
  },
): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(props.initialLowStockOnly === true);
  const [currentPage, setCurrentPage] = useState(1);
  const products = props.products ?? inventoryProducts;
  const filteredProducts = useMemo(
    () => filterInventoryProducts(products, searchQuery, { lowStockOnly }),
    [lowStockOnly, products, searchQuery],
  );
  const pagination = useMemo(
    () => paginateItems(filteredProducts, currentPage, MANAGE_STOCK_PAGE_SIZE),
    [filteredProducts, currentPage],
  );
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(pagination.page, pagination.pageCount),
    [pagination.page, pagination.pageCount],
  );
  const productCountLabel = `${filteredProducts.length} producto${filteredProducts.length === 1 ? '' : 's'}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [lowStockOnly, searchQuery]);

  useEffect(() => {
    if (currentPage > pagination.pageCount) {
      setCurrentPage(pagination.pageCount);
    }
  }, [currentPage, pagination.pageCount]);

  return (
    <ScreenContent title="Gestionar stock">
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, escanea y actualiza tu inventario"
        title="Gestionar stock"
      />
      <SearchFilterRow
        onChangeText={setSearchQuery}
        onPressCamera={props.onScanCode}
        searchValue={searchQuery}
      />
      <Pressable
        onPress={() => setLowStockOnly((current) => !current)}
        style={[styles.filterChip, lowStockOnly && styles.filterChipActive]}
      >
        <Text style={[styles.filterChipText, lowStockOnly && styles.filterChipTextActive]}>
          Bajo stock
        </Text>
      </Pressable>
      {props.errorMessage ? <InfoBanner>{props.errorMessage}</InfoBanner> : null}
      <ListBox headerMeta={productCountLabel} title="Productos en inventario">
        {props.isLoading ? (
          <Text style={styles.loadingText}>Cargando inventario...</Text>
        ) : products.length === 0 ? (
          <Text style={styles.loadingText}>No hay productos cargados en esta sucursal.</Text>
        ) : filteredProducts.length === 0 ? (
          <Text style={styles.loadingText}>
            {lowStockOnly
              ? 'No hay productos con bajo stock.'
              : 'No se encontraron productos para esta busqueda.'}
          </Text>
        ) : (
          <>
            {pagination.items.map((product, index) => (
              <InventoryListRow
                key={product.id}
                isLast={index === pagination.items.length - 1}
                onAddStock={() => props.onAddStockProduct(product.id)}
                onDelete={() => props.onDeleteProduct(product.id)}
                onEdit={() => props.onEditProduct(product.id)}
                onPress={() => props.onOpenProductDetail(product.id)}
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
      <Pressable onPress={props.onAddProduct} style={styles.addProductCard} disabled={!props.onAddProduct}>
        <View style={styles.addProductIcon}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.addProductTitle}>Agregar nuevo producto</Text>
          <Text style={styles.addProductSubtitle}>Crea productos base y genera codigos</Text>
        </View>
        <Icon color={colors.primary} kind="chevron-right" size={14} strokeWidth={2.2} />
      </Pressable>
    </ScreenContent>
  );
}

function AddSubproductLinkButton(props: { onPress: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={styles.addSubproductButton}>
      <Text style={styles.addSubproductButtonText}>+ Agregar subproducto</Text>
    </Pressable>
  );
}

export function AddProductScreen(props: {
  businessCenterId: string;
  businessCenters: Array<{ id: string; name: string }>;
  categories: string[];
  isSaving?: boolean;
  onBack: () => void;
  onSave: (values: AddProductFormValues) => Promise<void>;
  onSaveAndAddAnother: (values: AddProductFormValues) => Promise<void>;
  suppliers: string[];
}): ReactElement {
  const [formValues, setFormValues] = useState<AddProductFormValues>(() =>
    createEmptyAddProductForm(props.businessCenterId),
  );
  const lotPreview = useMemo(
    () => previewLotCode(formValues.receivedDate, []),
    [formValues.receivedDate],
  );
  const initialStock = Number.parseInt(formValues.stockQuantity.trim(), 10);
  const showLotFields = Number.isInteger(initialStock) && initialStock > 0;

  const categoryOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.categories.map((category) => ({ label: category, value: category })),
      ),
    [props.categories],
  );

  const branchOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.businessCenters.map((center) => ({ label: center.name, value: center.id })),
      ),
    [props.businessCenters],
  );

  async function handleSave(addAnother: boolean): Promise<void> {
    const payload = { ...formValues, productType: 'producto' as const, parentProductId: '' };

    try {
      if (addAnother) {
        await props.onSaveAndAddAnother(payload);
        setFormValues(createEmptyAddProductForm(props.businessCenterId));
      } else {
        await props.onSave(payload);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle="Completa los datos del producto y el stock inicial"
        title="Nuevo producto"
      />
      <ProductSummaryCard changePhoto title={formValues.name || 'Nuevo producto'} />
      <SectionCard>
        <InventoryTextField
          full
          label="Nombre del producto"
          onChangeText={(name) => setFormValues((current) => ({ ...current, name }))}
          value={formValues.name}
        />
        <View style={styles.fieldRow}>
          <InventorySelectField
            highlight
            label="Estado"
            onChange={(status: ProductStatusSlug) =>
              setFormValues((current) => ({ ...current, status }))
            }
            options={PRODUCT_STATUS_OPTIONS}
            value={formValues.status}
          />
          {categoryOptions.length > 0 ? (
            <InventorySelectField
              label="Categoria"
              onChange={(category) => setFormValues((current) => ({ ...current, category }))}
              options={categoryOptions}
              value={formValues.category}
            />
          ) : (
            <InventoryTextField
              label="Categoria"
              onChangeText={(category) => setFormValues((current) => ({ ...current, category }))}
              value={formValues.category}
            />
          )}
        </View>
        <View style={styles.fieldRow}>
          <InventorySelectField
            label="Unidad"
            onChange={(baseUnitCode) => setFormValues((current) => ({ ...current, baseUnitCode }))}
            options={BASE_UNIT_OPTIONS}
            value={formValues.baseUnitCode}
          />
          <InventoryReadOnlyField label="SKU" value="Se genera al guardar" />
        </View>
        <View style={styles.fieldRow}>
          <InventoryMoneyField
            label="Costo"
            onChangeText={(cost) =>
              setFormValues((current) => applyAddProductCost({ ...current, cost }))
            }
            value={formValues.cost}
          />
          <InventoryMoneyField
            label="Precio de venta"
            onChangeText={(unitPrice) =>
              setFormValues((current) => applyAddProductUnitPrice({ ...current, unitPrice }))
            }
            value={formValues.unitPrice}
          />
          <InventoryPercentField
            label="Margen"
            onChangeText={(marginPercent) =>
              setFormValues((current) => applyAddProductMargin({ ...current, marginPercent }))
            }
            value={formValues.marginPercent}
          />
        </View>
        <InventorySupplierField
          full
          label="Proveedor"
          onChangeText={(supplier) => setFormValues((current) => ({ ...current, supplier }))}
          suggestions={props.suppliers}
          value={formValues.supplier}
        />
      </SectionCard>
      <Text style={styles.sectionLabel}>Stock inicial</Text>
      <SectionCard>
        <View style={styles.fieldRow}>
          <InventoryIntegerField
            label="Cantidad"
            onChangeText={(stockQuantity) =>
              setFormValues((current) => ({ ...current, stockQuantity }))
            }
            value={formValues.stockQuantity}
          />
          <InventoryIntegerField
            label="Umbral reorden"
            onChangeText={(reorderThreshold) =>
              setFormValues((current) => ({ ...current, reorderThreshold }))
            }
            value={formValues.reorderThreshold}
          />
        </View>
        <InventoryReadOnlyField
          full
          label="Sucursal"
          value={
            branchOptions.find((option) => option.value === formValues.businessCenterId)?.label ??
            'Sucursal principal'
          }
        />
        {showLotFields ? (
          <View style={styles.fieldRow}>
            <InventoryDateField
              label="Fecha de lote"
              onChange={(receivedDate) => setFormValues((current) => ({ ...current, receivedDate }))}
              value={formValues.receivedDate}
            />
            <InventoryDateField
              label="Vencimiento"
              onChange={(expiresDate) => setFormValues((current) => ({ ...current, expiresDate }))}
              value={formValues.expiresDate}
            />
            <InventoryReadOnlyField label="Lote" value={lotPreview} />
          </View>
        ) : null}
        <InventoryTextField
          full
          label="Notas"
          multiline
          onChangeText={(description) => setFormValues((current) => ({ ...current, description }))}
          value={formValues.description}
        />
      </SectionCard>
      <InfoBanner>
        Para agregar presentaciones derivadas, guarda el producto y usa Agregar subproducto en su
        ficha o desde editar producto.
      </InfoBanner>
      <Pressable
        disabled={props.isSaving}
        onPress={() => {
          void handleSave(true);
        }}
        style={[styles.addStockSaveAnotherButton, props.isSaving && styles.disabledButton]}
      >
        <Icon color={colors.primary} kind="plus" size={14} strokeWidth={2} />
        <Text style={styles.addStockSaveAnotherButtonText}>
          {props.isSaving ? 'Guardando...' : 'Guardar y agregar otro producto'}
        </Text>
      </Pressable>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={props.isSaving ? 'Guardando...' : 'Guardar producto'}
          onPress={() => {
            void handleSave(false);
          }}
        />
      </View>
    </ScreenContent>
  );
}

export function AddSubproductScreen(props: {
  businessCenterId: string;
  businessCenters: Array<{ id: string; name: string }>;
  categories: string[];
  isSaving?: boolean;
  onBack: () => void;
  onSave: (values: AddProductFormValues) => Promise<void>;
  onSaveAndAddAnother: (values: AddProductFormValues) => Promise<void>;
  parentProduct: Product;
}): ReactElement {
  const [formValues, setFormValues] = useState<AddProductFormValues>(() =>
    createEmptyAddSubproductForm(props.parentProduct, props.businessCenterId),
  );
  const lotPreview = useMemo(
    () => previewLotCode(formValues.receivedDate, []),
    [formValues.receivedDate],
  );
  const initialStock = Number.parseInt(formValues.stockQuantity.trim(), 10);
  const showLotFields = Number.isInteger(initialStock) && initialStock > 0;
  const parentStock = formatProductStockLabel(props.parentProduct);
  const parentUnit = props.parentProduct.unitCode ?? props.parentProduct.baseUnitCode ?? 'unit';

  const branchOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.businessCenters.map((center) => ({ label: center.name, value: center.id })),
      ),
    [props.businessCenters],
  );

  useEffect(() => {
    if (!formValues.baseUnitEquivalent.trim()) {
      return;
    }

    const scaled = scalePricingFromParentProduct(
      props.parentProduct,
      formValues.baseUnitEquivalent,
    );

    setFormValues((current) => ({
      ...current,
      ...scaled,
    }));
  }, [formValues.baseUnitEquivalent, props.parentProduct]);

  async function handleSave(addAnother: boolean): Promise<void> {
    const payload = {
      ...formValues,
      parentProductId: props.parentProduct.id,
      productType: 'subproducto' as const,
    };

    try {
      if (addAnother) {
        await props.onSaveAndAddAnother(payload);
        setFormValues(createEmptyAddSubproductForm(props.parentProduct, props.businessCenterId));
      } else {
        await props.onSave(payload);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle="Presentacion derivada del producto base"
        title="Nuevo subproducto"
      />
      <ProductSummaryCard
        changePhoto
        linkedTo={props.parentProduct.name}
        title={formValues.name || 'Nuevo subproducto'}
      />
      <SectionCard>
        <InventoryReadOnlyField full label="Producto base" value={props.parentProduct.name} />
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField label="Stock base" value={parentStock} />
          <InventoryReadOnlyField label="Unidad base" value={parentUnit} />
        </View>
      </SectionCard>
      <SectionCard>
        <InventoryTextField
          full
          label="Nombre del subproducto"
          onChangeText={(name) => setFormValues((current) => ({ ...current, name }))}
          value={formValues.name}
        />
        <View style={styles.fieldRow}>
          <InventorySelectField
            highlight
            label="Estado"
            onChange={(status: ProductStatusSlug) =>
              setFormValues((current) => ({ ...current, status }))
            }
            options={PRODUCT_STATUS_OPTIONS}
            value={formValues.status}
          />
          <InventoryReadOnlyField label="Categoria" value={formValues.category || 'Sin categoria'} />
        </View>
        <View style={styles.fieldRow}>
          <InventoryDecimalField
            label="Equiv. unidad base"
            onChangeText={(baseUnitEquivalent) =>
              setFormValues((current) => ({ ...current, baseUnitEquivalent }))
            }
            placeholder="1"
            value={formValues.baseUnitEquivalent}
          />
          <InventorySelectField
            label="Unidad"
            onChange={(baseUnitCode) => setFormValues((current) => ({ ...current, baseUnitCode }))}
            options={BASE_UNIT_OPTIONS}
            value={formValues.baseUnitCode}
          />
        </View>
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField label="Costo" value={`$${formValues.cost}`} />
          <InventoryMoneyField
            label="Precio de venta"
            onChangeText={(unitPrice) =>
              setFormValues((current) => applyAddProductUnitPrice({ ...current, unitPrice }))
            }
            value={formValues.unitPrice}
          />
          <InventoryPercentField
            label="Margen"
            onChangeText={(marginPercent) =>
              setFormValues((current) => applyAddProductMargin({ ...current, marginPercent }))
            }
            value={formValues.marginPercent}
          />
        </View>
        <InventoryReadOnlyField
          full
          label="Proveedor"
          value={
            typeof props.parentProduct.metadata.proveedor === 'string' &&
            props.parentProduct.metadata.proveedor.trim().length > 0
              ? props.parentProduct.metadata.proveedor
              : 'Heredado del producto base'
          }
        />
        <InventoryReadOnlyField full label="SKU" value="Se genera al guardar" />
      </SectionCard>
      <Text style={styles.sectionLabel}>Stock inicial</Text>
      <SectionCard>
        <View style={styles.fieldRow}>
          <InventoryIntegerField
            label="Cantidad"
            onChangeText={(stockQuantity) =>
              setFormValues((current) => ({ ...current, stockQuantity }))
            }
            value={formValues.stockQuantity}
          />
          <InventoryIntegerField
            label="Umbral reorden"
            onChangeText={(reorderThreshold) =>
              setFormValues((current) => ({ ...current, reorderThreshold }))
            }
            value={formValues.reorderThreshold}
          />
        </View>
        <InventoryReadOnlyField
          full
          label="Sucursal"
          value={
            branchOptions.find((option) => option.value === formValues.businessCenterId)?.label ??
            'Sucursal principal'
          }
        />
        {showLotFields ? (
          <View style={styles.fieldRow}>
            <InventoryDateField
              label="Fecha de lote"
              onChange={(receivedDate) => setFormValues((current) => ({ ...current, receivedDate }))}
              value={formValues.receivedDate}
            />
            <InventoryDateField
              label="Vencimiento"
              onChange={(expiresDate) => setFormValues((current) => ({ ...current, expiresDate }))}
              value={formValues.expiresDate}
            />
            <InventoryReadOnlyField label="Lote" value={lotPreview} />
          </View>
        ) : null}
      </SectionCard>
      <InfoBanner>
        El costo y proveedor se calculan desde {props.parentProduct.name} segun la equivalencia
        configurada.
      </InfoBanner>
      <Pressable
        disabled={props.isSaving}
        onPress={() => {
          void handleSave(true);
        }}
        style={[styles.addStockSaveAnotherButton, props.isSaving && styles.disabledButton]}
      >
        <Icon color={colors.primary} kind="plus" size={14} strokeWidth={2} />
        <Text style={styles.addStockSaveAnotherButtonText}>
          {props.isSaving ? 'Guardando...' : 'Guardar y agregar otro subproducto'}
        </Text>
      </Pressable>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={props.isSaving ? 'Guardando...' : 'Guardar subproducto'}
          onPress={() => {
            void handleSave(false);
          }}
        />
      </View>
    </ScreenContent>
  );
}

export function ProductDetailScreen(
  props: InventoryNav & {
    batchRows?: typeof batches;
    businessCenterName?: string | null;
    movements?: typeof movements;
    onBack: () => void;
    onOpenProductCode?: () => void;
    parentProduct?: Product | null;
    product?: Product | null;
    childProducts?: Product[];
  },
): ReactElement {
  const product = props.product;
  const childProducts = props.childProducts ?? [];
  const productName = product?.name ?? baseProduct.name;
  const productStock = product ? formatProductStockLabel(product) : baseProduct.stock;
  const productCategory = product?.category ?? baseProduct.category;
  const productNotes = product ? (product.description ?? '') : baseProduct.notes;
  const summaryMeta = product
    ? buildProductSummaryMeta(product, props.businessCenterName, props.parentProduct, childProducts)
    : undefined;
  const productStatus = product ? getProductStatusLabel(product) : 'En stock';
  const productStatusTone = product?.isLowStock ? 'orange' : 'green';
  const codeLabel = product ? getProductCodeTypeLabel(product) : 'Codigo de barras';
  const codeValue = product ? readProductCodeValue(product) : baseProduct.code;
  const codeUnavailable = product ? isProductCodeUnavailable(product) : false;
  const displayChildRows = product
    ? childProducts.map((item) => mapProductToInventoryRow(item, { indent: true }))
    : subproducts.map((item) => subproductAsInventoryRow(item));
  const batchRows = props.batchRows ?? (product ? [] : batches);
  const movementRows = props.movements ?? (product ? [] : movements);
  const isBaseProduct = product?.parentProductId == null;
  const showSubproductsSection = Boolean(product && isBaseProduct && isGranelProduct(product));

  return (
    <ScreenContent title={productName}>
      <InventoryScreenTitle
        onBack={props.onBack}
        stickyTitle={productName}
        subtitle="Detalle y gestion del producto"
        title="Producto"
      />
      <ProductSummaryCard
        category={productCategory}
        meta={summaryMeta}
        showBarcode
        showMeta
        statusLabel={productStatus}
        statusTone={productStatusTone}
        stock={productStock}
        title={productName}
      />
      <View style={styles.actionBar}>
        <Pressable onPress={props.onOpenEditProduct} style={styles.actionItem}>
          <Icon color={colors.info} kind="edit" size={15} strokeWidth={2} />
          <Text style={[styles.actionLabel, styles.actionLabelInfo]}>Editar producto</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={props.onAddStock} style={styles.actionItem}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
          <Text style={styles.actionLabel}>Agregar stock</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={props.onOpenDeleteProduct} style={styles.actionItem}>
          <Icon color={colors.danger} kind="trash" size={15} strokeWidth={1.8} />
          <Text style={[styles.actionLabel, styles.dangerText]}>Eliminar</Text>
        </Pressable>
      </View>
      {showSubproductsSection ? (
        <ListBox
          headerRight={<AddSubproductLinkButton onPress={props.onOpenAddSubproduct} />}
          headerSubtitle="Presentaciones creadas a partir de este producto."
          title="Subproductos"
        >
          {displayChildRows.length > 0 ? (
            displayChildRows.map((item, index) => (
              <InventoryListRow
                key={item.id}
                isLast={index === displayChildRows.length - 1}
                onAddStock={() => props.onAddStockForProduct(item.id)}
                onDelete={() => props.onDeleteProductById(item.id)}
                onEdit={() => props.onOpenEditSubproduct(item.id)}
                onPress={() => props.onOpenProductDetail(item.id)}
                product={item}
              />
            ))
          ) : (
            <View style={styles.listBoxEmptyState}>
              <Text style={styles.rowMeta}>Todavia no hay subproductos para este producto base.</Text>
            </View>
          )}
        </ListBox>
      ) : null}
      <SectionCard subtitle="Seguimiento de costo y precio por ingreso." title="Lotes y precios">
        {batchRows.length > 0 ? (
          <>
            <View style={styles.batchTable}>
              <View style={styles.batchHeader}>
                <View style={styles.batchColMain} />
                <Text style={styles.batchHeaderLabel}>Costo / Precio</Text>
                <Text style={styles.batchHeaderStatus}>Estado</Text>
              </View>
              {batchRows.map((batch) => (
                <View key={batch.id} style={styles.batchRow}>
                  <View style={styles.batchColMain}>
                    <Text style={styles.rowTitle}>{batch.lot}</Text>
                    <Text style={styles.rowMeta}>{batch.date}</Text>
                    <Text style={styles.batchQty}>{batch.qty}</Text>
                  </View>
                  <Text style={styles.batchCostPrice}>
                    {batch.cost} <Text style={styles.rowMeta}>/</Text> {batch.price}
                  </Text>
                  <View style={styles.batchStatusCol}>
                    <StockBadge
                      label={batch.status}
                      tone={batch.statusTone === 'green' ? 'green' : 'neutral'}
                    />
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.footerNote}>Precio actual actualizado segun el ultimo lote.</Text>
          </>
        ) : (
          <Text style={styles.rowMeta}>Sin lotes registrados para este producto.</Text>
        )}
      </SectionCard>
      <SectionCard title="Movimientos recientes">
        {movementRows.length > 0 ? (
          movementRows.map((movement) => (
            <View key={movement.id} style={styles.movementRow}>
              <View style={[styles.movementIcon, movementToneStyle(movement.tone)]}>
                <Text style={styles.movementSymbol}>{movement.tone === 'green' ? '↓' : movement.tone === 'red' ? '↑' : '$'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{movement.label}</Text>
                <Text style={styles.rowMeta}>{movement.time}</Text>
              </View>
              {movement.amount ? (
                <Text style={movement.tone === 'green' ? styles.movementAmountGreen : styles.movementAmountRed}>
                  {movement.amount}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.rowMeta}>Sin movimientos recientes para este producto.</Text>
        )}
      </SectionCard>
      <SectionCard title="Codigo asociado">
        <View style={styles.barcodeRow}>
          <Icon
            color={codeUnavailable ? colors.danger : colors.navy}
            kind={product && readProductCodeType(product) === 'qr' ? 'qr' : 'barcode'}
            size={18}
            strokeWidth={1}
          />
          <View>
            <Text style={[styles.codeValue, codeUnavailable && styles.dangerText]}>{codeValue}</Text>
            <Text style={styles.rowMeta}>{codeLabel}</Text>
          </View>
        </View>
        <Pressable onPress={props.onOpenProductCode} style={styles.outlineLink}>
          <Text style={styles.outlineLinkText}>Gestionar codigo</Text>
          <Icon color={colors.primary} kind="chevron-right" size={14} strokeWidth={2.2} />
        </Pressable>
      </SectionCard>
      <SectionCard title="Notas">
        <Text style={styles.rowMeta}>{productNotes || 'Sin notas cargadas.'}</Text>
      </SectionCard>
    </ScreenContent>
  );
}

export function EditProductScreen(
  props: {
    businessCenterId: string;
    businessCenterName?: string | null;
    businessCenters: Array<{ id: string; name: string }>;
    categories: string[];
    isSaving?: boolean;
    onBack: () => void;
    onOpenDeleteProduct: () => void;
    onOpenAddSubproduct: () => void;
    onOpenEditSubproduct: (subproductId: string) => void;
    onOpenSubproductDetail: (subproductId: string) => void;
    onSave: (values: ProductEditFormValues) => Promise<void>;
    product: Product;
    readOnly?: boolean;
    subproducts?: Product[];
    title?: string;
  },
): ReactElement {
  const childProducts = props.subproducts ?? [];
  const readOnly = props.readOnly ?? false;
  const [formValues, setFormValues] = useState<ProductEditFormValues>(() =>
    productToEditFormValues(props.product, props.businessCenterId),
  );

  useEffect(() => {
    const nextValues = productToEditFormValues(props.product, props.businessCenterId);
    setFormValues(
      readOnly
        ? {
            ...nextValues,
            status: 'archivado',
          }
        : nextValues,
    );
  }, [props.businessCenterId, props.product.id, readOnly]);

  const categoryOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.categories.map((category) => ({ label: category, value: category })),
      ),
    [props.categories],
  );

  const branchOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.businessCenters.map((center) => ({ label: center.name, value: center.id })),
      ),
    [props.businessCenters],
  );

  async function handleSave(): Promise<void> {
    try {
      await props.onSave(formValues);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle={
          readOnly
            ? 'Revisa la informacion antes de archivar el producto'
            : 'Actualiza la informacion del producto'
        }
        title={props.title ?? (readOnly ? 'Archivar producto' : 'Editar producto')}
      />
      <ProductSummaryCard
        badge={childProducts.length > 0 ? 'Producto con subproductos' : undefined}
        changePhoto={!readOnly}
        title={formValues.name}
      />
      <SectionCard>
        {readOnly ? (
          <InventoryReadOnlyField full label="Nombre del producto" value={formValues.name} />
        ) : (
          <InventoryTextField
            full
            label="Nombre del producto"
            onChangeText={(name) => setFormValues((current) => ({ ...current, name }))}
            value={formValues.name}
          />
        )}
        <View style={styles.fieldRow}>
          {readOnly ? (
            <>
              <InventoryReadOnlyField
                label="Estado"
                value={getProductStatusLabel({ ...props.product, metadata: { ...props.product.metadata, estado: 'archivado' } })}
              />
              <InventoryReadOnlyField label="Categoria" value={formValues.category} />
            </>
          ) : (
            <>
              <InventorySelectField
                highlight
                label="Estado"
                onChange={(status: ProductStatusSlug) =>
                  setFormValues((current) => ({ ...current, status }))
                }
                options={PRODUCT_STATUS_OPTIONS}
                value={formValues.status}
              />
              <InventorySelectField
                label="Categoria"
                onChange={(category) => setFormValues((current) => ({ ...current, category }))}
                options={categoryOptions}
                value={formValues.category}
              />
            </>
          )}
        </View>
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField label="SKU" value={props.product.sku ?? 'Generado por la app'} />
          {readOnly ? (
            <InventoryReadOnlyField label="Unidad base" value={formValues.baseUnitCode} />
          ) : (
            <InventorySelectField
              label="Unidad base"
              onChange={(baseUnitCode) => setFormValues((current) => ({ ...current, baseUnitCode }))}
              options={BASE_UNIT_OPTIONS}
              value={formValues.baseUnitCode}
            />
          )}
        </View>
        <View style={styles.fieldRow}>
          {readOnly ? (
            <>
              <InventoryReadOnlyField label="Costo" value={`$${formValues.cost}`} />
              <InventoryReadOnlyField label="Precio de venta" value={`$${formValues.unitPrice}`} />
              <InventoryReadOnlyField label="Margen" value={`${formValues.marginPercent}%`} />
            </>
          ) : (
            <>
              <InventoryMoneyField
                label="Costo"
                onChangeText={(cost) =>
                  setFormValues((current) => applyCostToFormValues({ ...current, cost }))
                }
                value={formValues.cost}
              />
              <InventoryMoneyField
                label="Precio de venta"
                onChangeText={(unitPrice) =>
                  setFormValues((current) => applyUnitPriceToFormValues({ ...current, unitPrice }))
                }
                value={formValues.unitPrice}
              />
              <InventoryPercentField
                label="Margen"
                onChangeText={(marginPercent) =>
                  setFormValues((current) => applyMarginToFormValues({ ...current, marginPercent }))
                }
                value={formValues.marginPercent}
              />
            </>
          )}
        </View>
        <InventoryReadOnlyField
          full
          label="Sucursal"
          value={
            branchOptions.find((option) => option.value === formValues.businessCenterId)?.label ??
            props.businessCenterName ??
            'Sucursal principal'
          }
        />
        {readOnly ? (
          <InventoryReadOnlyField full label="Notas" value={formValues.description || 'Sin notas'} />
        ) : (
          <InventoryTextField
            full
            label="Notas"
            multiline
            onChangeText={(description) => setFormValues((current) => ({ ...current, description }))}
            value={formValues.description}
          />
        )}
      </SectionCard>
      {readOnly || props.product.parentProductId != null || !isGranelProduct(props.product) ? null : (
        <View style={styles.subproductSection}>
          <View style={styles.subproductSectionHeader}>
            <View style={styles.flex}>
              <Text style={styles.subproductSectionTitle}>Subproductos</Text>
              <Text style={styles.subproductSectionSubtitle}>
                Estos productos usan el stock y el costo del producto base.
              </Text>
            </View>
            <AddSubproductLinkButton onPress={props.onOpenAddSubproduct} />
          </View>
          {childProducts.length > 0
            ? childProducts.map((item, index) => (
                <InventoryListRow
                  key={item.id}
                  isLast={index === childProducts.length - 1}
                  onEdit={() => props.onOpenEditSubproduct(item.id)}
                  onPress={() => props.onOpenSubproductDetail(item.id)}
                  product={mapProductToInventoryRow(item, { indent: true })}
                />
              ))
            : (
              <View style={styles.listBoxEmptyState}>
                <Text style={styles.rowMeta}>Todavia no hay subproductos para este producto base.</Text>
              </View>
            )}
        </View>
      )}
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={
            props.isSaving
              ? 'Guardando...'
              : readOnly
                ? 'Archivar producto'
                : 'Guardar cambios'
          }
          onPress={() => {
            void handleSave();
          }}
        />
      </View>
      {readOnly ? null : (
        <DangerButton label="Eliminar producto" onPress={props.onOpenDeleteProduct} />
      )}
    </ScreenContent>
  );
}

export function EditSubproductScreen(
  props: {
    businessCenterId: string;
    businessCenterName?: string | null;
    businessCenters: Array<{ id: string; name: string }>;
    categories: string[];
    isSaving?: boolean;
    onBack: () => void;
    onSave: (values: ProductEditFormValues) => Promise<void>;
    parentProduct?: Product | null;
    subproduct: Product;
  },
): ReactElement {
  const parentProduct = props.parentProduct;
  const parentName = parentProduct?.name ?? baseProduct.name;
  const parentStock = parentProduct ? formatProductStockLabel(parentProduct) : baseProduct.stock;
  const [formValues, setFormValues] = useState<ProductEditFormValues>(() =>
    productToEditFormValues(props.subproduct, props.businessCenterId),
  );

  useEffect(() => {
    setFormValues(productToEditFormValues(props.subproduct, props.businessCenterId));
  }, [props.businessCenterId, props.subproduct.id]);

  useEffect(() => {
    if (!parentProduct || props.subproduct.baseUnitEquivalent == null) {
      return;
    }

    const scaled = scalePricingFromParentProduct(
      parentProduct,
      props.subproduct.baseUnitEquivalent.toString(),
    );

    setFormValues((current) => ({
      ...current,
      ...scaled,
      category: parentProduct.category ?? current.category,
    }));
  }, [parentProduct, props.subproduct.baseUnitEquivalent]);

  const branchOptions = useMemo(
    () =>
      sortOptionsAlphabetically(
        props.businessCenters.map((center) => ({ label: center.name, value: center.id })),
      ),
    [props.businessCenters],
  );

  async function handleSave(): Promise<void> {
    try {
      await props.onSave(formValues);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle="Actualiza la informacion del subproducto"
        title="Editar subproducto"
      />
      <ProductSummaryCard changePhoto linkedTo={parentName} title={formValues.name} />
      <InfoBanner>
        Este subproducto pertenece a {parentName}. La categoria y el costo se obtienen del producto
        base segun la equivalencia configurada.
      </InfoBanner>
      <SectionCard>
        <InventoryTextField
          full
          label="Nombre del producto"
          onChangeText={(name) => setFormValues((current) => ({ ...current, name }))}
          value={formValues.name}
        />
        <View style={styles.fieldRow}>
          <InventorySelectField
            highlight
            label="Estado"
            onChange={(status: ProductStatusSlug) =>
              setFormValues((current) => ({ ...current, status }))
            }
            options={PRODUCT_STATUS_OPTIONS}
            value={formValues.status}
          />
          <InventoryReadOnlyField
            label="Categoria"
            value={formValues.category || 'Sin categoria'}
          />
        </View>
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField
            label="SKU"
            value={props.subproduct.sku ?? 'Generado por la app'}
          />
          <InventorySelectField
            label="Unidad base"
            onChange={(baseUnitCode) => setFormValues((current) => ({ ...current, baseUnitCode }))}
            options={BASE_UNIT_OPTIONS}
            value={formValues.baseUnitCode}
          />
        </View>
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField label="Costo" value={`$${formValues.cost}`} />
          <InventoryMoneyField
            label="Precio de venta"
            onChangeText={(unitPrice) =>
              setFormValues((current) => applyUnitPriceToFormValues({ ...current, unitPrice }))
            }
            value={formValues.unitPrice}
          />
          <InventoryPercentField
            label="Margen"
            onChangeText={(marginPercent) =>
              setFormValues((current) => applyMarginToFormValues({ ...current, marginPercent }))
            }
            value={formValues.marginPercent}
          />
        </View>
        <InventoryReadOnlyField
          full
          label="Sucursal"
          value={
            branchOptions.find((option) => option.value === formValues.businessCenterId)?.label ??
            'Sucursal principal'
          }
        />
        <InventoryTextField
          full
          label="Notas"
          multiline
          onChangeText={(description) => setFormValues((current) => ({ ...current, description }))}
          value={formValues.description}
        />
      </SectionCard>
      <SectionCard title="Relacion con producto base">
        <View style={styles.infoBlockRow}>
          <InfoBlock label="Producto base" value={parentName} />
          <InfoBlock
            label="Conversion"
            value={formatSubproductBaseConversion(props.subproduct, props.parentProduct ?? null)}
          />
          <InfoBlock label="Stock disponible del base" value={parentStock} />
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={props.isSaving ? 'Guardando...' : 'Guardar cambios'}
          onPress={() => {
            void handleSave();
          }}
        />
      </View>
    </ScreenContent>
  );
}

function linkedProductStockLabel(item: Product | SubproductMock): string {
  if ('stockQuantity' in item) {
    return formatProductStockLabel(item);
  }

  return item.stock;
}

export function AddStockScreen(props: {
  catalogProducts: Product[];
  defaultSelectedProductId: string;
  isSaving?: boolean;
  onBack: () => void;
  onSave: (values: AddStockFormValues) => Promise<void>;
  onSaveAndGoToManageStock: (values: AddStockFormValues) => Promise<void>;
  selectableProducts: Product[];
  showProductSelection: boolean;
}): ReactElement {
  const [selectedProductId, setSelectedProductId] = useState(props.defaultSelectedProductId);
  const selectedProduct =
    props.catalogProducts.find((item) => item.id === selectedProductId) ??
    props.selectableProducts.find((item) => item.id === selectedProductId) ??
    props.selectableProducts[0];
  const [formValues, setFormValues] = useState<AddStockFormValues>(() =>
    selectedProduct
      ? productToAddStockFormValues(selectedProduct, selectedProduct.id)
      : {
          cost: '0.00',
          marginPercent: '0',
          quantity: '',
          receivedDate: '',
          supplier: '',
          targetProductId: props.defaultSelectedProductId,
          unitCode: 'unit',
          unitPrice: '0.00',
        },
  );
  const lotPreview = useMemo(
    () => previewLotCode(formValues.receivedDate, []),
    [formValues.receivedDate],
  );
  const parentProduct = useMemo(() => {
    if (!selectedProduct?.parentProductId) {
      return null;
    }

    return (
      props.catalogProducts.find((item) => item.id === selectedProduct.parentProductId) ??
      props.selectableProducts.find((item) => item.id === selectedProduct.parentProductId) ??
      null
    );
  }, [props.catalogProducts, props.selectableProducts, selectedProduct]);
  const parentDeductionMessage = useMemo(() => {
    if (!selectedProduct?.parentProductId || !parentProduct) {
      return null;
    }

    const quantity = Number.parseInt(formValues.quantity.trim(), 10);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }

    const deduction = computeParentStockDeduction(quantity, selectedProduct);

    if (deduction == null) {
      return 'Este subproducto no tiene equivalencia configurada con el producto base.';
    }

    const parentUnit = parentProduct.unitCode ?? parentProduct.baseUnitCode ?? 'unit';
    const formattedDeduction = Number.isInteger(deduction)
      ? deduction.toString()
      : deduction.toFixed(3).replace(/\.?0+$/, '');

    return `Se descontaran ${formattedDeduction} ${parentUnit} del stock de ${parentProduct.name}.`;
  }, [formValues.quantity, parentProduct, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    setFormValues(
      productToAddStockFormValues(selectedProduct, selectedProduct.id, parentProduct),
    );
  }, [parentProduct, selectedProduct]);

  async function handleSave(saveAndContinue: boolean): Promise<void> {
    const payload = {
      ...formValues,
      targetProductId: selectedProduct?.id ?? formValues.targetProductId,
    };

    try {
      if (saveAndContinue) {
        await props.onSaveAndGoToManageStock(payload);
      } else {
        await props.onSave(payload);
      }
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  if (!selectedProduct) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={props.onBack}
          subtitle="Registra ingresos para el producto base o sus subproductos"
          title="Agregar stock"
        />
        <Text>Producto no encontrado.</Text>
      </ScreenContent>
    );
  }

  const productStock = formatProductStockLabel(selectedProduct);
  const isSubproduct = selectedProduct.parentProductId != null;

  return (
    <ScreenContent>
      <InventoryScreenTitle
        onBack={props.onBack}
        subtitle="Registra ingresos para el producto base o sus subproductos"
        title="Agregar stock"
      />
      <ProductSummaryCard stock={productStock} title={selectedProduct.name} />
      {props.showProductSelection ? (
        <>
          <Text style={styles.sectionLabel}>A que producto queres agregar stock?</Text>
          {props.selectableProducts.map((item) => {
            const isBase = item.parentProductId === null;
            return (
              <RadioProductOption
                key={item.id}
                active={item.id === selectedProductId}
                meta={
                  isBase
                    ? `Producto base • Stock actual: ${formatProductStockLabel(item)}`
                    : `Stock actual: ${formatProductStockLabel(item)}`
                }
                name={item.name}
                onPress={() => setSelectedProductId(item.id)}
              />
            );
          })}
        </>
      ) : null}
      <Text style={styles.sectionLabel}>Detalle del ingreso</Text>
      <SectionCard>
        <View style={styles.fieldRow}>
          <InventoryIntegerField
            label="Cantidad a ingresar"
            onChangeText={(quantity) => setFormValues((current) => ({ ...current, quantity }))}
            value={formValues.quantity}
          />
          <InventoryReadOnlyField label="Unidad" value={formValues.unitCode} />
        </View>
        <View style={styles.fieldRow}>
          <InventoryMoneyField
            label="Costo"
            onChangeText={(cost) =>
              setFormValues((current) => applyAddStockCost(current, cost))
            }
            value={formValues.cost}
          />
          {isSubproduct ? (
            <>
              <InventoryMoneyField
                label="Precio de venta"
                onChangeText={(unitPrice) =>
                  setFormValues((current) => applyAddStockUnitPrice(current, unitPrice))
                }
                value={formValues.unitPrice}
              />
              <InventoryPercentField
                label="Margen"
                onChangeText={(marginPercent) =>
                  setFormValues((current) => applyAddStockMargin(current, marginPercent))
                }
                value={formValues.marginPercent}
              />
            </>
          ) : (
            <InventoryTextField
              label="Proveedor"
              onChangeText={(supplier) => setFormValues((current) => ({ ...current, supplier }))}
              value={formValues.supplier}
            />
          )}
        </View>
        {!isSubproduct ? (
          <View style={styles.fieldRow}>
            <InventoryMoneyField
              label="Precio de venta"
              onChangeText={(unitPrice) =>
                setFormValues((current) => applyAddStockUnitPrice(current, unitPrice))
              }
              value={formValues.unitPrice}
            />
            <InventoryPercentField
              label="Margen"
              onChangeText={(marginPercent) =>
                setFormValues((current) => applyAddStockMargin(current, marginPercent))
              }
              value={formValues.marginPercent}
            />
          </View>
        ) : null}
        <View style={styles.fieldRow}>
          <InventoryDateField
            label="Fecha de ingreso"
            onChange={(receivedDate) => setFormValues((current) => ({ ...current, receivedDate }))}
            value={formValues.receivedDate}
          />
          <InventoryReadOnlyField label="Lote" value={lotPreview} />
        </View>
      </SectionCard>
      {props.showProductSelection ? (
        <InfoBanner>
          {parentDeductionMessage ??
            'Si seleccionas un subproducto, el ingreso se registra sobre esa presentacion y descuenta stock del producto base.'}
        </InfoBanner>
      ) : parentDeductionMessage ? (
        <InfoBanner>{parentDeductionMessage}</InfoBanner>
      ) : null}
      <Pressable
        disabled={props.isSaving}
        onPress={() => {
          void handleSave(true);
        }}
        style={[styles.addStockSaveAnotherButton, props.isSaving && styles.disabledButton]}
      >
        <Icon color={colors.primary} kind="plus" size={14} strokeWidth={2} />
        <Text style={styles.addStockSaveAnotherButtonText}>
          {props.isSaving ? 'Guardando...' : 'Guardar y Registrar otro ingreso'}
        </Text>
      </Pressable>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={props.isSaving ? 'Guardando...' : 'Guardar ingreso'}
          onPress={() => {
            void handleSave(false);
          }}
        />
      </View>
    </ScreenContent>
  );
}

export function DeleteProductScreen(props: {
  isDeleting?: boolean;
  onBack: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  product?: Product | null;
  subproducts?: Product[];
}): ReactElement {
  const product = props.product;
  const childProducts = props.subproducts ?? (product ? [] : subproducts);
  const productName = product?.name ?? baseProduct.name;
  const productStock = product ? formatProductStockLabel(product) : baseProduct.stock;
  const hasLinkedSubproducts = childProducts.length > 0;
  const [confirmation, setConfirmation] = useState('');
  const [confirmFocused, setConfirmFocused] = useState(false);
  const canDelete = confirmation.trim().toUpperCase() === 'ELIMINAR';

  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Confirma si queres eliminar este producto" title="Eliminar producto" />
      <ProductSummaryCard showBarcode stock={productStock} title={productName} />
      <View style={styles.deleteWarningCard}>
        <View style={styles.deleteWarningHeader}>
          <Icon color={colors.danger} kind="alert" size={16} strokeWidth={1.8} />
          <Text style={styles.deleteWarningTitle}>Atencion</Text>
        </View>
        <Text style={styles.deleteWarningBody}>
          {hasLinkedSubproducts
            ? 'Al eliminar este producto base, tambien se veran afectados los subproductos vinculados y sus codigos asociados.'
            : 'Al eliminar este producto, se eliminara su stock y codigos asociados en esta sucursal.'}
        </Text>
        {hasLinkedSubproducts ? (
          <>
            <Text style={styles.deleteWarningSubtitle}>Subproductos vinculados</Text>
            {childProducts.map((item) => (
              <LinkedDeleteRow key={item.id} name={item.name} />
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.alternativeCard}>
        <View style={styles.alternativeIconWrap}>
          <Icon color={colors.primary} kind="lightbulb" size={18} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.alternativeTitle}>Alternativa recomendada</Text>
          <Text style={styles.alternativeBody}>Podes desactivar el producto para conservar historial y movimientos.</Text>
        </View>
        <Pressable onPress={props.onDeactivate} style={styles.deactivateButton}>
          <Text style={styles.deactivateButtonText}>Desactivar en su lugar</Text>
        </Pressable>
      </View>
      <SectionCard title="Confirmacion">
        <TextField
          autoCapitalize="characters"
          autoCorrect={false}
          focused={confirmFocused}
          label="Escribi ELIMINAR para confirmar"
          onBlur={() => setConfirmFocused(false)}
          onChangeText={setConfirmation}
          onFocus={() => setConfirmFocused(true)}
          placeholder="ELIMINAR"
          value={confirmation}
        />
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <SolidDangerButton
          disabled={!canDelete || props.isDeleting}
          label={props.isDeleting ? 'Eliminando...' : 'Eliminar producto'}
          onPress={canDelete ? props.onDelete : undefined}
        />
      </View>
      <Text style={styles.deleteFooterNote}>Esta accion no se puede deshacer.</Text>
    </ScreenContent>
  );
}

export function SellProductsScreen(
  props: {
    errorMessage?: string | null;
    initialSearchQuery?: string;
    isLoading?: boolean;
    onAddToCart: (productId: string) => void;
    onEditProduct: (productId: string) => void;
    onOpenConfirmPayment: () => void;
    onOpenProductDetail: (productId: string) => void;
    onScanCode?: () => void;
    products?: SellProductMock[];
  },
): ReactElement {
  const sellCart = useSellCart();
  const [searchQuery, setSearchQuery] = useState(props.initialSearchQuery ?? '');
  const [currentPage, setCurrentPage] = useState(1);
  const products = props.products ?? sellProducts;
  const filteredProducts = useMemo(
    () => filterSellProducts(products, searchQuery),
    [products, searchQuery],
  );
  const pagination = useMemo(
    () => paginateItems(filteredProducts, currentPage, SELL_PAGE_SIZE),
    [filteredProducts, currentPage],
  );
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(pagination.page, pagination.pageCount),
    [pagination.page, pagination.pageCount],
  );
  const productCountLabel = `${filteredProducts.length} producto${filteredProducts.length === 1 ? '' : 's'}`;
  const discountLabel = formatSaleDiscountLabel(sellCart.discountMode, Number.parseFloat(sellCart.discountInput.replace(',', '.')) || 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > pagination.pageCount) {
      setCurrentPage(pagination.pageCount);
    }
  }, [currentPage, pagination.pageCount]);

  async function handleSaveQuote(): Promise<void> {
    if (!sellCart.canSaveQuote) {
      return;
    }

    try {
      await sellCart.saveQuote();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  function renderCartLine(line: SellCartLine, index: number, inListCard = false): ReactElement {
    const view = mapCartLineToView(line);

    return (
      <CartLineRow
        gramsShowPlaceholder={view.gramsShowPlaceholder}
        gramsValue={view.gramsValue}
        inListCard={inListCard}
        isFirst={index === 0 && !inListCard}
        item={{
          id: line.id,
          name: line.name,
          price: view.lineTotal,
          qty: view.quantityLabel,
          weight: line.soldByWeight,
        }}
        key={line.id}
        onDecrease={() => sellCart.decreaseLineQuantity(line.id)}
        onGramsChange={(value) => sellCart.setLineGrams(line.id, value)}
        onGramsFocus={() => sellCart.focusLineGrams(line.id)}
        onIncrease={() => sellCart.increaseLineQuantity(line.id)}
        onRemove={() => sellCart.removeLine(line.id)}
      />
    );
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, agrega y cobra tus productos"
        title="Ventas"
      />
      <SearchFilterRow
        onChangeText={setSearchQuery}
        onPressCamera={props.onScanCode}
        searchValue={searchQuery}
      />
      {props.errorMessage ? <InfoBanner>{props.errorMessage}</InfoBanner> : null}
      <View style={styles.listCard}>
        <View style={styles.sellListHeader}>
          <Text style={styles.listHeaderMeta}>{productCountLabel}</Text>
        </View>
        {props.isLoading ? (
          <Text style={styles.loadingText}>Cargando productos...</Text>
        ) : filteredProducts.length === 0 ? (
          <Text style={styles.loadingText}>No se encontraron productos para esta busqueda.</Text>
        ) : (
          <>
            {pagination.items.map((product) => (
              <SellProductRow
                key={product.id}
                onAddToCart={() => props.onAddToCart(product.id)}
                onEdit={() => props.onEditProduct(product.id)}
                onPress={() => props.onOpenProductDetail(product.id)}
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
      </View>
      <SectionCard title="Cobrar y emitir factura">
        {sellCart.quoteMessage ? <InfoBanner>{sellCart.quoteMessage}</InfoBanner> : null}
        {sellCart.cart.length === 0 ? (
          <Text style={styles.rowMeta}>Agrega productos con + para iniciar una venta.</Text>
        ) : (
          sellCart.cart.map((line, index) => renderCartLine(line, index))
        )}
        <SaleTotalsBlock
          discountInput={sellCart.discountInput}
          discountLabel={discountLabel}
          discountMode={sellCart.discountMode}
          discountValue={formatSaleDiscountValue(sellCart.discountTotalCents)}
          onDiscountInputChange={sellCart.setDiscountInput}
          onDiscountModeChange={sellCart.setDiscountMode}
          subtotal={formatCurrency(sellCart.subtotalCents)}
          total={formatCurrency(sellCart.totalCents)}
          withDiscountControls
        />
        <View style={styles.fieldRow}>
          <FormField compactLabel label="Cliente" select value={DEFAULT_CLIENT_LABEL} />
          <FormField compactLabel label="Comprobante" select value={DEFAULT_RECEIPT_LABEL} />
        </View>
        <Text style={styles.paymentLabel}>Forma de pago</Text>
        <View style={styles.chipRow}>
          <PaymentChip active label="Efectivo" small />
          <PaymentChip disabled label="Tarjetas" small />
          <PaymentChip disabled label="Transferencia" small />
          <PaymentChip disabled label="QR" small />
        </View>
        <View style={styles.sellButtonRow}>
          <OutlineButton
            compact
            disabled={!sellCart.canSaveQuote}
            icon="bill"
            label="Guardar presupuesto"
            onPress={() => void handleSaveQuote()}
          />
          <CobrarButton onPress={props.onOpenConfirmPayment} />
        </View>
      </SectionCard>
    </ScreenContent>
  );
}

export function ConfirmPaymentScreen(props: {
  isConfirming?: boolean;
  onBack: () => void;
  onConfirmPayment?: () => Promise<void>;
}): ReactElement {
  const sellCart = useSellCart();
  const discountLabel = formatSaleDiscountLabel(
    sellCart.discountMode,
    Number.parseFloat(sellCart.discountInput.replace(',', '.')) || 0,
  );

  function renderCartLine(line: SellCartLine, index: number): ReactElement {
    const view = mapCartLineToView(line);

    return (
      <CartLineRow
        gramsShowPlaceholder={view.gramsShowPlaceholder}
        gramsValue={view.gramsValue}
        inListCard
        item={{
          id: line.id,
          name: line.name,
          price: view.lineTotal,
          qty: view.quantityLabel,
          weight: line.soldByWeight,
        }}
        key={line.id}
        onDecrease={() => sellCart.decreaseLineQuantity(line.id)}
        onGramsChange={(value) => sellCart.setLineGrams(line.id, value)}
        onGramsFocus={() => sellCart.focusLineGrams(line.id)}
        onIncrease={() => sellCart.increaseLineQuantity(line.id)}
        onRemove={() => sellCart.removeLine(line.id)}
      />
    );
  }

  async function handleSaveQuote(): Promise<void> {
    if (!sellCart.canSaveQuote) {
      return;
    }

    try {
      await sellCart.saveQuote();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  async function handleConfirmPayment(): Promise<void> {
    if (props.isConfirming) {
      return;
    }

    if (props.onConfirmPayment) {
      try {
        await props.onConfirmPayment();
      } catch (error) {
        Alert.alert(
          'No se pudo confirmar',
          error instanceof Error ? error.message : 'Error desconocido',
        );
      }
      return;
    }

    Alert.alert('Pago confirmado', 'La venta quedo registrada como cobrada.');
    sellCart.clearCart();
    props.onBack();
  }

  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Revisa los productos antes de confirmar el pago" title="Confirmar cobro" />
      {sellCart.quoteMessage ? <InfoBanner>{sellCart.quoteMessage}</InfoBanner> : null}
      <View style={styles.paymentStatusCard}>
        <Icon color={colors.warning} kind="clock" size={18} strokeWidth={1.8} />
        <View>
          <Text style={styles.paymentStatusTitle}>Estado del cobro</Text>
          <Text style={styles.paymentStatusSubtitle}>Pendiente de confirmacion manual</Text>
        </View>
      </View>
      <View style={styles.listCard}>
        <View style={styles.confirmListHeader}>
          <Text style={styles.confirmListTitle}>Resumen de la venta</Text>
        </View>
        {sellCart.cart.length === 0 ? (
          <Text style={styles.loadingText}>No hay productos en el carrito.</Text>
        ) : (
          sellCart.cart.map((line, index) => renderCartLine(line, index))
        )}
        <View style={styles.confirmTotalsWrap}>
          <SaleTotalsBlock
            discountLabel={discountLabel}
            discountValue={formatSaleDiscountValue(sellCart.discountTotalCents)}
            subtotal={formatCurrency(sellCart.subtotalCents)}
            total={formatCurrency(sellCart.totalCents)}
            totalLabel="Total a cobrar"
          />
        </View>
      </View>
      <View style={styles.clientComprobanteCard}>
        <View style={styles.clientComprobanteCol}>
          <Icon color={colors.info} kind="user" size={18} strokeWidth={1.8} />
          <Text style={styles.clientComprobanteLabel}>Cliente</Text>
          <Text style={styles.clientComprobanteValue}>{DEFAULT_CLIENT_LABEL}</Text>
        </View>
        <View style={styles.clientComprobanteDivider} />
        <View style={styles.clientComprobanteCol}>
          <Icon color={colors.info} kind="document" size={18} strokeWidth={1.8} />
          <Text style={styles.clientComprobanteLabel}>Comprobante</Text>
          <Text style={styles.clientComprobanteValue}>{DEFAULT_RECEIPT_LABEL}</Text>
        </View>
      </View>
      <ConfirmEditButton
        disabled={!sellCart.canSaveQuote}
        icon="bill"
        label="Guardar presupuesto"
        onPress={() => void handleSaveQuote()}
      />
      <ConfirmPrimaryButton
        disabled={props.isConfirming || sellCart.cart.length === 0}
        label={props.isConfirming ? 'Confirmando...' : 'Confirmar pago completo'}
        onPress={() => void handleConfirmPayment()}
      />
      <View style={styles.confirmFooterNote}>
        <Icon color={colors.primary} kind="shield" size={14} strokeWidth={1.8} />
        <Text style={styles.confirmFooterText}>Marca esta venta como cobrada una vez recibido el pago.</Text>
      </View>
    </ScreenContent>
  );
}

function PaymentChip(props: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  small?: boolean;
}): ReactElement {
  return (
    <View
      style={[
        styles.paymentChip,
        props.small && styles.paymentChipSmall,
        props.active && styles.paymentChipActive,
        props.disabled && styles.paymentChipDisabled,
      ]}
    >
      <Text
        style={[
          styles.paymentChipText,
          props.active && styles.paymentChipTextActive,
          props.disabled && styles.paymentChipTextDisabled,
        ]}
      >
        {props.label}
      </Text>
    </View>
  );
}

function subproductAsInventoryRow(item: SubproductMock): InventoryProductMock {
  return {
    category: 'Almacen',
    code: 'Codigo asociado',
    id: item.id,
    indent: true,
    name: item.name,
    status: item.status,
    statusTone: item.statusTone,
    stock: item.stock,
  };
}

function InventoryListRow(props: {
  isLast?: boolean;
  onAddStock?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPress?: () => void;
  product: InventoryProductMock;
}): ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
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
          {!props.product.createCode ? (
            <View style={styles.codeRow}>
              <CodeTypeIcon code={props.product.code} small tone={props.product.codeTone} />
              <Text style={[styles.codeText, props.product.codeTone === 'red' && styles.dangerText]}>{props.product.code}</Text>
            </View>
          ) : null}
        </View>
        <RowActions
          onAddStock={props.onAddStock}
          onDelete={props.onDelete}
          onEdit={props.onEdit}
        />
      </View>
      {props.product.createCode ? (
        <View style={styles.createCodeRow}>
          <View style={styles.createCodeLeft}>
            <CodeTypeIcon code={props.product.code} small tone="red" />
            <Text numberOfLines={1} style={[styles.codeText, styles.dangerText]}>{props.product.code}</Text>
          </View>
          <Text style={styles.createCodeLink}>+ Crear codigo</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SellProductRow(props: {
  onAddToCart?: () => void;
  onEdit?: () => void;
  onPress?: () => void;
  product: SellProductMock;
}): ReactElement {
  return (
    <View style={[styles.sellRow, props.product.indent && styles.sellRowIndent]}>
      <Pressable onPress={props.onPress} style={styles.sellRowMain}>
        <ProductThumb />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{props.product.name}</Text>
          <Text style={styles.rowMeta}>{props.product.category ?? 'Almacen'}</Text>
          {props.product.linkedTo ? (
            <Text style={styles.linkedToText}>Vinculado a: {props.product.linkedTo}</Text>
          ) : null}
          <Text style={styles.sellMeta}>
            {props.product.price} • {props.product.stock}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel="Editar producto"
        hitSlop={8}
        onPress={props.onEdit}
        style={styles.rowActionButton}
      >
        <Icon color={colors.info} kind="edit" size={15} strokeWidth={2} />
      </Pressable>
      <Pressable onPress={props.onAddToCart} style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

function movementToneStyle(tone: 'blue' | 'green' | 'red'): object {
  if (tone === 'blue') return styles.movementBlue;
  if (tone === 'red') return styles.movementRed;
  return styles.movementGreen;
}

const styles = StyleSheet.create({
  actionBar: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    overflow: 'hidden',
  },
  actionDivider: {
    backgroundColor: '#edf2f4',
    width: 1,
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    paddingVertical: 12,
  },
  actionLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionLabelInfo: {
    color: colors.info,
  },
  addAnotherRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
  },
  addAnotherText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  addStockSaveAnotherButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    width: '100%',
  },
  addStockSaveAnotherButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  addButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    minWidth: 38,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  addProductCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  addProductIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  addProductSubtitle: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 2,
  },
  addProductTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  addSubproductButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  addSubproductButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  alternativeBody: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 15,
    marginTop: 4,
  },
  alternativeCard: {
    alignItems: 'flex-start',
    backgroundColor: '#e9f8ef',
    borderColor: '#b8ebcf',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  alternativeIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  alternativeTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  batchColMain: {
    flex: 1,
    minWidth: 0,
  },
  batchCostPrice: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'left',
    width: 88,
  },
  batchHeader: {
    alignItems: 'center',
    backgroundColor: '#f8fafb',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  batchHeaderLabel: {
    color: colors.slate,
    fontSize: 8,
    fontWeight: '600',
    width: 88,
  },
  batchHeaderStatus: {
    color: colors.slate,
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    width: 64,
  },
  batchQty: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  batchRow: {
    alignItems: 'center',
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  batchStatusCol: {
    alignItems: 'center',
    width: 64,
  },
  batchTable: {
    borderColor: '#edf2f4',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  barcodeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
  cartRow: {
    alignItems: 'center',
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  clientComprobanteCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    overflow: 'hidden',
  },
  clientComprobanteCol: {
    flex: 1,
    padding: 14,
  },
  clientComprobanteDivider: {
    backgroundColor: '#edf2f4',
    width: 1,
  },
  clientComprobanteLabel: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 8,
  },
  clientComprobanteValue: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  codeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  codeText: {
    color: colors.slate,
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '300',
  },
  codeValue: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmFooterNote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
  },
  confirmFooterText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '300',
  },
  confirmInput: {
    borderColor: colors.borderInput,
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  confirmInputField: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 0,
  },
  confirmListHeader: {
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmListTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  confirmText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmTotalsWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  createCodeLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  createCodeLink: {
    color: colors.primary,
    flexShrink: 0,
    fontSize: 9,
    fontWeight: '600',
  },
  createCodeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 62,
    marginTop: 6,
    paddingRight: 14,
  },
  dangerText: {
    color: colors.danger,
  },
  deactivateButton: {
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deactivateButtonText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '600',
  },
  deleteFooterNote: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 10,
    textAlign: 'center',
  },
  deleteWarningBody: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '300',
    lineHeight: 15,
    marginTop: 8,
  },
  deleteWarningCard: {
    backgroundColor: '#fff0f3',
    borderColor: '#ffd2dc',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  deleteWarningHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteWarningSubtitle: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 10,
  },
  deleteWarningTitle: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  flex: {
    flex: 1,
  },
  footerNote: {
    color: colors.slate,
    fontSize: 9,
    fontWeight: '300',
    marginTop: 10,
  },
  greenText: {
    color: colors.primary,
    fontWeight: '600',
  },
  infoBlockRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  loadingText: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 16,
    textAlign: 'center',
  },
  filterChip: {
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  listBoxEmptyState: {
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  linkedToText: {
    color: colors.info,
    fontSize: 9,
    fontWeight: '300',
    marginTop: 2,
  },
  listCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listHeader: {
    alignItems: 'center',
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listHeaderMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  listHeaderStacked: {
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listHeaderSubtitle: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 4,
  },
  listHeaderTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  movementAmountGreen: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  movementAmountRed: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  movementBlue: {
    backgroundColor: '#eef8ff',
  },
  movementGreen: {
    backgroundColor: colors.primarySoft,
  },
  movementIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  movementRed: {
    backgroundColor: '#ffeaf0',
  },
  movementRow: {
    alignItems: 'center',
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingTop: 10,
  },
  movementSymbol: {
    fontSize: 11,
    fontWeight: '600',
  },
  outlineLink: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 38,
    justifyContent: 'center',
    marginTop: 12,
  },
  outlineLinkText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
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
  paymentChipDisabled: {
    opacity: 0.55,
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
  paymentChipTextDisabled: {
    color: colors.slate,
  },
  paymentLabel: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 10,
  },
  paymentStatusCard: {
    alignItems: 'flex-start',
    backgroundColor: '#fff5e9',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentStatusSubtitle: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '300',
  },
  paymentStatusTitle: {
    color: colors.warning,
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
  qtyValue: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
  },
  rowTitle: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  saleLineItem: {
    alignItems: 'center',
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionLabel: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
  },
  sellButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  sellListHeader: {
    alignItems: 'flex-end',
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sellMeta: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 4,
  },
  sellRow: {
    alignItems: 'center',
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sellRowIndent: {
    paddingLeft: 28,
  },
  sellRowMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  rowActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  stockValueInline: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '600',
  },
  subproductSection: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  subproductSectionHeader: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subproductSectionSubtitle: {
    color: colors.slate,
    fontSize: 10,
    fontWeight: '300',
    marginTop: 4,
  },
  subproductSectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
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
