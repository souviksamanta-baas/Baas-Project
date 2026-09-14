import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

export interface InventoryProduct {
  businessCenterId: string;
  currency: string;
  description: string | null;
  id: string;
  isLowStock: boolean;
  name: string;
  organizationId: string;
  reorderThreshold: number;
  sku: string | null;
  stockQuantity: number;
  unitCode: string;
  unitPriceCents: number;
}

export interface AddStockResult {
  inventoryItemId: string;
  lotId: string;
  productId: string;
  quantityAdded: number;
  quantityOnHand: number;
}

export interface CreateProductResult {
  inventoryItemId: string;
  lotId: string | null;
  product: InventoryProduct;
}

interface InventoryItemProductRow {
  business_center_id: string;
  id: string;
  organization_id: string;
  products: ProductRow | ProductRow[] | null;
  quantity_on_hand: string | number;
  reorder_threshold: string | number;
  unit_code: string;
}

interface ProductRow {
  currency: string;
  description: string | null;
  id: string;
  name: string;
  sku: string | null;
  unit_price_cents: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async lookupProducts(params: {
    businessCenterId?: string;
    organizationId: string;
    query: string;
    limit?: number;
  }): Promise<InventoryProduct[]> {
    const normalizedQuery = params.query.trim();

    if (normalizedQuery.length === 0) {
      return [];
    }

    const products = await this.listActiveProducts({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      limit: 250,
    });

    const normalizedSearch = normalizedQuery.toLocaleLowerCase();
    return products
      .filter((product) => {
        return (
          product.name.toLocaleLowerCase().includes(normalizedSearch) ||
          product.sku?.toLocaleLowerCase().includes(normalizedSearch)
        );
      })
      .slice(0, params.limit ?? 10);
  }

  async listLowStockProducts(params: {
    businessCenterId?: string;
    organizationId: string;
    limit?: number;
  }): Promise<InventoryProduct[]> {
    const products = await this.listActiveProducts(params);

    return products
      .filter((product) => product.stockQuantity <= product.reorderThreshold)
      .sort((left, right) => left.stockQuantity - right.stockQuantity)
      .slice(0, params.limit ?? 25);
  }

