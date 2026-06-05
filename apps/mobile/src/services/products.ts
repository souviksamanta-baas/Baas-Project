import { supabase } from '../lib/supabase';
import type { Product, ProductFormValues } from '../types/products';

interface ProductRow {
  currency: string;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
  organization_id: string;
  reorder_threshold: number;
  sku: string | null;
  stock_quantity: number;
  unit_price_cents: number;
}

interface ProductWriteRow {
  currency: string;
  description: string | null;
  name: string;
  organization_id: string;
  reorder_threshold: number;
  sku: string | null;
  stock_quantity: number;
  unit_price_cents: number;
}

export async function getProducts(organizationId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, organization_id, name, sku, description, unit_price_cents, currency, stock_quantity, reorder_threshold, is_active',
    )
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProductRow[]).map(toProduct);
}

export async function createProduct(
  organizationId: string,
  values: ProductFormValues,
): Promise<Product> {
  const row = toWriteRow(organizationId, values);
  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select(
      'id, organization_id, name, sku, description, unit_price_cents, currency, stock_quantity, reorder_threshold, is_active',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toProduct(data);
}

export async function updateProduct(
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
      'id, organization_id, name, sku, description, unit_price_cents, currency, stock_quantity, reorder_threshold, is_active',
    )
    .single<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toProduct(data);
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

  if (!isNonNegativeInteger(values.stockQuantity)) {
    return 'Stock quantity must be zero or a positive whole number.';
  }

  if (!isNonNegativeInteger(values.reorderThreshold)) {
    return 'Reorder threshold must be zero or a positive whole number.';
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
    description: toNullableText(values.description),
    name: values.name.trim(),
    organization_id: organizationId,
    reorder_threshold: Number.parseInt(values.reorderThreshold, 10),
    sku: toNullableText(values.sku),
    stock_quantity: Number.parseInt(values.stockQuantity, 10),
    unit_price_cents: Math.round(Number.parseFloat(values.unitPrice) * 100),
  };
}

function toProduct(row: ProductRow): Product {
  return {
    currency: row.currency,
    description: row.description,
    id: row.id,
    isActive: row.is_active,
    isLowStock: row.stock_quantity <= row.reorder_threshold,
    name: row.name,
    organizationId: row.organization_id,
    reorderThreshold: row.reorder_threshold,
    sku: row.sku,
    stockQuantity: row.stock_quantity,
    unitPriceCents: row.unit_price_cents,
  };
}

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function isNonNegativeMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}
