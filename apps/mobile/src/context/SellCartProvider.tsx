import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import type { Product } from '../types/products';
import {
  buildCheckoutDraft,
  computeCartSubtotalCents,
  computeDiscountCents,
  computeSaleTotalCents,
  createCartLineFromProduct,
  formatCurrency,
  formatSignedCurrency,
  formatUnitQuantity,
  getCartLineSubtotalCents,
  getEffectiveGrams,
  mergeCartLine,
  saveSellQuote,
  WEIGHT_GRAMS_PLACEHOLDER,
  type SellCartLine,
  type SellDiscountMode,
} from '../lib/sellCart';

type SellCartContextValue = {
  addProduct: (product: Product) => void;
  canSaveQuote: boolean;
  cart: SellCartLine[];
  clearCart: () => void;
  decreaseLineQuantity: (lineId: string) => void;
  discountInput: string;
  discountMode: SellDiscountMode;
  discountTotalCents: number;
  focusLineGrams: (lineId: string) => void;
  increaseLineQuantity: (lineId: string) => void;
  quoteMessage: string | null;
  removeLine: (lineId: string) => void;
  saveQuote: () => Promise<string>;
  setDiscountInput: (value: string) => void;
  setDiscountMode: (mode: SellDiscountMode) => void;
  setLineGrams: (lineId: string, value: string) => void;
  subtotalCents: number;
  syncCartPrices: (products: Product[]) => void;
  totalCents: number;
};

const SellCartContext = createContext<SellCartContextValue | null>(null);

