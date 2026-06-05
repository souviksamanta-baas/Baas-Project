import { describe, expect, it, vi } from 'vitest';

import { InventoryService } from '../src/domains/inventory/inventory.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const productRows = [
  {
    id: 'product-1',
    organization_id: 'organization-1',
    name: 'Blue Shirt',
    sku: 'SHIRT-BLUE',
    description: 'Cotton shirt',
    unit_price_cents: 2500,
    currency: 'USD',
    stock_quantity: 2,
    reorder_threshold: 5,
  },
  {
    id: 'product-2',
    organization_id: 'organization-1',
    name: 'Green Hat',
    sku: 'HAT-GREEN',
    description: null,
    unit_price_cents: 1200,
    currency: 'USD',
    stock_quantity: 12,
    reorder_threshold: 5,
  },
];

function createSupabaseService(rows = productRows): {
  eq: ReturnType<typeof vi.fn>;
  service: SupabaseService;
} {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => ({ data: rows, error: null })),
  };

  return {
    eq: query.eq,
    service: {
      getServiceRoleClient: () => ({
        from: () => query,
      }),
    } as unknown as SupabaseService,
  };
}

describe('InventoryService', () => {
  it('looks up active tenant products by name or SKU and returns stock context', async () => {
    const { eq, service } = createSupabaseService();
    const inventoryService = new InventoryService(service);

    await expect(
      inventoryService.lookupProducts({
        organizationId: 'organization-1',
        query: 'shirt',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'product-1',
        isLowStock: true,
        name: 'Blue Shirt',
        stockQuantity: 2,
        unitPriceCents: 2500,
      }),
    ]);

    expect(eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(eq).toHaveBeenCalledWith('is_active', true);
  });

  it('returns only products at or below reorder threshold for low-stock lookup', async () => {
    const { service } = createSupabaseService();
    const inventoryService = new InventoryService(service);

    await expect(
      inventoryService.listLowStockProducts({
        organizationId: 'organization-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'product-1',
        isLowStock: true,
        reorderThreshold: 5,
        stockQuantity: 2,
      }),
    ]);
  });
});
