import {
  computeParentStockDeduction,
  isInactiveProductStatus,
  normalizeBaseUnitCode,
} from '../lib/productCatalog';
import {
  buildLotCodeBase,
  buildNextLotCode,
  dateInputToIso,
  validateAddStockForm,
} from '../lib/addStockForm';
import {
  buildProductEditMovementNote,
  type InventoryMovementRow,
  mapInventoryMovementRow,
} from '../lib/inventoryMovements';
import { parseMoneyInput, parsePercentInput, validateProductEditForm } from '../lib/productEditForm';
import {
  parseBaseUnitEquivalent,
  validateAddProductForm,
  validateAddSubproductForm,
} from '../lib/productCreateForm';
import { resolveUniqueProductSku } from '../lib/productSku';
import {
  buildSaleMovementNote,
  getCartLineSoldQuantity,
  type SellCartLine,
  type SellCheckoutDraft,
} from '../lib/sellCart';
import { removeExistingRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import type { AddStockFormValues, InventoryLot } from '../types/inventoryLots';
import type { Product, ProductEditFormValues, ProductFormValues, AddProductFormValues } from '../types/products';
import type { MovementMock } from './inventoryMockData';

interface InventoryProductRow {
  business_center_id: string;
  id: string;
  organization_id: string;
  products: ProductRow | ProductRow[] | null;
  quantity_on_hand: string | number;
  reorder_threshold: string | number;
  unit_code: string;
}

interface ProductWriteRow {
  base_unit_code: string;
  currency: string;
  description: string | null;
  name: string;
  organization_id: string;
  reorder_threshold: number;
  pricing_unit_code: string;
  pricing_unit_quantity: number;
  sku: string | null;
  stock_quantity: number;
  unit_price_cents: number;
}

interface ProductRow {
  base_unit_code: string;
  currency: string;
  description: string | null;
  id: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  name: string;
  parent_product_id: string | null;
  sku: string | null;
  unit_price_cents: number;
}

export async function getProducts(
  organizationId: string,
  businessCenterId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code, products!inner(id, name, sku, description, unit_price_cents, currency, is_active, metadata, parent_product_id, base_unit_code)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('products.is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return (data as InventoryProductRow[]).map(toProduct).sort((left, right) => left.name.localeCompare(right.name));
}

export function subscribeToProductCatalogChanges(
  organizationId: string,
  businessCenterId: string,
  onChange: () => void,
): () => void {
  const channelName = `products:${organizationId}:${businessCenterId}`;
  removeExistingRealtimeChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `organization_id=eq.${organizationId}`,
      },
      () => {
        onChange();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `business_center_id=eq.${businessCenterId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function createProduct(
  businessCenterId: string,
  organizationId: string,
  values: ProductFormValues,
): Promise<Product> {
  const row = toWriteRow(organizationId, values);
  const { data: product, error } = await supabase
    .from('products')
    .insert(row)
    .select(
      'id, name, sku, description, unit_price_cents, currency, is_active',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_items')
    .insert({
      business_center_id: businessCenterId,
      organization_id: organizationId,
      product_id: product.id,
      quantity_on_hand: Number.parseFloat(values.stockQuantity),
      reorder_threshold: Number.parseFloat(values.reorderThreshold),
      unit_code: 'unit',
    })
    .select('id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code')
    .single<Omit<InventoryProductRow, 'products'>>();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  return toProduct({ ...inventoryItem, products: product });
}

export async function updateProduct(
  businessCenterId: string,
  organizationId: string,
  productId: string,
  values: ProductFormValues,
): Promise<Product> {
  const row = toWriteRow(organizationId, values);
  const { data, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .select(
      'id, name, sku, description, unit_price_cents, currency, is_active',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_items')
    .upsert(
      {
        business_center_id: businessCenterId,
        organization_id: organizationId,
        product_id: productId,
        quantity_on_hand: Number.parseFloat(values.stockQuantity),
        reorder_threshold: Number.parseFloat(values.reorderThreshold),
        unit_code: 'unit',
      },
      { onConflict: 'organization_id,business_center_id,product_id' },
    )
    .select('id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code')
    .single<Omit<InventoryProductRow, 'products'>>();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  return toProduct({ ...inventoryItem, products: data });
}

export async function getProductMovements(
  organizationId: string,
  businessCenterId: string,
  productId: string,
  limit = 10,
): Promise<MovementMock[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id, movement_type, quantity_delta, unit_code, note, created_at')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InventoryMovementRow[]).map(mapInventoryMovementRow);
}

interface InventoryLotRow {
  expires_at: string | null;
  id: string;
  lot_code: string | null;
  product_id: string;
  received_at: string;
  received_quantity: string | number;
  remaining_quantity: string | number;
  supplier_reference: string | null;
  unit_code: string;
  unit_cost_cents: number | null;
}

function toInventoryLot(row: InventoryLotRow): InventoryLot {
  return {
    expiresAt: row.expires_at,
    id: row.id,
    lotCode: row.lot_code,
    productId: row.product_id,
    receivedAt: row.received_at,
    receivedQuantity: Number(row.received_quantity),
    remainingQuantity: Number(row.remaining_quantity),
    supplierReference: row.supplier_reference,
    unitCode: row.unit_code,
    unitCostCents: row.unit_cost_cents,
  };
}

export async function getProductLots(
  organizationId: string,
  businessCenterId: string,
  productId: string,
  limit = 20,
): Promise<InventoryLot[]> {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select(
      'id, product_id, lot_code, received_quantity, remaining_quantity, unit_code, unit_cost_cents, received_at, expires_at, supplier_reference',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', productId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InventoryLotRow[]).map(toInventoryLot);
}

async function listLotCodesForDate(
  organizationId: string,
  businessCenterId: string,
  productId: string,
  lotCodeBase: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('lot_code')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', productId)
    .like('lot_code', `${lotCodeBase}%`);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.lot_code)
    .filter((code): code is string => typeof code === 'string');
}

export async function addStock(
  businessCenterId: string,
  organizationId: string,
  targetProduct: Product,
  values: AddStockFormValues,
): Promise<void> {
  const validationError = validateAddStockForm(values);

  if (validationError) {
    throw new Error(validationError);
  }

  const quantity = Number.parseInt(values.quantity.trim(), 10);
  const costCents = Math.round((parseMoneyInput(values.cost) ?? NaN) * 100);
  const receivedAtIso = dateInputToIso(values.receivedDate);

  if (!receivedAtIso) {
    throw new Error('Ingresa una fecha valida.');
  }

  const receivedDate = new Date(receivedAtIso);
  const lotCodeBase = buildLotCodeBase(receivedDate);
  const existingCodes = await listLotCodesForDate(
    organizationId,
    businessCenterId,
    targetProduct.id,
    lotCodeBase,
  );
  const lotCode = buildNextLotCode(lotCodeBase, existingCodes);
  const unitCode = values.unitCode.trim() || targetProduct.unitCode;
  const supplier = values.supplier.trim();
  const unitPriceCents = Math.round((parseMoneyInput(values.unitPrice) ?? NaN) * 100);
  const marginPercent = parsePercentInput(values.marginPercent) ?? NaN;

  const parentStockDeduction =
    targetProduct.parentProductId != null
      ? await resolveParentStockDeduction({
          businessCenterId,
          organizationId,
          parentProductId: targetProduct.parentProductId,
          quantity,
          targetProduct,
        })
      : null;

  const { data: lot, error: lotError } = await supabase
    .from('inventory_lots')
    .insert({
      business_center_id: businessCenterId,
      lot_code: lotCode,
      organization_id: organizationId,
      product_id: targetProduct.id,
      received_at: receivedAtIso,
      received_quantity: quantity,
      remaining_quantity: quantity,
      supplier_reference: supplier.length > 0 ? supplier : null,
      unit_code: unitCode,
      unit_cost_cents: costCents,
    })
    .select('id')
    .single<{ id: string }>();

  if (lotError) {
    throw new Error(lotError.message);
  }

  const nextQuantity = targetProduct.stockQuantity + quantity;
  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_items')
    .update({
      quantity_on_hand: nextQuantity,
      unit_code: unitCode,
    })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', targetProduct.id)
    .select('id')
    .single<{ id: string }>();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const metadata = {
    ...targetProduct.metadata,
    margen_pct: marginPercent,
    precio_costo_cents: costCents,
    ...(supplier.length > 0 ? { proveedor: supplier } : {}),
  };

  const { error: productError } = await supabase
    .from('products')
    .update({
      base_unit_code: unitCode,
      metadata,
      unit_price_cents: unitPriceCents,
    })
    .eq('id', targetProduct.id)
    .eq('organization_id', organizationId);

  if (productError) {
    throw new Error(productError.message);
  }

  const movementNote = `Ingreso de lote ${lotCode}${supplier ? ` • ${supplier}` : ''}`;

  const { error: movementError } = await supabase.from('inventory_movements').insert({
    business_center_id: businessCenterId,
    inventory_item_id: inventoryItem.id,
    inventory_lot_id: lot.id,
    movement_type: 'restock',
    note: movementNote,
    organization_id: organizationId,
    product_id: targetProduct.id,
    quantity_delta: quantity,
    reference_type: 'stock_intake',
    unit_code: unitCode,
  });

  if (movementError) {
    throw new Error(movementError.message);
  }

  if (targetProduct.parentProductId && parentStockDeduction) {
    await applyParentStockDeduction({
      businessCenterId,
      organizationId,
      parentProductId: targetProduct.parentProductId,
      parentStockDeduction,
      quantity,
      subproductLotId: lot.id,
      subproductName: targetProduct.name,
      subproductUnitCode: unitCode,
      targetProduct,
    });
  }
}

interface ParentInventoryItemSnapshot {
  id: string;
  quantity_on_hand: number;
  unit_code: string;
}

interface ParentStockDeductionSnapshot {
  deduction: number;
  parentInventoryItem: ParentInventoryItemSnapshot;
}

interface ParentStockDeductionInput {
  businessCenterId: string;
  organizationId: string;
  parentProductId: string;
  quantity: number;
  subproductLotId: string;
  subproductName: string;
  subproductUnitCode: string;
  targetProduct: Product;
}

async function resolveParentStockDeduction(input: {
  businessCenterId: string;
  organizationId: string;
  parentProductId: string;
  quantity: number;
  targetProduct: Product;
}): Promise<ParentStockDeductionSnapshot> {
  const parentDeduction = computeParentStockDeduction(input.quantity, input.targetProduct);

  if (parentDeduction == null) {
    throw new Error(
      'Este subproducto no tiene equivalencia configurada con el producto base. Configurala antes de agregar stock.',
    );
  }

  const { data: parentInventoryItem, error: parentFetchError } = await supabase
    .from('inventory_items')
    .select('id, quantity_on_hand, unit_code')
    .eq('organization_id', input.organizationId)
    .eq('business_center_id', input.businessCenterId)
    .eq('product_id', input.parentProductId)
    .maybeSingle<{ id: string; quantity_on_hand: string | number; unit_code: string }>();

  if (parentFetchError) {
    throw new Error(parentFetchError.message);
  }

  if (!parentInventoryItem) {
    throw new Error('No se encontro stock del producto base para este subproducto.');
  }

  const parentQuantityOnHand = Number(parentInventoryItem.quantity_on_hand);

  if (parentQuantityOnHand < parentDeduction) {
    const parentUnit = parentInventoryItem.unit_code;
    const formattedDeduction = formatStockAmount(parentDeduction);
    const formattedAvailable = formatStockAmount(parentQuantityOnHand);
    throw new Error(
      `Stock insuficiente en el producto base. Se necesitan ${formattedDeduction} ${parentUnit} y hay ${formattedAvailable} ${parentUnit} disponibles.`,
    );
  }

  return {
    deduction: parentDeduction,
    parentInventoryItem: {
      id: parentInventoryItem.id,
      quantity_on_hand: parentQuantityOnHand,
      unit_code: parentInventoryItem.unit_code,
    },
  };
}

async function applyParentStockDeduction(
  input: ParentStockDeductionInput & { parentStockDeduction: ParentStockDeductionSnapshot },
): Promise<void> {
  const { parentInventoryItem } = input.parentStockDeduction;
  const parentDeduction = input.parentStockDeduction.deduction;
  const nextParentQuantity = parentInventoryItem.quantity_on_hand - parentDeduction;
  const { error: parentUpdateError } = await supabase
    .from('inventory_items')
    .update({
      quantity_on_hand: nextParentQuantity,
    })
    .eq('id', parentInventoryItem.id)
    .eq('organization_id', input.organizationId);

  if (parentUpdateError) {
    throw new Error(parentUpdateError.message);
  }

  const equivalent = input.targetProduct.baseUnitEquivalent ?? parentDeduction / input.quantity;
  const formattedEquivalent = Number.isInteger(equivalent)
    ? equivalent.toString()
    : equivalent.toFixed(3).replace(/\.?0+$/, '');
  const parentUnit = parentInventoryItem.unit_code;

  const { error: parentMovementError } = await supabase.from('inventory_movements').insert({
    business_center_id: input.businessCenterId,
    inventory_item_id: parentInventoryItem.id,
    inventory_lot_id: null,
    movement_type: 'conversion_out',
    note: `Descuento por ingreso a subproducto ${input.subproductName} (${input.quantity} ${input.subproductUnitCode} × ${formattedEquivalent} ${parentUnit})`,
    organization_id: input.organizationId,
    product_id: input.parentProductId,
    quantity_delta: -parentDeduction,
    reference_id: input.subproductLotId,
    reference_type: 'subproduct_restock',
    unit_code: parentUnit,
  });

  if (parentMovementError) {
    throw new Error(parentMovementError.message);
  }
}

interface SaleInventoryRow {
  id: string;
  product_id: string;
  products: { id: string; name: string } | { id: string; name: string }[] | null;
  quantity_on_hand: string | number;
  unit_code: string;
}

interface ResolvedSaleLine {
  inventoryItemId: string;
  line: SellCartLine;
  productName: string;
  soldQuantity: number;
  stockOnHand: number;
  unitCode: string;
}

export async function confirmSale(
  businessCenterId: string,
  organizationId: string,
  checkout: SellCheckoutDraft,
): Promise<void> {
  if (checkout.cart.length === 0) {
    throw new Error('El carrito esta vacio.');
  }

  const productIds = [...new Set(checkout.cart.map((line) => line.productId))];
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, product_id, quantity_on_hand, unit_code, products!inner(id, name)')
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .in('product_id', productIds);

  if (error) {
    throw new Error(error.message);
  }

  const inventoryByProductId = new Map<string, SaleInventoryRow>();

  for (const row of (data ?? []) as SaleInventoryRow[]) {
    inventoryByProductId.set(row.product_id, row);
  }

  const soldTotalsByProduct = new Map<string, number>();

  for (const line of checkout.cart) {
    const soldQuantity = getCartLineSoldQuantity(line);

    if (soldQuantity <= 0) {
      throw new Error(`Cantidad invalida para ${line.name}.`);
    }

    soldTotalsByProduct.set(
      line.productId,
      (soldTotalsByProduct.get(line.productId) ?? 0) + soldQuantity,
    );
  }

  for (const [productId, totalSold] of soldTotalsByProduct) {
    const inventoryItem = inventoryByProductId.get(productId);

    if (!inventoryItem) {
      const lineName = checkout.cart.find((line) => line.productId === productId)?.name ?? 'producto';
      throw new Error(`No se encontro stock para ${lineName}.`);
    }

    const product = Array.isArray(inventoryItem.products)
      ? inventoryItem.products[0]
      : inventoryItem.products;
    const productName = product?.name ?? 'producto';
    const stockOnHand = Number(inventoryItem.quantity_on_hand);
    const unitCode = inventoryItem.unit_code;

    if (stockOnHand < totalSold) {
      const formattedSold = formatStockAmount(totalSold);
      const formattedAvailable = formatStockAmount(stockOnHand);
      throw new Error(
        `Stock insuficiente para ${productName}. Se necesitan ${formattedSold} ${unitCode} y hay ${formattedAvailable} ${unitCode} disponibles.`,
      );
    }
  }

  const resolvedLines: ResolvedSaleLine[] = checkout.cart.map((line) => {
    const inventoryItem = inventoryByProductId.get(line.productId)!;
    const product = Array.isArray(inventoryItem.products)
      ? inventoryItem.products[0]
      : inventoryItem.products;
    const soldQuantity = getCartLineSoldQuantity(line);

    return {
      inventoryItemId: inventoryItem.id,
      line,
      productName: product?.name ?? line.name,
      soldQuantity,
      stockOnHand: Number(inventoryItem.quantity_on_hand),
      unitCode: inventoryItem.unit_code,
    };
  });

  const runningStockByProduct = new Map<string, number>();

  for (const saleLine of resolvedLines) {
    const currentStock =
      runningStockByProduct.get(saleLine.line.productId) ?? saleLine.stockOnHand;
    const nextQuantity = currentStock - saleLine.soldQuantity;
    runningStockByProduct.set(saleLine.line.productId, nextQuantity);

    const { error: inventoryUpdateError } = await supabase
      .from('inventory_items')
      .update({
        quantity_on_hand: nextQuantity,
      })
      .eq('id', saleLine.inventoryItemId)
      .eq('organization_id', organizationId);

    if (inventoryUpdateError) {
      throw new Error(inventoryUpdateError.message);
    }

    const { error: movementError } = await supabase.from('inventory_movements').insert({
      business_center_id: businessCenterId,
      inventory_item_id: saleLine.inventoryItemId,
      inventory_lot_id: null,
      movement_type: 'sale',
      note: buildSaleMovementNote(saleLine.line, saleLine.unitCode, checkout.clientLabel),
      organization_id: organizationId,
      product_id: saleLine.line.productId,
      quantity_delta: -saleLine.soldQuantity,
      reference_type: 'pos_sale',
      unit_code: saleLine.unitCode,
    });

    if (movementError) {
      throw new Error(movementError.message);
    }
  }
}

function formatStockAmount(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/\.?0+$/, '');
}

async function recordProductEditMovement(
  businessCenterId: string,
  organizationId: string,
  productId: string,
  inventoryItemId: string | null,
  unitCode: string,
  note: string,
): Promise<void> {
  const { error } = await supabase.from('inventory_movements').insert({
    business_center_id: businessCenterId,
    inventory_item_id: inventoryItemId,
    movement_type: 'adjustment',
    note,
    organization_id: organizationId,
    product_id: productId,
    quantity_delta: 0,
    reference_type: 'product_update',
    unit_code: unitCode,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateProductDetails(
  businessCenterId: string,
  organizationId: string,
  productId: string,
  values: ProductEditFormValues,
  existingProduct: Product,
): Promise<Product> {
  const validationError = validateProductEditForm(values);

  if (validationError) {
    throw new Error(validationError);
  }

  const cost = parseMoneyInput(values.cost);
  const unitPrice = parseMoneyInput(values.unitPrice);
  const marginPercent = parsePercentInput(values.marginPercent);

  if (cost === null || unitPrice === null || marginPercent === null) {
    throw new Error('Revisa costo, precio y margen.');
  }

  const baseUnitCode = normalizeBaseUnitCode(values.baseUnitCode);
  let costCents = Math.round(cost * 100);
  let category = values.category.trim();

  if (existingProduct.parentProductId != null) {
    const { data: parentProduct, error: parentError } = await supabase
      .from('products')
      .select('metadata')
      .eq('id', existingProduct.parentProductId)
      .eq('organization_id', organizationId)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();

    if (parentError) {
      throw new Error(parentError.message);
    }

    const parentCategory = readMetadataString(parentProduct?.metadata, 'categoria');
    if (parentCategory) {
      category = parentCategory;
    }

    const equivalent = existingProduct.baseUnitEquivalent;
    const parentCostCents =
      typeof parentProduct?.metadata?.precio_costo_cents === 'number'
        ? parentProduct.metadata.precio_costo_cents
        : null;

    if (equivalent != null && parentCostCents != null) {
      costCents = Math.round(parentCostCents * equivalent);
    }
  }

  const metadata = {
    ...existingProduct.metadata,
    categoria: category,
    estado: values.status,
    margen_pct: marginPercent,
    precio_costo_cents: costCents,
  };

  const { data, error } = await supabase
    .from('products')
    .update({
      base_unit_code: baseUnitCode,
      description: toNullableText(values.description),
      is_active: !isInactiveProductStatus(values.status),
      metadata,
      name: values.name.trim(),
      unit_price_cents: Math.round(unitPrice * 100),
    })
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .select(
      'id, name, sku, description, unit_price_cents, currency, is_active, metadata, parent_product_id, base_unit_code',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_items')
    .update({
      unit_code: baseUnitCode,
    })
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('product_id', productId)
    .select('id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code')
    .single<Omit<InventoryProductRow, 'products'>>();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const movementNote = buildProductEditMovementNote(existingProduct, values, {
    isSubproduct: existingProduct.parentProductId !== null,
  });

  await recordProductEditMovement(
    businessCenterId,
    organizationId,
    productId,
    existingProduct.inventoryItemId ?? inventoryItem.id,
    baseUnitCode,
    movementNote,
  );

  return toProduct({ ...inventoryItem, products: data });
}

export async function deleteProduct(organizationId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createProductDetails(
  businessCenterId: string,
  organizationId: string,
  values: AddProductFormValues,
): Promise<Product> {
  const validationError =
    values.productType === 'subproducto'
      ? validateAddSubproductForm(values)
      : validateAddProductForm(values);

  if (validationError) {
    throw new Error(validationError);
  }

  const cost = parseMoneyInput(values.cost) ?? 0;
  const unitPrice = parseMoneyInput(values.unitPrice) ?? 0;
  const marginPercent = parsePercentInput(values.marginPercent) ?? 0;
  const stockQuantity = Number.parseInt(values.stockQuantity.trim(), 10);
  const reorderThreshold = Number.parseInt(values.reorderThreshold.trim(), 10);
  const baseUnitCode = normalizeBaseUnitCode(values.baseUnitCode);
  const isSubproduct = values.productType === 'subproducto';
  const parentProductId = isSubproduct ? values.parentProductId.trim() : null;
  const baseUnitEquivalent = isSubproduct
    ? parseBaseUnitEquivalent(values.baseUnitEquivalent)
    : null;

  let costCents = Math.round(cost * 100);

  if (isSubproduct && parentProductId && costCents === 0 && baseUnitEquivalent != null) {
    const { data: parentProduct, error: parentError } = await supabase
      .from('products')
      .select('metadata')
      .eq('id', parentProductId)
      .eq('organization_id', organizationId)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();

    if (parentError) {
      throw new Error(parentError.message);
    }

    const parentCost =
      typeof parentProduct?.metadata?.precio_costo_cents === 'number'
        ? parentProduct.metadata.precio_costo_cents
        : null;

    if (parentCost != null) {
      costCents = Math.round(parentCost * baseUnitEquivalent);
    }
  }

  const sku = await resolveUniqueProductSku(organizationId, values.name.trim());
  let supplier = values.supplier.trim();

  if (isSubproduct && parentProductId && supplier.length === 0) {
    const { data: parentProduct, error: parentError } = await supabase
      .from('products')
      .select('metadata')
      .eq('id', parentProductId)
      .eq('organization_id', organizationId)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();

    if (parentError) {
      throw new Error(parentError.message);
    }

    const parentSupplier =
      typeof parentProduct?.metadata?.proveedor === 'string'
        ? parentProduct.metadata.proveedor.trim()
        : '';

    if (parentSupplier) {
      supplier = parentSupplier;
    }
  }

  const metadata: Record<string, unknown> = {
    categoria: values.category.trim(),
    codigo: 'No Disponible',
    estado: values.status,
    import_source: 'mobile_create',
    precio_costo_cents: costCents,
    tipo_codigo: 'codigo_de_barras',
    tipo_producto: values.productType,
    ...(marginPercent > 0 ? { margen_pct: marginPercent } : {}),
    ...(supplier.length > 0 ? { proveedor: supplier } : {}),
    ...(baseUnitEquivalent != null ? { equivalente_unidad_base: baseUnitEquivalent } : {}),
  };

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      base_unit_code: baseUnitCode,
      currency: 'ARS',
      description: toNullableText(values.description),
      is_active: !isInactiveProductStatus(values.status),
      metadata,
      name: values.name.trim(),
      organization_id: organizationId,
      parent_product_id: parentProductId,
      pricing_unit_code: baseUnitCode,
      pricing_unit_quantity: 1,
      reorder_threshold: reorderThreshold,
      sku,
      stock_quantity: stockQuantity,
      unit_price_cents: Math.round(unitPrice * 100),
    })
    .select(
      'id, name, sku, description, unit_price_cents, currency, is_active, metadata, parent_product_id, base_unit_code',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_items')
    .insert({
      business_center_id: businessCenterId,
      organization_id: organizationId,
      product_id: product.id,
      quantity_on_hand: stockQuantity,
      reorder_threshold: reorderThreshold,
      unit_code: baseUnitCode,
    })
    .select('id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code')
    .single<Omit<InventoryProductRow, 'products'>>();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const createdProduct = toProduct({ ...inventoryItem, products: product });
  let createdLotId: string | null = null;

  if (stockQuantity > 0) {
    const receivedAtIso = dateInputToIso(values.receivedDate);

    if (!receivedAtIso) {
      throw new Error('Ingresa una fecha de lote valida.');
    }

    const receivedDate = new Date(receivedAtIso);
    const lotCodeBase = buildLotCodeBase(receivedDate);
    const existingCodes = await listLotCodesForDate(
      organizationId,
      businessCenterId,
      product.id,
      lotCodeBase,
    );
    const lotCode = buildNextLotCode(lotCodeBase, existingCodes);
    const expiresAtIso =
      values.expiresDate.trim().length > 0 ? dateInputToIso(values.expiresDate) : null;

    const { data: lot, error: lotError } = await supabase
      .from('inventory_lots')
      .insert({
        business_center_id: businessCenterId,
        expires_at: expiresAtIso,
        lot_code: lotCode,
        organization_id: organizationId,
        product_id: product.id,
        received_at: receivedAtIso,
        received_quantity: stockQuantity,
        remaining_quantity: stockQuantity,
        supplier_reference: supplier.length > 0 ? supplier : null,
        unit_code: baseUnitCode,
        unit_cost_cents: costCents,
      })
      .select('id')
      .single<{ id: string }>();

    if (lotError) {
      throw new Error(lotError.message);
    }

    createdLotId = lot.id;

    const movementNote = `Alta de producto • lote ${lotCode}${supplier ? ` • ${supplier}` : ''}`;

    const { error: movementError } = await supabase.from('inventory_movements').insert({
      business_center_id: businessCenterId,
      inventory_item_id: inventoryItem.id,
      inventory_lot_id: lot.id,
      movement_type: 'restock',
      note: movementNote,
      organization_id: organizationId,
      product_id: product.id,
      quantity_delta: stockQuantity,
      reference_type: 'product_create',
      unit_code: baseUnitCode,
    });

    if (movementError) {
      throw new Error(movementError.message);
    }

    if (isSubproduct && parentProductId && baseUnitEquivalent != null && createdLotId) {
      const parentStockDeduction = await resolveParentStockDeduction({
        businessCenterId,
        organizationId,
        parentProductId,
        quantity: stockQuantity,
        targetProduct: createdProduct,
      });

      await applyParentStockDeduction({
        businessCenterId,
        organizationId,
        parentProductId,
        parentStockDeduction,
        quantity: stockQuantity,
        subproductLotId: createdLotId,
        subproductName: createdProduct.name,
        subproductUnitCode: baseUnitCode,
        targetProduct: createdProduct,
      });
    }
  }

  return createdProduct;
}

export function createEmptyProductForm(): ProductFormValues {
  return {
    currency: 'USD',
    description: '',
    name: '',
    reorderThreshold: '0',
    sku: '',
    stockQuantity: '0',
    unitPrice: '0.00',
  };
}

export function toProductForm(product: Product): ProductFormValues {
  return {
    currency: product.currency,
    description: product.description ?? '',
    name: product.name,
    reorderThreshold: product.reorderThreshold.toString(),
    sku: product.sku ?? '',
    stockQuantity: product.stockQuantity.toString(),
    unitPrice: (product.unitPriceCents / 100).toFixed(2),
  };
}

export function validateProductForm(values: ProductFormValues): string | null {
  if (values.name.trim().length === 0) {
    return 'Product name is required.';
  }

  if (!isNonNegativeDecimal(values.stockQuantity)) {
    return 'Stock quantity must be zero or a positive number.';
  }

  if (!isNonNegativeDecimal(values.reorderThreshold)) {
    return 'Reorder threshold must be zero or a positive number.';
  }

  if (!isNonNegativeMoney(values.unitPrice)) {
    return 'Unit price must be zero or a positive amount.';
  }

  if (values.currency.trim().length !== 3) {
    return 'Currency must be a three-letter code.';
  }

  return null;
}

function toWriteRow(organizationId: string, values: ProductFormValues): ProductWriteRow {
  const validationError = validateProductForm(values);

  if (validationError) {
    throw new Error(validationError);
  }

  return {
    currency: values.currency.trim().toUpperCase(),
    base_unit_code: 'unit',
    description: toNullableText(values.description),
    name: values.name.trim(),
    organization_id: organizationId,
    reorder_threshold: Number.parseInt(values.reorderThreshold, 10),
    pricing_unit_code: 'unit',
    pricing_unit_quantity: 1,
    sku: toNullableText(values.sku),
    stock_quantity: Number.parseFloat(values.stockQuantity),
    unit_price_cents: Math.round(Number.parseFloat(values.unitPrice) * 100),
  };
}

function toProduct(row: InventoryProductRow): Product {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;

  if (!product) {
    throw new Error(`Inventory item ${row.id} is missing product data`);
  }

  const stockQuantity = Number(row.quantity_on_hand);
  const reorderThreshold = Number(row.reorder_threshold);

  return {
    baseUnitCode: product.base_unit_code,
    category: readMetadataString(product.metadata, 'categoria'),
    currency: product.currency,
    description: product.description,
    id: product.id,
    inventoryItemId: row.id,
    isActive: product.is_active,
    isLowStock: stockQuantity <= reorderThreshold,
    metadata: product.metadata ?? {},
    name: product.name,
    organizationId: row.organization_id,
    parentProductId: product.parent_product_id,
    baseUnitEquivalent: readMetadataNumber(product.metadata, 'equivalente_unidad_base'),
    productType: readMetadataString(product.metadata, 'tipo_producto'),
    reorderThreshold,
    sku: product.sku,
    stockQuantity,
    unitCode: row.unit_code,
    unitPriceCents: product.unit_price_cents,
  };
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isNonNegativeDecimal(value: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(value.trim());
}

function isNonNegativeMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}
