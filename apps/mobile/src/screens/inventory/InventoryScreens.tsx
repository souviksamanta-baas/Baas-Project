import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  baseProduct,
  batches,
  cartItems,
  confirmSaleItems,
  inventoryProducts,
  movements,
  sellProducts,
  subproducts,
  type InventoryProductMock,
  type SellProductMock,
  type SubproductMock,
} from '../../api/inventoryMockData';
import {
  InventoryMoneyField,
  InventoryPercentField,
  InventoryReadOnlyField,
  InventorySelectField,
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
  InventoryScreenTitle,
  LinkedDeleteRow,
  LinkedSubproductRow,
  OutlineButton,
  PrimaryButton,
  ProductSummaryCard,
  ProductThumb,
  RadioProductOption,
  RowActions,
  SaleTotalsBlock,
  SearchFilterRow,
  SecondaryButton,
  SectionCard,
  SolidDangerButton,
  StockBadge,
} from '../../components/inventoryUi';
import { ScreenContent } from '../../components/ui';
import { ListBox } from '../../design-system';
import {
  buildProductSummaryMeta,
  filterInventoryProducts,
  filterSellProducts,
  formatProductCost,
  formatProductStockLabel,
  formatProductUnitPrice,
  getProductStatusLabel,
  mapProductToInventoryRow,
  mapProductsToSellRows,
} from '../../lib/inventoryPresentation';
import {
  BASE_UNIT_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  sortOptionsAlphabetically,
  type ProductStatusSlug,
} from '../../lib/productCatalog';
import {
  applyCostToFormValues,
  applyMarginToFormValues,
  applyUnitPriceToFormValues,
  productToEditFormValues,
} from '../../lib/productEditForm';
import { colors, radius, shadows } from '../../theme';
import type { Product, ProductEditFormValues } from '../../types/products';
import { Icon } from '../../components/icons';

type InventoryNav = {
  onOpenAddStock: () => void;
  onOpenConfirmPayment: () => void;
  onOpenDeleteProduct: () => void;
  onOpenEditProduct: () => void;
  onOpenEditSubproduct: (subproductId: string) => void;
  onOpenProductDetail: (productId: string) => void;
  onOpenSellProducts: () => void;
};

export function ManageStockScreen(
  props: {
    errorMessage?: string | null;
    isLoading?: boolean;
    onAddStockProduct: (productId: string) => void;
    onDeleteProduct: (productId: string) => void;
    onEditProduct: (productId: string) => void;
    onOpenProductDetail: (productId: string) => void;
    products?: InventoryProductMock[];
  },
): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const products = props.products ?? inventoryProducts;
  const filteredProducts = useMemo(
    () => filterInventoryProducts(products, searchQuery),
    [products, searchQuery],
  );
  const productCountLabel = `${filteredProducts.length} producto${filteredProducts.length === 1 ? '' : 's'}`;

  return (
    <ScreenContent>
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, escanea y actualiza tu inventario"
        title="Gestionar stock"
      />
      <SearchFilterRow onChangeText={setSearchQuery} searchValue={searchQuery} />
      {props.errorMessage ? <InfoBanner>{props.errorMessage}</InfoBanner> : null}
      <ListBox headerMeta={productCountLabel} title="Productos en inventario">
        {props.isLoading ? (
          <Text style={styles.loadingText}>Cargando inventario...</Text>
        ) : products.length === 0 ? (
          <Text style={styles.loadingText}>No hay productos cargados en esta sucursal.</Text>
        ) : filteredProducts.length === 0 ? (
          <Text style={styles.loadingText}>No se encontraron productos para esta busqueda.</Text>
        ) : (
          filteredProducts.map((product) => (
            <InventoryListRow
              key={product.id}
              onAddStock={() => props.onAddStockProduct(product.id)}
              onDelete={() => props.onDeleteProduct(product.id)}
              onEdit={() => props.onEditProduct(product.id)}
              onPress={() => props.onOpenProductDetail(product.id)}
              product={product}
            />
          ))
        )}
      </ListBox>
      <Pressable style={styles.addProductCard}>
        <View style={styles.addProductIcon}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.addProductTitle}>Agregar nuevo producto</Text>
          <Text style={styles.addProductSubtitle}>Crea productos, subproductos y genera codigos</Text>
        </View>
        <Icon color={colors.primary} kind="chevron-right" size={14} strokeWidth={2.2} />
      </Pressable>
    </ScreenContent>
  );
}

