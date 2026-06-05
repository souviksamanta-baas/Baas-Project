import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  createEmptyProductForm,
  createProduct,
  deleteProduct,
  getProducts,
  toProductForm,
  updateProduct,
  validateProductForm,
} from '../services/products';
import { supabase } from '../lib/supabase';
import type { Product, ProductFormValues } from '../types/products';

export interface ProductCatalogState {
  editingProductId: string | null;
  errorMessage: string | null;
  formValues: ProductFormValues;
  isLoading: boolean;
  isSaving: boolean;
  products: Product[];
  resetForm: () => void;
  saveProduct: () => Promise<void>;
  setFormValue: (field: keyof ProductFormValues, value: string) => void;
  startEditing: (product: Product) => void;
  deleteProductById: (productId: string) => Promise<void>;
}

export function useProducts(organizationId: string | null): ProductCatalogState {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ProductFormValues>(createEmptyProductForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const loadProducts = useCallback(async (): Promise<void> => {
    if (!organizationId) {
      setProducts([]);
      return;
    }

    const nextProducts = await getProducts(organizationId);
    setProducts(nextProducts);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setProducts([]);
      setEditingProductId(null);
      setFormValues(createEmptyProductForm());
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    loadProducts()
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

    const channel = supabase
      .channel(`products:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void loadProducts();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [loadProducts, organizationId]);

  const resetForm = useCallback(() => {
    setEditingProductId(null);
    setFormValues(createEmptyProductForm());
  }, []);

  const saveProduct = useCallback(async (): Promise<void> => {
    if (!organizationId) {
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
        await updateProduct(organizationId, editingProductId, formValues);
      } else {
        await createProduct(organizationId, formValues);
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      Alert.alert('Could not save product', message);
    } finally {
      setIsSaving(false);
    }
  }, [editingProductId, formValues, loadProducts, organizationId, resetForm]);

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
        await loadProducts();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        Alert.alert('Could not delete product', message);
      } finally {
        setIsSaving(false);
      }
    },
    [editingProductId, loadProducts, organizationId, resetForm],
  );

  return {
    editingProductId,
    errorMessage,
    formValues,
    isLoading,
    isSaving,
    products,
    resetForm,
    saveProduct,
    setFormValue: (field, value) => {
      setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
    },
    startEditing,
    deleteProductById,
  };
}
