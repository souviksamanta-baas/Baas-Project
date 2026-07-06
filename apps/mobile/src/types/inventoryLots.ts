export interface InventoryLot {
  expiresAt: string | null;
  id: string;
  lotCode: string | null;
  productId: string;
  receivedAt: string;
  receivedQuantity: number;
  remainingQuantity: number;
  supplierReference: string | null;
  unitCode: string;
  unitCostCents: number | null;
}

export interface AddStockFormValues {
  cost: string;
  marginPercent: string;
  quantity: string;
  receivedDate: string;
  supplier: string;
  targetProductId: string;
  unitCode: string;
  unitPrice: string;
}