export function ProductDetailScreen(
  props: InventoryNav & {
    businessCenterName?: string | null;
    movements?: typeof movements;
    onBack: () => void;
    product?: Product | null;
    childProducts?: Product[];
  },
): ReactElement {
  const product = props.product;
  const childProducts = props.childProducts ?? [];
  const productName = product?.name ?? baseProduct.name;
  const productStock = product ? formatProductStockLabel(product) : baseProduct.stock;
  const productCategory = product?.category ?? baseProduct.category;
  const productNotes = product?.description ?? baseProduct.notes;
  const productCode = product?.sku ?? baseProduct.code;
  const summaryMeta = product ? buildProductSummaryMeta(product, props.businessCenterName) : undefined;
  const productStatus = product ? getProductStatusLabel(product) : 'En stock';
  const productStatusTone = product?.isLowStock ? 'orange' : 'green';
  const displayChildRows = product
    ? childProducts.map((item) => mapProductToInventoryRow(item, { indent: true }))
    : subproducts.map((item) => subproductAsInventoryRow(item));
  const batchRows = product ? [] : batches;
  const movementRows = props.movements ?? (product ? [] : movements);
  const hasChildProducts = displayChildRows.length > 0;

  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Detalle y gestion del producto" title="Producto" />
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
        <Pressable onPress={props.onOpenAddStock} style={styles.actionItem}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
          <Text style={styles.actionLabel}>Agregar stock</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={props.onOpenDeleteProduct} style={styles.actionItem}>
          <Icon color={colors.danger} kind="trash" size={15} strokeWidth={1.8} />
          <Text style={[styles.actionLabel, styles.dangerText]}>Eliminar</Text>
        </Pressable>
      </View>
      {hasChildProducts ? (
        <ListBox
          headerSubtitle="Presentaciones creadas a partir de este producto."
          title="Subproductos"
        >
          {displayChildRows.map((item) => (
            <LinkedSubproductRow
              key={item.id}
              name={item.name}
              onEditPress={() => props.onOpenEditSubproduct(item.id)}
              onPress={() => props.onOpenProductDetail(item.id)}
            />
          ))}
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
          <Icon color={colors.navy} kind="barcode" size={18} strokeWidth={1} />
          <View>
            <Text style={styles.codeValue}>{productCode}</Text>
            <Text style={styles.rowMeta}>{product?.sku ? 'Codigo de barras' : 'Sin codigo asignado'}</Text>
          </View>
        </View>
        <Pressable style={styles.outlineLink}>
          <Text style={styles.outlineLinkText}>Ver / regenerar codigo</Text>
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
    onOpenEditSubproduct: (subproductId: string) => void;
    onOpenSubproductDetail: (subproductId: string) => void;
    onSave: (values: ProductEditFormValues) => Promise<void>;
    product: Product;
    subproducts?: Product[];
  },
): ReactElement {
  const childProducts = props.subproducts ?? [];
  const [formValues, setFormValues] = useState<ProductEditFormValues>(() =>
    productToEditFormValues(props.product, props.businessCenterId),
  );

  useEffect(() => {
    setFormValues(productToEditFormValues(props.product, props.businessCenterId));
  }, [props.businessCenterId, props.product]);

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
      <InventoryScreenTitle onBack={props.onBack} subtitle="Actualiza la informacion del producto" title="Editar producto" />
      <ProductSummaryCard
        badge={childProducts.length > 0 ? 'Producto con subproductos' : undefined}
        changePhoto
        title={formValues.name}
      />
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
          <InventorySelectField
            label="Categoria"
            onChange={(category) => setFormValues((current) => ({ ...current, category }))}
            options={categoryOptions}
            value={formValues.category}
          />
        </View>
        <View style={styles.fieldRow}>
          <InventoryReadOnlyField label="SKU" value={props.product.sku ?? 'Generado por la app'} />
          <InventorySelectField
            label="Unidad base"
            onChange={(baseUnitCode) => setFormValues((current) => ({ ...current, baseUnitCode }))}
            options={BASE_UNIT_OPTIONS}
            value={formValues.baseUnitCode}
          />
        </View>
        <View style={styles.fieldRow}>
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
        </View>
        <InventorySelectField
          disabled
          full
          label="Sucursal"
          onChange={() => undefined}
          options={branchOptions}
          value={formValues.businessCenterId}
        />
        <InventoryTextField
          full
          label="Notas"
          multiline
          onChangeText={(description) => setFormValues((current) => ({ ...current, description }))}
          value={formValues.description}
        />
      </SectionCard>
      {childProducts.length > 0 ? (
        <View style={styles.subproductSection}>
          <View style={styles.subproductSectionHeader}>
            <View style={styles.flex}>
              <Text style={styles.subproductSectionTitle}>Subproductos</Text>
              <Text style={styles.subproductSectionSubtitle}>
                Estos productos usan el stock y el costo del producto base.
              </Text>
            </View>
            <Pressable style={styles.addSubproductButton}>
              <Text style={styles.addSubproductButtonText}>+ Agregar subproducto</Text>
            </Pressable>
          </View>
          {childProducts.map((item) => (
            <LinkedSubproductRow
              key={item.id}
              name={item.name}
              onEditPress={() => props.onOpenEditSubproduct(item.id)}
              onPress={() => props.onOpenSubproductDetail(item.id)}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton
          label={props.isSaving ? 'Guardando...' : 'Guardar cambios'}
          onPress={() => {
            void handleSave();
          }}
        />
      </View>
      <DangerButton label="Eliminar producto" onPress={props.onOpenDeleteProduct} />
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
  }, [props.businessCenterId, props.subproduct]);

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
        subtitle="Actualiza la informacion del subproducto"
        title="Editar subproducto"
      />
      <ProductSummaryCard changePhoto linkedTo={parentName} title={formValues.name} />
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
          <InventorySelectField
            label="Categoria"
            onChange={(category) => setFormValues((current) => ({ ...current, category }))}
            options={categoryOptions}
            value={formValues.category}
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
        </View>
        <InventorySelectField
          disabled
          full
          label="Sucursal"
          onChange={() => undefined}
          options={branchOptions}
          value={formValues.businessCenterId}
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
            value={`1 ${formValues.baseUnitCode} = 1 ${parentProduct?.unitCode ?? baseProduct.unit} del producto base`}
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
  onBack: () => void;
  product?: Product | null;
  subproducts?: Product[];
}): ReactElement {
  const product = props.product;
  const childProducts = props.subproducts ?? (product ? [] : subproducts);
  const productName = product?.name ?? baseProduct.name;
  const productStock = product ? formatProductStockLabel(product) : baseProduct.stock;

  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Registra ingresos para el producto base o sus subproductos" title="Agregar stock" />
      <ProductSummaryCard stock={productStock} title={productName} />
      <Text style={styles.sectionLabel}>A que producto queres agregar stock?</Text>
      <RadioProductOption active meta={`Producto base • Stock actual: ${productStock}`} name={productName} />
      {childProducts.map((item) => (
        <RadioProductOption
          key={item.id}
          meta={`Stock actual: ${linkedProductStockLabel(item)}`}
          name={item.name}
        />
      ))}
      <Text style={styles.sectionLabel}>Detalle del ingreso</Text>
      <SectionCard>
        <View style={styles.fieldRow}>
          <FormField label="Cantidad a ingresar" value="25" />
          <FormField label="Unidad" select value="kg" />
        </View>
        <View style={styles.fieldRow}>
          <FormField label="Costo" value="$1.180 / kg" />
          <FormField label="Proveedor" value="Molino Central" />
        </View>
        <View style={styles.fieldRow}>
          <FormField calendar label="Fecha de ingreso" value="Hoy • 09:41" />
          <FormField label="Lote" value="LOTE-HAR-0626" />
        </View>
        <FormField
          full
          label="Notas"
          textarea
          value="Ingreso manual de mercaderia para reposicion semanal."
        />
      </SectionCard>
      <InfoBanner>
        Si seleccionas un subproducto, el ingreso se registra directamente sobre esa presentacion.
      </InfoBanner>
      <SecondaryButton fullWidth label="+ Guardar y Registrar otro ingreso" />
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <PrimaryButton label="Guardar ingreso" />
      </View>
    </ScreenContent>
  );
}

export function DeleteProductScreen(props: {
  onBack: () => void;
  product?: Product | null;
  subproducts?: Product[];
}): ReactElement {
  const product = props.product;
  const childProducts = props.subproducts ?? (product ? [] : subproducts);
  const productName = product?.name ?? baseProduct.name;
  const productStock = product ? formatProductStockLabel(product) : baseProduct.stock;
  const hasLinkedSubproducts = childProducts.length > 0;

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
        <Pressable style={styles.deactivateButton}>
          <Text style={styles.deactivateButtonText}>Desactivar en su lugar</Text>
        </Pressable>
      </View>
      <SectionCard title="Confirmacion">
        <Text style={styles.rowMeta}>Escribi ELIMINAR para confirmar</Text>
        <View style={styles.confirmInput}>
          <Text style={styles.confirmText}>ELIMINAR</Text>
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <SolidDangerButton label="Eliminar producto" />
      </View>
      <Text style={styles.deleteFooterNote}>Esta accion no se puede deshacer.</Text>
    </ScreenContent>
  );
}

export function SellProductsScreen(
  props: {
    errorMessage?: string | null;
    isLoading?: boolean;
    onOpenConfirmPayment: () => void;
    products?: SellProductMock[];
  },
): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const products = props.products ?? sellProducts;
  const filteredProducts = useMemo(
    () => filterSellProducts(products, searchQuery),
    [products, searchQuery],
  );
  const productCountLabel = `${filteredProducts.length} producto${filteredProducts.length === 1 ? '' : 's'}`;

  return (
    <ScreenContent>
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, agrega y cobra tus productos"
        title="Ventas"
      />
      <SearchFilterRow onChangeText={setSearchQuery} searchValue={searchQuery} />
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
          filteredProducts.map((product) => <SellProductRow key={product.id} product={product} />)
        )}
      </View>
      <SectionCard title="Cobrar y emitir factura">
        {cartItems.map((item, index) => (
          <CartLineRow isFirst={index === 0} item={item} key={item.id} />
        ))}
        <SaleTotalsBlock
          discountValue="-$1.070"
          subtotal="$15.700"
          total="$14.630"
          withDiscountControls
        />
        <View style={styles.fieldRow}>
          <FormField compactLabel label="Cliente" select value="Consumidor final" />
          <FormField compactLabel label="Comprobante" select value="Factura ARCA" />
        </View>
        <Text style={styles.paymentLabel}>Forma de pago</Text>
        <View style={styles.chipRow}>
          <PaymentChip active label="Efectivo" small />
          <PaymentChip label="Tarjetas" small />
          <PaymentChip label="Transferencia" small />
          <PaymentChip label="QR" small />
        </View>
        <View style={styles.sellButtonRow}>
          <OutlineButton compact icon="bill" label="Guardar presupuesto" />
          <CobrarButton onPress={props.onOpenConfirmPayment} />
        </View>
      </SectionCard>
    </ScreenContent>
  );
}

