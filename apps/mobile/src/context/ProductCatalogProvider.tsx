import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import {
  createEmptyProductForm,
  createProduct,
  deleteProduct,
  getProducts,
  subscribeToProductCatalogChanges,
  toProductForm,
  updateProduct,
  validateProductForm,
} from '../api/inventory';
import { useOwnerSessionContext } from './OwnerSessionProvider';
import type { Product, ProductFormValues } from '../types/products';

export interface ProductCatalogState {
  editingProductId: string | null;
  errorMessage: string | null;
  formValues: ProductFormValues;
  isLoading: boolean;
  isSaving: boolean;
  products: Product[];
  reloadProducts: () => Promise<void>;
  resetForm: () => void;
  saveProduct: () => Promise<void>;
  setFormValue: (field: keyof ProductFormValues, value: string) => void;
  startEditing: (product: Product) => void;
  deleteProductById: (productId: string) => Promise<void>;
}

const ProductCatalogContext = createContext<ProductCatalogState | null>(null);

const REALTIME_DEBOUNCE_MS = 400;
const REALTIME_SUPPRESS_MS = 2000;

export function ProductCatalogProvider(props: { children: ReactNode }): ReactElement {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ProductFormValues>(createEmptyProductForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const suppressRealtimeUntilRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProductsImmediate = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      setProducts([]);
      return;
    }

    const nextProducts = await getProducts(organizationId, businessCenterId);
    setProducts(nextProducts);
  }, [businessCenterId, organizationId]);

  const scheduleLoadProducts = useCallback(() => {
    if (Date.now() < suppressRealtimeUntilRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;

      void loadProductsImmediate().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
      });
    }, REALTIME_DEBOUNCE_MS);
  }, [loadProductsImmediate]);

  const reloadProducts = useCallback(async (): Promise<void> => {
    suppressRealtimeUntilRef.current = Date.now() + REALTIME_SUPPRESS_MS;
    await loadProductsImmediate();
  }, [loadProductsImmediate]);

  useEffect(() => {
    if (!organizationId || !businessCenterId) {
      setProducts([]);
      setEditingProductId(null);
      setFormValues(createEmptyProductForm());
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    loadProductsImmediate()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not load products', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToProductCatalogChanges(organizationId, businessCenterId, () => {
      scheduleLoadProducts();
    });

    return () => {
      mounted = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      unsubscribe();
    };
  }, [businessCenterId, loadProductsImmediate, organizationId, scheduleLoadProducts]);

  const resetForm = useCallback(() => {
    setEditingProductId(null);
    setFormValues(createEmptyProductForm());
  }, []);

  const saveProduct = useCallback(async (): Promise<void> => {
    if (!organizationId || !businessCenterId) {
      return;
    }

    const validationError = validateProductForm(formValues);
    if (validationError) {
      Alert.alert('Check product details', validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (editingProductId) {
        await updateProduct(businessCenterId, organizationId, editingProductId, formValues);
      } else {
        await createProduct(businessCenterId, organizationId, formValues);
      }

      resetForm();
      await reloadProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      Alert.alert('Could not save product', message);
    } finally {
      setIsSaving(false);
    }
  }, [
    businessCenterId,
    editingProductId,
    formValues,
    organizationId,
    reloadProducts,
    resetForm,
  ]);

  const startEditing = useCallback((product: Product) => {
    setEditingProductId(product.id);
    setFormValues(toProductForm(product));
  }, []);

  const deleteProductById = useCallback(
    async (productId: string): Promise<void> => {
      if (!organizationId) {
        return;
      }

      setIsSaving(true);
      setErrorMessage(null);

      try {
        await deleteProduct(organizationId, productId);
        if (editingProductId === productId) {
          resetForm();
        }
        await reloadProducts();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not delete product', message);
      } finally {
        setIsSaving(false);
      }
    },
    [editingProductId, organizationId, reloadProducts, resetForm],
  );

  const value = useMemo(
    (): ProductCatalogState => ({
      deleteProductById,
      editingProductId,
      errorMessage,
      formValues,
      isLoading,
      isSaving,
      products,
      reloadProducts,
      resetForm,
      saveProduct,
      setFormValue: (field, value) => {
        setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
      },
      startEditing,
    }),
    [
      deleteProductById,
      editingProductId,
      errorMessage,
      formValues,
      isLoading,
      isSaving,
      products,
      reloadProducts,
      resetForm,
      saveProduct,
      startEditing,
    ],
  );

  return (
    <ProductCatalogContext.Provider value={value}>{props.children}</ProductCatalogContext.Provider>
  );
}

export function useProductCatalog(): ProductCatalogState {
  const context = useContext(ProductCatalogContext);

  if (!context) {
    throw new Error('useProductCatalog must be used within ProductCatalogProvider');
  }

  return context;
}
