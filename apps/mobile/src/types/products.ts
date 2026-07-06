import type { ProductStatusSlug } from '../lib/productCatalog';

export interface Product {
  baseUnitCode: string | null;
  category: string | null;
  currency: string;
  description: string | null;
  id: string;
  inventoryItemId: string | null;
  isActive: boolean;
  isLowStock: boolean;
  metadata: Record<string, unknown>;
  name: string;
  organizationId: string;
  parentProductId: string | null;
  /** Subproduct units consumed from parent stock per 1 subproduct unit (from metadata). */
  baseUnitEquivalent: number | null;
  productType: string | null;
  reorderThreshold: number;
  sku: string | null;
  stockQuantity: number;
  unitCode: string;
  unitPriceCents: number;
}

export interface ProductEditFormValues {
  baseUnitCode: string;
  businessCenterId: string;
  category: string;
  cost: string;
  description: string;
  marginPercent: string;
  name: string;
  status: ProductStatusSlug;
  unitPrice: string;
}

export type ProductTypeSlug = 'producto' | 'subproducto';

export interface AddProductFormValues {
  baseUnitCode: string;
  baseUnitEquivalent: string;
  businessCenterId: string;
  category: string;
  cost: string;
  description: string;
  expiresDate: string;
  marginPercent: string;
  name: string;
  parentProductId: string;
  productType: ProductTypeSlug;
  receivedDate: string;
  reorderThreshold: string;
  status: ProductStatusSlug;
  stockQuantity: string;
  supplier: string;
  unitPrice: string;
}

export interface ProductFormValues {
  currency: string;
  description: string;
  name: string;
  reorderThreshold: string;
  sku: string;
  stockQuantity: string;
  unitPrice: string;
}
