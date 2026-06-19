import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  type SubproductMock,
} from '../../api/inventoryMockData';
import { Icon } from '../../components/icons';
import {
  DangerButton,
  FormField,
  InventoryScreenTitle,
  OutlineButton,
  PaymentChip,
  PrimaryButton,
  ProductSummaryCard,
  ProductThumb,
  RowActions,
  SearchFilterRow,
  SectionCard,
  StockBadge,
} from '../../components/inventoryUi';
import { ScreenContent } from '../../components/ui';
import { colors, radius, shadows } from '../../theme';

type InventoryNav = {
  onOpenAddStock: () => void;
  onOpenConfirmPayment: () => void;
  onOpenDeleteProduct: () => void;
  onOpenEditProduct: () => void;
  onOpenEditSubproduct: () => void;
  onOpenProductDetail: () => void;
  onOpenSellProducts: () => void;
};

export function ManageStockScreen(props: InventoryNav & { onBack?: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, escanea y actualiza tu inventario"
        title="Gestionar stock"
      />
      <SearchFilterRow />
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>Productos en inventario</Text>
          <Text style={styles.listHeaderMeta}>10 productos</Text>
        </View>
        {inventoryProducts.map((product) => (
          <InventoryListRow
            key={product.id}
            onPress={product.isBase ? props.onOpenProductDetail : undefined}
            product={product}
          />
        ))}
      </View>
      <Pressable style={styles.addProductCard}>
        <View style={styles.addProductIcon}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.addProductTitle}>Agregar nuevo producto</Text>
          <Text style={styles.addProductSubtitle}>Crea productos, subproductos y genera codigos</Text>
        </View>
        <Text style={styles.linkText}>›</Text>
      </Pressable>
    </ScreenContent>
  );
}

export function ProductDetailScreen(props: InventoryNav & { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Detalle y gestion del producto" title="Producto" />
      <ProductSummaryCard showBarcode showMeta stock={baseProduct.stock} title={baseProduct.name} />
      <View style={styles.actionBar}>
        <Pressable onPress={props.onOpenEditProduct} style={styles.actionItem}>
          <Icon color={colors.info} kind="gear" size={15} strokeWidth={2} />
          <Text style={[styles.actionLabel, styles.actionLabelInfo]}>Editar producto</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={props.onOpenAddStock} style={styles.actionItem}>
          <Icon color={colors.primary} kind="plus" size={17} strokeWidth={2} />
          <Text style={styles.actionLabel}>Agregar stock</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable onPress={props.onOpenDeleteProduct} style={styles.actionItem}>
          <Icon color={colors.danger} kind="alert" size={15} strokeWidth={2} />
          <Text style={[styles.actionLabel, styles.dangerText]}>Eliminar</Text>
        </Pressable>
      </View>
      <View style={styles.listCard}>
        <View style={styles.listHeaderStacked}>
          <Text style={styles.listHeaderTitle}>Subproductos</Text>
          <Text style={styles.listHeaderSubtitle}>Presentaciones creadas a partir de este producto.</Text>
        </View>
        {subproducts.map((item) => (
          <InventoryListRow key={item.id} product={subproductAsInventoryRow(item)} />
        ))}
      </View>
      <SectionCard subtitle="Seguimiento de costo y precio por ingreso." title="Lotes y precios">
        <View style={styles.batchTable}>
          <View style={styles.batchHeader}>
            <View style={styles.flex} />
            <Text style={styles.batchHeaderLabel}>Costo / Precio</Text>
            <Text style={[styles.batchHeaderLabel, styles.batchHeaderStatus]}>Estado</Text>
          </View>
          {batches.map((batch) => (
            <View key={batch.id} style={styles.batchRow}>
              <View style={styles.flex}>
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
      </SectionCard>
      <SectionCard title="Movimientos recientes">
        {movements.map((movement) => (
          <View key={movement.id} style={styles.movementRow}>
            <View style={[styles.movementIcon, movementToneStyle(movement.tone)]}>
              <Text style={styles.movementSymbol}>{movement.tone === 'green' ? '↓' : movement.tone === 'red' ? '↑' : '$'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{movement.label}</Text>
              <Text style={styles.rowMeta}>{movement.time}</Text>
            </View>
            {movement.amount ? <Text style={movement.tone === 'green' ? styles.greenText : styles.dangerText}>{movement.amount}</Text> : null}
          </View>
        ))}
      </SectionCard>
      <SectionCard title="Código asociado">
        <Text style={styles.rowTitle}>7791234567890</Text>
        <Text style={styles.rowMeta}>Codigo de barras</Text>
        <Pressable style={styles.outlineLink}>
          <Text style={styles.linkText}>Ver / regenerar codigo ›</Text>
        </Pressable>
      </SectionCard>
      <SectionCard title="Notas">
        <Text style={styles.rowMeta}>{baseProduct.notes}</Text>
      </SectionCard>
    </ScreenContent>
  );
}

export function EditProductScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Actualiza la informacion del producto" title="Editar producto" />
      <ProductSummaryCard title={baseProduct.name} />
      <SectionCard>
        <FormField full label="Nombre del producto" value={baseProduct.name} />
        <View style={styles.fieldRow}>
          <FormField label="Categoria" value="Almacen" />
          <FormField green label="Estado" value="En stock" />
        </View>
        <View style={styles.fieldRow}>
          <FormField label="Costo" value={baseProduct.cost} />
          <FormField label="Precio de venta" value={baseProduct.price} />
          <FormField label="Margen (%)" value={baseProduct.margin} />
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" />
        <PrimaryButton label="Guardar cambios" />
      </View>
      <DangerButton label="Eliminar producto" />
    </ScreenContent>
  );
}

export function EditSubproductScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Actualiza la informacion del subproducto" title="Editar subproducto" />
      <ProductSummaryCard title="Harina 1 kg" />
      <SectionCard>
        <FormField label="Nombre del producto" value="Harina 1 kg" />
        <View style={styles.fieldRow}>
          <FormField label="Costo" value="$1.250" />
          <FormField label="Precio de venta" value="$1.900" />
          <FormField label="Margen (%)" value="34%" />
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" />
        <PrimaryButton label="Guardar cambios" />
      </View>
    </ScreenContent>
  );
}

