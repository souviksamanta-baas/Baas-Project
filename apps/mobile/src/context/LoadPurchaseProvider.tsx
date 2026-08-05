import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { formatDateInput } from '../lib/addStockForm';
import { formatMoneyInput, parseMoneyInput } from '../lib/productEditForm';
import {
  registerPurchase,
  updatePurchase,
  type PurchaseLineRecord,
  type PurchaseRecord,
} from '../lib/purchases';
import type { AddStockFormValues } from '../types/inventoryLots';
import type { Product } from '../types/products';
import { useOwnerSessionContext } from './OwnerSessionProvider';

export type LoadPurchaseLine = {
  cost: string;
  id: string;
  lineTotalCents: number;
  marginPercent: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCode: string;
  unitCostCents: number;
  unitPrice: string;
  unitPriceCents: number;
};

type PurchaseDraft = {
  date: string;
  editingPurchaseId: string | null;
  lines: LoadPurchaseLine[];
  purchaseNumber: string;
  supplier: string;
};

type LoadPurchaseContextValue = {
  addLine: (input: {
    product: Product;
    values: AddStockFormValues;
  }) => void;
  clearDraft: () => void;
  date: string;
  editingPurchaseId: string | null;
  isHeaderLocked: boolean;
  isSaving: boolean;
  lines: LoadPurchaseLine[];
  loadDraftFromPurchase: (purchase: PurchaseRecord) => void;
  purchaseNumber: string;
  removeLine: (lineId: string) => void;
  savePurchase: () => Promise<void>;
  setDate: (value: string) => void;
  setPurchaseNumber: (value: string) => void;
  setSupplier: (value: string) => void;
  supplier: string;
  totalCostCents: number;
  totalItems: number;
};

const LoadPurchaseContext = createContext<LoadPurchaseContextValue | null>(null);

let purchaseLineSeq = 0;

function createLineId(): string {
  purchaseLineSeq += 1;
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `PL-${purchaseLineSeq}-${random}`;
}

function createEmptyDraft(): PurchaseDraft {
  return {
    date: formatDateInput(new Date()),
    editingPurchaseId: null,
    lines: [],
    purchaseNumber: '',
    supplier: '',
  };
}

function toPurchaseLines(lines: LoadPurchaseLine[]): PurchaseLineRecord[] {
  return lines.map((line) => ({
    cost: line.cost,
    id: line.id,
    lineTotalCents: line.lineTotalCents,
    lotId: null,
    marginPercent: line.marginPercent,
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitCode: line.unitCode,
    unitCostCents: line.unitCostCents,
    unitPrice: line.unitPrice,
    unitPriceCents: line.unitPriceCents,
  }));
}

function fromPurchaseLines(lines: PurchaseLineRecord[]): LoadPurchaseLine[] {
  return lines.map((line) => ({
    cost: line.cost,
    id: line.id || createLineId(),
    lineTotalCents: line.lineTotalCents,
    marginPercent: line.marginPercent,
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitCode: line.unitCode,
    unitCostCents: line.unitCostCents,
    unitPrice: line.unitPrice,
    unitPriceCents: line.unitPriceCents,
  }));
}