export function ConfirmPaymentScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Revisa los productos antes de confirmar el pago" title="Confirmar cobro" />
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
        {confirmSaleItems.map((item) => (
          <CartLineRow inListCard item={item} key={item.id} />
        ))}
        <View style={styles.confirmTotalsWrap}>
          <SaleTotalsBlock
            discountLabel="Descuento 10%"
            discountValue="-$2.624"
            subtotal="$26.235"
            total="$23.611"
            totalLabel="Total a cobrar"
          />
        </View>
      </View>
      <View style={styles.clientComprobanteCard}>
        <View style={styles.clientComprobanteCol}>
          <Icon color={colors.info} kind="user" size={18} strokeWidth={1.8} />
          <Text style={styles.clientComprobanteLabel}>Cliente</Text>
          <Text style={styles.clientComprobanteValue}>Consumidor final</Text>
        </View>
        <View style={styles.clientComprobanteDivider} />
        <View style={styles.clientComprobanteCol}>
          <Icon color={colors.info} kind="document" size={18} strokeWidth={1.8} />
          <Text style={styles.clientComprobanteLabel}>Comprobante</Text>
          <Text style={styles.clientComprobanteValue}>Factura fiscal ARCA</Text>
        </View>
      </View>
      <ConfirmEditButton icon="bill" label="Guardar presupuesto" />
      <ConfirmPrimaryButton label="Confirmar pago completo" />
      <View style={styles.confirmFooterNote}>
        <Icon color={colors.primary} kind="shield" size={14} strokeWidth={1.8} />
        <Text style={styles.confirmFooterText}>Marca esta venta como cobrada una vez recibido el pago.</Text>
      </View>
    </ScreenContent>
  );
}