export function AddStockScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Registra ingresos para el producto base o sus subproductos" title="Agregar stock" />
      <ProductSummaryCard stock={baseProduct.stock} title={baseProduct.name} />
      <Text style={styles.sectionLabel}>Detalle del ingreso</Text>
      <SectionCard>
        <View style={styles.fieldRow}>
          <FormField label="Cantidad a ingresar" value="25" />
          <FormField label="Unidad" value="kg" />
        </View>
        <View style={styles.fieldRow}>
          <FormField label="Costo" value="$1.180 / kg" />
          <FormField label="Proveedor" value="Molino Central" />
        </View>
        <View style={styles.fieldRow}>
          <FormField label="Fecha de ingreso" value="Hoy • 09:41" />
          <FormField label="Lote" value="LOTE-HAR-0626" />
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" />
        <PrimaryButton label="Guardar ingreso" />
      </View>
    </ScreenContent>
  );
}

export function DeleteProductScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Confirma si queres eliminar este producto" title="Eliminar producto" />
      <ProductSummaryCard showBarcode stock={baseProduct.stock} title={baseProduct.name} />
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>Atencion</Text>
        <Text style={styles.rowMeta}>Al eliminar este producto base, tambien se veran afectados los subproductos vinculados.</Text>
      </View>
      <SectionCard title="Confirmacion">
        <Text style={styles.rowMeta}>Escribi ELIMINAR para confirmar</Text>
        <View style={styles.confirmInput}>
          <Text style={styles.confirmText}>ELIMINAR</Text>
        </View>
      </SectionCard>
      <View style={styles.buttonRow}>
        <OutlineButton label="Cancelar" onPress={props.onBack} />
        <DangerButton label="Eliminar producto" />
      </View>
    </ScreenContent>
  );
}

