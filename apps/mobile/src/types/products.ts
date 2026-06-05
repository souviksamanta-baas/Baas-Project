export interface Product {
  currency: string;
  description: string | null;
  id: string;
  isActive: boolean;
  isLowStock: boolean;
  name: string;
  organizationId: string;
  reorderThreshold: number;
  sku: string | null;
  stockQuantity: number;
  unitPriceCents: number;
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