function PaymentChip(props: { active?: boolean; label: string; small?: boolean }): ReactElement {
  return (
    <View style={[styles.paymentChip, props.small && styles.paymentChipSmall, props.active && styles.paymentChipActive]}>
      <Text style={[styles.paymentChipText, props.active && styles.paymentChipTextActive]}>{props.label}</Text>
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
  onAddStock?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPress?: () => void;
  product: InventoryProductMock;
}): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={[styles.inventoryRow, props.product.indent && styles.inventoryRowIndent]}>
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

function SellProductRow(props: { product: SellProductMock }): ReactElement {
  return (
    <View style={[styles.sellRow, props.product.indent && styles.sellRowIndent]}>
      <ProductThumb />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{props.product.name}</Text>
        <Text style={styles.rowMeta}>Almacen</Text>
        {props.product.linkedTo ? <Text style={styles.linkedToText}>Vinculado a: {props.product.linkedTo}</Text> : null}
        <Text style={styles.sellMeta}>{props.product.price} • {props.product.stock}</Text>
      </View>
      <Icon color={colors.info} kind="edit" size={15} strokeWidth={2} />
      <Pressable style={styles.addButton}>
        <Text style={styles.addButtonText}>{props.product.addKg ? '+ kg' : '+'}</Text>
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
    borderColor: colors.navy,
    borderRadius: 10,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
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
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inventoryRowIndent: {
    paddingLeft: 28,
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
    padding: 14,
  },
  subproductSectionHeader: {
    flexDirection: 'row',
    gap: 10,
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