export function SellProductsScreen(props: InventoryNav & { onBack?: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle
        showBack={false}
        subtitle="Busca, agrega y cobra tus productos"
        title="Vender productos"
      />
      <SearchFilterRow />
      <View style={styles.listCard}>
        {sellProducts.map((product) => (
          <View key={product.id} style={styles.sellRow}>
            <ProductThumb />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{product.name}</Text>
              <Text style={styles.rowMeta}>{product.price} • {product.stock}</Text>
            </View>
            <Icon color={colors.info} kind="gear" size={15} strokeWidth={2} />
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>{product.addKg ? '+ kg' : '+'}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <SectionCard title="Cobrar y emitir factura">
        {cartItems.map((item) => (
          <View key={item.id} style={styles.cartRow}>
            <ProductThumb />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>{item.qty}</Text>
            </View>
            <Text style={styles.rowTitle}>{item.price}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text style={styles.rowMeta}>Subtotal $15.700</Text>
          <Text style={styles.rowMeta}>Descuento -$1.070</Text>
          <Text style={styles.totalValue}>Total $14.630</Text>
        </View>
        <View style={styles.fieldRow}>
          <FormField compactLabel label="Cliente" value="Consumidor final" />
          <FormField compactLabel label="Comprobante" value="Factura ARCA" />
        </View>
        <Text style={styles.sectionLabel}>Forma de pago</Text>
        <View style={styles.chipRow}>
          <PaymentChip active label="Efectivo" small />
          <PaymentChip label="Tarjetas" small />
          <PaymentChip label="Transferencia" small />
          <PaymentChip label="QR" small />
        </View>
        <View style={styles.buttonRow}>
          <OutlineButton label="Guardar venta" />
          <Pressable onPress={props.onOpenConfirmPayment} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>$ Cobrar</Text>
          </Pressable>
        </View>
      </SectionCard>
    </ScreenContent>
  );
}

export function ConfirmPaymentScreen(props: { onBack: () => void }): ReactElement {
  return (
    <ScreenContent>
      <InventoryScreenTitle onBack={props.onBack} subtitle="Revisa los productos antes de confirmar el pago" title="Confirmar cobro" />
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>Estado del cobro</Text>
        <Text style={styles.rowMeta}>Pendiente de confirmacion manual</Text>
      </View>
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>Resumen de la venta</Text>
        </View>
        {confirmSaleItems.map((item) => (
          <View key={item.id} style={styles.cartRow}>
            <ProductThumb />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>{item.qty}</Text>
            </View>
            <Text style={styles.rowTitle}>{item.price}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text style={styles.rowMeta}>Subtotal $26.235</Text>
          <Text style={styles.rowMeta}>Descuento 10% -$2.624</Text>
          <Text style={styles.totalValue}>Total a cobrar $23.611</Text>
        </View>
      </View>
      <OutlineButton label="Editar venta" />
      <PrimaryButton label="Confirmar pago completo" />
    </ScreenContent>
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

function InventoryListRow(props: { onPress?: () => void; product: InventoryProductMock }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={[styles.inventoryRow, props.product.indent && styles.inventoryRowIndent]}>
      <ProductThumb />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{props.product.name}</Text>
        <Text style={styles.rowMeta}>{props.product.category}</Text>
        <View style={styles.stockRow}>
          <Text style={styles.rowTitle}>{props.product.stock}</Text>
          <StockBadge label={props.product.status} tone={props.product.statusTone} />
        </View>
        {!props.product.createCode ? (
          <Text style={[styles.rowMeta, props.product.codeTone === 'red' && styles.dangerText]}>{props.product.code}</Text>
        ) : null}
      </View>
      <RowActions />
      {props.product.createCode ? (
        <View style={styles.createCodeRow}>
          <Text style={styles.dangerText}>Sin codigo</Text>
          <Text style={styles.linkText}>+ Crear codigo</Text>
        </View>
      ) : null}
    </Pressable>
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
    marginTop: 12,
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
  batchCostPrice: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '600',
    width: 88,
  },
  batchHeader: {
    alignItems: 'center',
    backgroundColor: '#f8fafb',
    borderColor: '#edf2f4',
    borderRadius: 10,
    borderWidth: 1,
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
    textAlign: 'right',
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
    borderColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  batchStatusCol: {
    alignItems: 'flex-end',
    width: 64,
  },
  batchTable: {
    borderColor: '#edf2f4',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cartRow: {
    alignItems: 'center',
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
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
  confirmText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  createCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 62,
    marginTop: 6,
    width: '100%',
  },
  dangerText: {
    color: colors.danger,
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
  inventoryRow: {
    borderBottomColor: '#edf2f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inventoryRowIndent: {
    paddingLeft: 28,
  },
  linkText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  listCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 14,
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
    height: 38,
    justifyContent: 'center',
    marginTop: 12,
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
  sectionLabel: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
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
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  totals: {
    borderTopColor: '#edf2f4',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  warningCard: {
    backgroundColor: '#fff5e9',
    borderRadius: radius.md,
    marginTop: 12,
    padding: 12,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
});
