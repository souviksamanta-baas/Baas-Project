import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

export interface InventoryProduct {
  currency: string;
  description: string | null;
  id: string;
  isLowStock: boolean;
  name: string;
  organizationId: string;
  reorderThreshold: number;
  sku: string | null;
  stockQuantity: number;
  unitPriceCents: number;
}

interface ProductRow {
  currency: string;
  description: string | null;
  id: string;
  name: string;
  organization_id: string;
  reorder_threshold: number;
  sku: string | null;
  stock_quantity: number;
  unit_price_cents: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async lookupProducts(params: {
    organizationId: string;
    query: string;
    limit?: number;
  }): Promise<InventoryProduct[]> {
    const normalizedQuery = params.query.trim();

    if (normalizedQuery.length === 0) {
      return [];
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('products')
      .select(
        'id, organization_id, name, sku, description, unit_price_cents, currency, stock_quantity, reorder_threshold',
      )
      .eq('organization_id', params.organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to lookup inventory products: ${error.message}`);
    }

    const normalizedSearch = normalizedQuery.toLocaleLowerCase();
    return (data as ProductRow[])
      .filter((row) => {
        return (
          row.name.toLocaleLowerCase().includes(normalizedSearch) ||
          row.sku?.toLocaleLowerCase().includes(normalizedSearch)
        );
      })
      .slice(0, params.limit ?? 10)
      .map(toInventoryProduct);
  }

  async listLowStockProducts(params: {
    organizationId: string;
    limit?: number;
  }): Promise<InventoryProduct[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('products')
      .select(
        'id, organization_id, name, sku, description, unit_price_cents, currency, stock_quantity, reorder_threshold',
      )
      .eq('organization_id', params.organizationId)
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (error) {
      throw new Error(`Failed to list low-stock products: ${error.message}`);
    }

    return (data as ProductRow[])
      .filter((row) => row.stock_quantity <= row.reorder_threshold)
      .slice(0, params.limit ?? 25)
      .map(toInventoryProduct);
  }
}

function toInventoryProduct(row: ProductRow): InventoryProduct {
  return {
    currency: row.currency,
    description: row.description,
    id: row.id,
    isLowStock: row.stock_quantity <= row.reorder_threshold,
    name: row.name,
    organizationId: row.organization_id,
    reorderThreshold: row.reorder_threshold,
    sku: row.sku,
    stockQuantity: row.stock_quantity,
    unitPriceCents: row.unit_price_cents,
  };
}