export function LoadPurchaseProvider(props: { children: ReactNode }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const [draft, setDraft] = useState(createEmptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const totalCostCents = useMemo(
    () => draft.lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    [draft.lines],
  );
  const totalItems = useMemo(
    () => draft.lines.reduce((sum, line) => sum + line.quantity, 0),
    [draft.lines],
  );

  const clearDraft = useCallback(() => {
    setDraft(createEmptyDraft());
  }, []);

  const loadDraftFromPurchase = useCallback((purchase: PurchaseRecord) => {
    setDraft({
      date: purchase.date,
      editingPurchaseId: purchase.id,
      lines: fromPurchaseLines(purchase.lines),
      purchaseNumber: purchase.number,
      supplier: purchase.supplier,
    });
  }, []);

  const setPurchaseNumber = useCallback((value: string) => {
    setDraft((current) => {
      if (current.lines.length > 0 && !current.editingPurchaseId) {
        return current;
      }

      return { ...current, purchaseNumber: value };
    });
  }, []);

  const setDate = useCallback((value: string) => {
    setDraft((current) => {
      if (current.lines.length > 0 && !current.editingPurchaseId) {
        return current;
      }

      return { ...current, date: value };
    });
  }, []);

  const setSupplier = useCallback((value: string) => {
    setDraft((current) => {
      if (current.lines.length > 0 && !current.editingPurchaseId) {
        return current;
      }

      return { ...current, supplier: value };
    });
  }, []);

  const addLine = useCallback((input: { product: Product; values: AddStockFormValues }) => {
    const snapshot = draftRef.current;
    const purchaseNumber = snapshot.purchaseNumber.trim();
    const supplier = snapshot.supplier.trim();
    const date = snapshot.date.trim();

    if (!purchaseNumber) {
      throw new Error('Ingresá el número de compra.');
    }

    if (!supplier) {
      throw new Error('Seleccioná un proveedor.');
    }

    if (!date) {
      throw new Error('Ingresá la fecha de compra.');
    }

    const quantity = Number.parseInt(input.values.quantity.trim(), 10);
    const unitCost = parseMoneyInput(input.values.cost) ?? 0;
    const unitPrice = parseMoneyInput(input.values.unitPrice) ?? 0;
    const unitCostCents = Math.round(unitCost * 100);
    const unitPriceCents = Math.round(unitPrice * 100);
    const lineTotalCents = Math.max(0, quantity * unitCostCents);

    const nextLine: LoadPurchaseLine = {
      cost: formatMoneyInput(unitCost),
      id: createLineId(),
      lineTotalCents,
      marginPercent: input.values.marginPercent,
      productId: input.product.id,
      productName: input.product.name,
      quantity,
      unitCode: input.values.unitCode.trim() || input.product.unitCode,
      unitCostCents,
      unitPrice: formatMoneyInput(unitPrice),
      unitPriceCents,
    };

    setDraft((current) => {
      if (current.lines.some((line) => line.id === nextLine.id)) {
        return current;
      }

      return {
        ...current,
        lines: [...current.lines, nextLine],
      };
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== lineId),
    }));
  }, []);

  const savePurchase = useCallback(async () => {
    if (!organizationId || !businessCenterId) {
      throw new Error('No se pudo resolver la sucursal activa.');
    }

    const snapshot = draftRef.current;
    const purchaseNumber = snapshot.purchaseNumber.trim();
    const supplier = snapshot.supplier.trim();
    const date = snapshot.date.trim();

    if (!purchaseNumber) {
      throw new Error('Ingresá el número de compra.');
    }

    if (!supplier) {
      throw new Error('Seleccioná un proveedor.');
    }

    if (!date) {
      throw new Error('Ingresá la fecha de compra.');
    }

    if (snapshot.lines.length === 0) {
      throw new Error('Agregá al menos un ítem antes de guardar la compra.');
    }

    setIsSaving(true);

    try {
      const nextTotalCostCents = snapshot.lines.reduce(
        (sum, line) => sum + line.lineTotalCents,
        0,
      );
      const nextTotalItems = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
      const lines = toPurchaseLines(snapshot.lines);

      if (snapshot.editingPurchaseId) {
        await updatePurchase({
          businessCenterId,
          organizationId,
          purchaseId: snapshot.editingPurchaseId,
          patch: {
            date,
            itemCount: nextTotalItems,
            lines,
            number: purchaseNumber,
            status: 'pending_confirmation',
            supplier,
            totalCostCents: nextTotalCostCents,
          },
        });
      } else {
        await registerPurchase({
          businessCenterId,
          date,
          itemCount: nextTotalItems,
          lines,
          number: purchaseNumber,
          organizationId,
          status: 'pending_confirmation',
          supplier,
          totalCostCents: nextTotalCostCents,
        });
      }

      setDraft(createEmptyDraft());
    } finally {
      setIsSaving(false);
    }
  }, [businessCenterId, organizationId]);

  const value = useMemo<LoadPurchaseContextValue>(
    () => ({
      addLine,
      clearDraft,
      date: draft.date,
      editingPurchaseId: draft.editingPurchaseId,
      isHeaderLocked: draft.lines.length > 0 && !draft.editingPurchaseId,
      isSaving,
      lines: draft.lines,
      loadDraftFromPurchase,
      purchaseNumber: draft.purchaseNumber,
      removeLine,
      savePurchase,
      setDate,
      setPurchaseNumber,
      setSupplier,
      supplier: draft.supplier,
      totalCostCents,
      totalItems,
    }),
    [
      addLine,
      clearDraft,
      draft.date,
      draft.editingPurchaseId,
      draft.lines,
      draft.purchaseNumber,
      draft.supplier,
      isSaving,
      loadDraftFromPurchase,
      removeLine,
      savePurchase,
      setDate,
      setPurchaseNumber,
      setSupplier,
      totalCostCents,
      totalItems,
    ],
  );

  return (
    <LoadPurchaseContext.Provider value={value}>{props.children}</LoadPurchaseContext.Provider>
  );
}

export function useLoadPurchase(): LoadPurchaseContextValue {
  const context = useContext(LoadPurchaseContext);

  if (!context) {
    throw new Error('useLoadPurchase must be used within LoadPurchaseProvider');
  }

  return context;
}

export function useOptionalLoadPurchase(): LoadPurchaseContextValue | null {
  return useContext(LoadPurchaseContext);
}