  async listActiveProducts(params: {
    businessCenterId?: string;
    organizationId: string;
    limit?: number;
  }): Promise<InventoryProduct[]> {
    const businessCenterId =
      params.businessCenterId ?? (await this.getDefaultBusinessCenterId(params.organizationId));
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('inventory_items')
      .select(
        'id, organization_id, business_center_id, quantity_on_hand, reorder_threshold, unit_code, products!inner(id, name, sku, description, unit_price_cents, currency)',
      )
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', businessCenterId)
      .eq('products.is_active', true)
      .limit(params.limit ?? 100);

    if (error) {
      throw new Error(`Failed to list active inventory products: ${error.message}`);
    }

    return (data as InventoryItemProductRow[])
      .map(toInventoryProduct)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Service-role stock intake (Copi / Nest). Simplified vs mobile addStock:
   * no parent-product deduction, optional pricing fields.
   */
  async addStock(params: {
    businessCenterId: string;
    costCents?: number | null;
    createdByUserId?: string | null;
    marginPercent?: number | null;
    organizationId: string;
    productId: string;
    quantity: number;
    receivedAt?: string | null;
    unitPriceCents?: number | null;
  }): Promise<AddStockResult> {
    const quantity = requirePositiveInt(params.quantity, 'La cantidad debe ser un entero positivo.');
    const receivedAt = normalizeReceivedAt(params.receivedAt);
    const client = this.supabaseService.getServiceRoleClient();

    const { data: inventoryItem, error: itemError } = await client
      .from('inventory_items')
      .select(
        'id, quantity_on_hand, unit_code, products!inner(id, name, unit_price_cents, metadata, base_unit_code)',
      )
      .eq('organization_id', params.organizationId)
      .eq('business_center_id', params.businessCenterId)
      .eq('product_id', params.productId)
      .maybeSingle<{
        id: string;
        products:
          | {
              base_unit_code: string | null;
              id: string;
              metadata: Record<string, unknown> | null;
              name: string;
              unit_price_cents: number;
            }
          | Array<{
              base_unit_code: string | null;
              id: string;
              metadata: Record<string, unknown> | null;
              name: string;
              unit_price_cents: number;
            }>
          | null;
        quantity_on_hand: string | number;
        unit_code: string;
      }>();

    if (itemError) {
      throw new BadRequestException(itemError.message);
    }
    if (!inventoryItem) {
      throw new NotFoundException('No se encontró el producto en el inventario de esta sucursal.');
    }

    const product = Array.isArray(inventoryItem.products)
      ? inventoryItem.products[0]
      : inventoryItem.products;
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const unitCode = inventoryItem.unit_code || product.base_unit_code || 'unit';
    const costCents =
      params.costCents != null && Number.isFinite(params.costCents)
        ? Math.max(0, Math.round(params.costCents))
        : typeof product.metadata?.precio_costo_cents === 'number'
          ? product.metadata.precio_costo_cents
          : 0;
    const unitPriceCents =
      params.unitPriceCents != null && Number.isFinite(params.unitPriceCents)
        ? Math.max(0, Math.round(params.unitPriceCents))
        : product.unit_price_cents;
    const marginPercent =
      params.marginPercent != null && Number.isFinite(params.marginPercent)
        ? params.marginPercent
        : typeof product.metadata?.margen_pct === 'number'
          ? product.metadata.margen_pct
          : null;

    const lotCode = `COPI-${receivedAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    const { data: lot, error: lotError } = await client
      .from('inventory_lots')
      .insert({
        business_center_id: params.businessCenterId,
        expires_at: null,
        lot_code: lotCode,
        organization_id: params.organizationId,
        product_id: params.productId,
        received_at: receivedAt,
        received_quantity: quantity,
        remaining_quantity: quantity,
        supplier_reference: null,
        unit_code: unitCode,
        unit_cost_cents: costCents,
      })
      .select('id')
      .single<{ id: string }>();

    if (lotError || !lot) {
      throw new BadRequestException(lotError?.message ?? 'No se pudo crear el lote.');
    }

    const nextQuantity = Number(inventoryItem.quantity_on_hand) + quantity;
    const { error: inventoryError } = await client
      .from('inventory_items')
      .update({ quantity_on_hand: nextQuantity })
      .eq('id', inventoryItem.id)
      .eq('organization_id', params.organizationId);

    if (inventoryError) {
      throw new BadRequestException(inventoryError.message);
    }

    const metadata: Record<string, unknown> = {
      ...(product.metadata ?? {}),
      precio_costo_cents: costCents,
      ...(marginPercent != null ? { margen_pct: marginPercent } : {}),
    };

    const { error: productError } = await client
      .from('products')
      .update({
        metadata,
        unit_price_cents: unitPriceCents,
      })
      .eq('id', params.productId)
      .eq('organization_id', params.organizationId);

    if (productError) {
      throw new BadRequestException(productError.message);
    }

    const { error: movementError } = await client.from('inventory_movements').insert({
      business_center_id: params.businessCenterId,
      inventory_item_id: inventoryItem.id,
      inventory_lot_id: lot.id,
      movement_type: 'restock',
      note: `Ingreso de lote ${lotCode}${params.createdByUserId ? ' · Copi' : ''}`,
      organization_id: params.organizationId,
      product_id: params.productId,
      quantity_delta: quantity,
      reference_type: 'stock_intake',
      unit_code: unitCode,
    });

    if (movementError) {
      throw new BadRequestException(movementError.message);
    }

    return {
      inventoryItemId: inventoryItem.id,
      lotId: lot.id,
      productId: params.productId,
      quantityAdded: quantity,
      quantityOnHand: nextQuantity,
    };
  }

  /**
   * Service-role product create (Copi / Nest). Simplified vs mobile createProductDetails:
   * no subproduct/parent deduction; optional initial stock creates one lot.
   */
  async createProduct(params: {
    businessCenterId: string;
    category: string;
    costCents?: number | null;
    marginPercent?: number | null;
    name: string;
    organizationId: string;
    reorderThreshold?: number | null;
    stockQuantity?: number | null;
    unitPriceCents?: number | null;
  }): Promise<CreateProductResult> {
    const name = params.name.trim();
    const category = params.category.trim();
    if (!name) {
      throw new BadRequestException('El nombre del producto es obligatorio.');
    }
    if (!category) {
      throw new BadRequestException('La categoría del producto es obligatoria.');
    }

    const stockQuantity =
      params.stockQuantity == null
        ? 0
        : requireNonNegativeInt(params.stockQuantity, 'La cantidad de stock no puede ser negativa.');
    const reorderThreshold =
      params.reorderThreshold == null
        ? 5
        : requireNonNegativeInt(
            params.reorderThreshold,
            'El umbral de reposición no puede ser negativo.',
          );
    const costCents =
      params.costCents != null && Number.isFinite(params.costCents)
        ? Math.max(0, Math.round(params.costCents))
        : 0;
    const unitPriceCents =
      params.unitPriceCents != null && Number.isFinite(params.unitPriceCents)
        ? Math.max(0, Math.round(params.unitPriceCents))
        : 0;
    const marginPercent =
      params.marginPercent != null && Number.isFinite(params.marginPercent)
        ? params.marginPercent
        : null;

    const client = this.supabaseService.getServiceRoleClient();
    const sku = await this.resolveUniqueSku(params.organizationId, name);
    const unitCode = 'unit';
    const metadata: Record<string, unknown> = {
      categoria: category,
      codigo: 'No Disponible',
      estado: 'en_stock',
      import_source: 'copi_create',
      precio_costo_cents: costCents,
      tipo_codigo: 'codigo_de_barras',
      tipo_producto: 'producto',
      ...(marginPercent != null ? { margen_pct: marginPercent } : {}),
    };

    const { data: product, error: productError } = await client
      .from('products')
      .insert({
        base_unit_code: unitCode,
        currency: 'ARS',
        description: null,
        is_active: true,
        metadata,
        name,
        organization_id: params.organizationId,
        parent_product_id: null,
        pricing_unit_code: unitCode,
        pricing_unit_quantity: 1,
        reorder_threshold: reorderThreshold,
        sku,
        stock_quantity: stockQuantity,
        unit_price_cents: unitPriceCents,
      })
      .select('id, name, sku, description, unit_price_cents, currency')
      .single<ProductRow>();

    if (productError || !product) {
      throw new BadRequestException(productError?.message ?? 'No se pudo crear el producto.');
    }

    const { data: inventoryItem, error: inventoryError } = await client
      .from('inventory_items')
      .insert({
        business_center_id: params.businessCenterId,
        organization_id: params.organizationId,
        product_id: product.id,
        quantity_on_hand: stockQuantity,
        reorder_threshold: reorderThreshold,
        unit_code: unitCode,
      })
      .select('id')
      .single<{ id: string }>();

    if (inventoryError || !inventoryItem) {
      throw new BadRequestException(
        inventoryError?.message ?? 'No se pudo crear el ítem de inventario.',
      );
    }

    let lotId: string | null = null;
    if (stockQuantity > 0) {
      const receivedAt = new Date().toISOString();
      const lotCode = `COPI-${receivedAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const { data: lot, error: lotError } = await client
        .from('inventory_lots')
        .insert({
          business_center_id: params.businessCenterId,
          expires_at: null,
          lot_code: lotCode,
          organization_id: params.organizationId,
          product_id: product.id,
          received_at: receivedAt,
          received_quantity: stockQuantity,
          remaining_quantity: stockQuantity,
          supplier_reference: null,
          unit_code: unitCode,
          unit_cost_cents: costCents,
        })
        .select('id')
        .single<{ id: string }>();

      if (lotError || !lot) {
        throw new BadRequestException(lotError?.message ?? 'No se pudo crear el lote inicial.');
      }

      lotId = lot.id;

      const { error: movementError } = await client.from('inventory_movements').insert({
        business_center_id: params.businessCenterId,
        inventory_item_id: inventoryItem.id,
        inventory_lot_id: lot.id,
        movement_type: 'restock',
        note: `Alta de producto · lote ${lotCode} · Copi`,
        organization_id: params.organizationId,
        product_id: product.id,
        quantity_delta: stockQuantity,
        reference_type: 'stock_intake',
        unit_code: unitCode,
      });

      if (movementError) {
        throw new BadRequestException(movementError.message);
      }
    }

    return {
      inventoryItemId: inventoryItem.id,
      lotId,
      product: {
        businessCenterId: params.businessCenterId,
        currency: product.currency,
        description: product.description,
        id: product.id,
        isLowStock: stockQuantity <= reorderThreshold,
        name: product.name,
        organizationId: params.organizationId,
        reorderThreshold,
        sku: product.sku,
        stockQuantity,
        unitCode,
        unitPriceCents: product.unit_price_cents,
      },
    };
  }

  private async resolveUniqueSku(organizationId: string, name: string): Promise<string> {
    const base = name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleUpperCase('es-AR')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
    const prefix = base.length > 0 ? base : 'PRODUCTO';
    const client = this.supabaseService.getServiceRoleClient();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate =
        attempt === 0 ? prefix : `${prefix}-${(Date.now() + attempt).toString(36).toUpperCase()}`;
      const { data, error } = await client
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('sku', candidate)
        .maybeSingle();

      if (error) {
        throw new BadRequestException(error.message);
      }
      if (!data) {
        return candidate;
      }
    }

    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async getDefaultBusinessCenterId(organizationId: string): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to load default business center: ${error.message}`);
    }

    return data.id;
  }
}

function toInventoryProduct(row: InventoryItemProductRow): InventoryProduct {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;

  if (!product) {
    throw new Error(`Inventory item ${row.id} is missing product data`);
  }

  const stockQuantity = Number(row.quantity_on_hand);
  const reorderThreshold = Number(row.reorder_threshold);

  return {
    businessCenterId: row.business_center_id,
    currency: product.currency,
    description: product.description,
    id: product.id,
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

function requirePositiveInt(value: number, message: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(message);
  }
  return value;
}

function requireNonNegativeInt(value: number, message: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException(message);
  }
  return value;
}

function normalizeReceivedAt(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return new Date().toISOString();
  }
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('La fecha de recepción no es válida.');
  }
  return parsed.toISOString();
}
