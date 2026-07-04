import { isInactiveProductStatus, normalizeBaseUnitCode } from '../lib/productCatalog';
import {
  buildProductEditMovementNote,
  type InventoryMovementRow,
  mapInventoryMovementRow,
} from '../lib/inventoryMovements';
import { parseMoneyInput, parsePercentInput, validateProductEditForm } from '../lib/productEditForm';
import { removeExistingRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import type { Product, ProductEditFormValues, ProductFormValues } from '../types/products';
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
  const metadata = {
    ...existingProduct.metadata,
    categoria: values.category.trim(),
    estado: values.status,
    margen_pct: marginPercent,
    precio_costo_cents: Math.round(cost * 100),
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