export function SellCartProvider(props: { children: ReactNode }): ReactElement {
  const [cart, setCart] = useState<SellCartLine[]>([]);
  const [discountMode, setDiscountModeState] = useState<SellDiscountMode>('percent');
  const [discountInput, setDiscountInputState] = useState('');
  const [isCartDirty, setIsCartDirty] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);

  const markDirty = useCallback(() => {
    setIsCartDirty(true);
    setQuoteMessage(null);
  }, []);

  const subtotalCents = useMemo(() => computeCartSubtotalCents(cart), [cart]);
  const discountValue = useMemo(() => {
    const trimmed = discountInput.trim().replace(',', '.');

    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [discountInput]);
  const discountTotalCents = useMemo(
    () => computeDiscountCents(subtotalCents, discountMode, discountValue),
    [discountMode, discountValue, subtotalCents],
  );
  const totalCents = useMemo(
    () => computeSaleTotalCents(subtotalCents, discountMode, discountValue),
    [discountMode, discountValue, subtotalCents],
  );
  const canSaveQuote = cart.length > 0 && isCartDirty;

  const addProduct = useCallback(
    (product: Product) => {
      setCart((current) => mergeCartLine(current, createCartLineFromProduct(product)));
      markDirty();
    },
    [markDirty],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      setCart((current) => current.filter((line) => line.id !== lineId));
      markDirty();
    },
    [markDirty],
  );

  const increaseLineQuantity = useCallback(
    (lineId: string) => {
      setCart((current) =>
        current.map((line) => {
          if (line.id !== lineId) {
            return line;
          }

          if (line.soldByWeight) {
            const grams = getEffectiveGrams(line) + 100;
            return { ...line, weightGramsInput: String(grams) };
          }

          return { ...line, quantity: line.quantity + 1 };
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const decreaseLineQuantity = useCallback(
    (lineId: string) => {
      setCart((current) =>
        current.flatMap((line) => {
          if (line.id !== lineId) {
            return [line];
          }

          if (line.soldByWeight) {
            const grams = getEffectiveGrams(line) - 100;
            if (grams < 100) {
              return [line];
            }

            return [{ ...line, weightGramsInput: String(grams) }];
          }

          if (line.quantity <= 1) {
            return [];
          }

          return [{ ...line, quantity: line.quantity - 1 }];
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const focusLineGrams = useCallback((lineId: string) => {
    setCart((current) =>
      current.map((line) => {
        if (line.id !== lineId || !line.soldByWeight || line.weightGramsInput !== null) {
          return line;
        }

        return { ...line, weightGramsInput: '' };
      }),
    );
  }, []);

  const setLineGrams = useCallback(
    (lineId: string, value: string) => {
      const digits = value.replace(/[^\d]/g, '');

      setCart((current) =>
        current.map((line) => {
          if (line.id !== lineId || !line.soldByWeight) {
            return line;
          }

          return { ...line, weightGramsInput: digits };
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const setDiscountInput = useCallback(
    (value: string) => {
      setDiscountInputState(value);
      markDirty();
    },
    [markDirty],
  );

  const setDiscountMode = useCallback(
    (mode: SellDiscountMode) => {
      setDiscountModeState(mode);
      markDirty();
    },
    [markDirty],
  );

  const syncCartPrices = useCallback((products: Product[]) => {
    let changed = false;

    setCart((current) => {
      const next = current.map((line) => {
        const product = products.find((item) => item.id === line.productId);

        if (!product) {
          return line;
        }

        if (product.name === line.name && product.unitPriceCents === line.unitPriceCents) {
          return line;
        }

        changed = true;
        return {
          ...line,
          name: product.name,
          unitPriceCents: product.unitPriceCents,
        };
      });

      return next;
    });

    if (changed) {
      setIsCartDirty(true);
      setQuoteMessage(null);
    }
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setIsCartDirty(false);
    setQuoteMessage(null);
  }, []);

  const saveQuote = useCallback(async () => {
    const quoteId = await saveSellQuote(buildCheckoutDraft(cart, discountMode, discountInput));
    setIsCartDirty(false);
    setQuoteMessage(`Presupuesto guardado. ID: ${quoteId}`);
    return quoteId;
  }, [cart, discountInput, discountMode]);

  const value = useMemo(
    (): SellCartContextValue => ({
      addProduct,
      canSaveQuote,
      cart,
      clearCart,
      decreaseLineQuantity,
      discountInput,
      discountMode,
      discountTotalCents,
      focusLineGrams,
      increaseLineQuantity,
      quoteMessage,
      removeLine,
      saveQuote,
      setDiscountInput,
      setDiscountMode,
      setLineGrams,
      subtotalCents,
      syncCartPrices,
      totalCents,
    }),
    [
      addProduct,
      canSaveQuote,
      cart,
      clearCart,
      decreaseLineQuantity,
      discountInput,
      discountMode,
      discountTotalCents,
      focusLineGrams,
      increaseLineQuantity,
      quoteMessage,
      removeLine,
      saveQuote,
      setDiscountInput,
      setDiscountMode,
      setLineGrams,
      subtotalCents,
      syncCartPrices,
      totalCents,
    ],
  );

  return <SellCartContext.Provider value={value}>{props.children}</SellCartContext.Provider>;
}

export function useSellCart(): SellCartContextValue {
  const context = useContext(SellCartContext);

  if (!context) {
    throw new Error('useSellCart must be used within SellCartProvider');
  }

  return context;
}

export function mapCartLineToView(line: SellCartLine) {
  const grams = getEffectiveGrams(line);

  return {
    gramsShowPlaceholder: line.soldByWeight && line.weightGramsInput === null,
    gramsValue: line.soldByWeight ? (line.weightGramsInput ?? '') : undefined,
    id: line.id,
    lineTotal: formatCurrency(getCartLineSubtotalCents(line)),
    name: line.name,
    quantityLabel: line.soldByWeight ? `${grams} g` : formatUnitQuantity(line.quantity),
    soldByWeight: line.soldByWeight,
    unitQuantity: line.quantity,
  };
}

export function formatSaleDiscountLabel(discountMode: SellDiscountMode, discountValue: number): string {
  if (discountValue <= 0) {
    return 'Descuento';
  }

  if (discountMode === 'percent') {
    return `Descuento ${discountValue}%`;
  }

  return 'Descuento';
}

export function formatSaleDiscountValue(discountTotalCents: number): string {
  if (discountTotalCents <= 0) {
    return '$0,00';
  }

  return formatSignedCurrency(discountTotalCents);
}

export { WEIGHT_GRAMS_PLACEHOLDER };
