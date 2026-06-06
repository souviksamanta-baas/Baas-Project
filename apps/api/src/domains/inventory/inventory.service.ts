import { Injectable } from '@nestjs/common';

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

interface InventoryItemProductRow {
  business_center_id: string;
  id: string;
  organization_id: string;
  products:
    | ProductRow
    | ProductRow[]
    | null;
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

