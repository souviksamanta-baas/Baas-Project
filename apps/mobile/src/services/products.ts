import { supabase } from '../lib/supabase';
import type { Product, ProductFormValues } from '../types/products';

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
  currency: string;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
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
      'id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code, products!inner(id, name, sku, description, unit_price_cents, currency, is_active)',
    )
    .eq('organization_id', organizationId)
    .eq('business_center_id', businessCenterId)
    .eq('products.is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return (data as InventoryProductRow[]).map(toProduct).sort((left, right) => left.name.localeCompare(right.name));
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
    currency: product.currency,
    description: product.description,
    id: product.id,
    isActive: product.is_active,
    isLowStock: stockQuantity <= reorderThreshold,
    name: product.name,
    organizationId: row.organization_id,
    reorderThreshold,
    sku: product.sku,
    stockQuantity,
    unitCode: row.unit_code,
    unitPriceCents: product.unit_price_cents,
  };
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
