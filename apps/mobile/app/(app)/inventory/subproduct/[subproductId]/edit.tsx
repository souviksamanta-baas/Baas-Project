import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { listBusinessCenters } from '../../../../../src/api/dashboard';
import { updateProductDetails } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useInventorySubproduct } from '../../../../../src/hooks/useInventoryProduct';
import { useProducts } from '../../../../../src/hooks/useProducts';
import { collectCategoryOptions } from '../../../../../src/lib/productCatalog';
import { navigateSubproductReturn } from '../../../../../src/navigation/inventoryNavigation';
import { parseSubproductReturnTo } from '../../../../../src/navigation/routes';
import { EditSubproductScreen } from '../../../../../src/screens/inventory/InventoryScreens';

export default function EditSubproductRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const { returnTo: rawReturnTo, subproductId: rawSubproductId } = useLocalSearchParams<{
    returnTo?: string | string[];
    subproductId: string;
  }>();
  const returnTo = parseSubproductReturnTo(rawReturnTo);
  const { businessCenterName, isLoading, parentProduct, subproduct, subproductId } =
    useInventorySubproduct(rawSubproductId);
  const catalog = useProducts(organizationId, businessCenterId);
  const [businessCenters, setBusinessCenters] = useState<Array<{ id: string; name: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const parentProductId = parentProduct?.id ?? subproduct?.parentProductId ?? null;

  useEffect(() => {
    if (!organizationId) {
      setBusinessCenters([]);
      return;
    }

    listBusinessCenters(organizationId)
      .then(setBusinessCenters)
      .catch(() => {
        setBusinessCenters(
          businessCenterId && businessCenterName
            ? [{ id: businessCenterId, name: businessCenterName }]
            : [],
        );
      });
  }, [businessCenterId, businessCenterName, organizationId]);

  const categories = useMemo(
    () => collectCategoryOptions(catalog.products, subproduct?.category),
    [catalog.products, subproduct?.category],
  );

  const goBack = () => {
    if (!parentProductId) {
      router.back();
      return;
    }

    navigateSubproductReturn(router, { parentProductId, returnTo });
  };

  if (!subproductId || !businessCenterId || !organizationId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del subproducto"
          title="Editar subproducto"
        />
        <Text>Subproducto no encontrado.</Text>
      </ScreenContent>
    );
  }

  if (isLoading && !subproduct) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del subproducto"
          title="Editar subproducto"
        />
        <Text>Cargando subproducto...</Text>
      </ScreenContent>
    );
  }

  if (!subproduct || !parentProductId) {
    return (
      <ScreenContent>
        <InventoryScreenTitle
          onBack={goBack}
          subtitle="Actualiza la informacion del subproducto"
          title="Editar subproducto"
        />
        <Text>Subproducto no encontrado.</Text>
      </ScreenContent>
    );
  }

  return (
    <EditSubproductScreen
      businessCenterId={businessCenterId}
      businessCenterName={businessCenterName}
      businessCenters={
        businessCenters.length > 0
          ? businessCenters
          : [{ id: businessCenterId, name: businessCenterName ?? 'Sucursal principal' }]
      }
      categories={categories}
      isSaving={isSaving}
      onBack={goBack}
      onSave={async (values) => {
        setIsSaving(true);

        try {
          await updateProductDetails(
            businessCenterId,
            organizationId,
            subproduct.id,
            values,
            subproduct,
          );
          navigateSubproductReturn(router, {
            parentProductId,
            returnTo,
          });
        } catch (error) {
          Alert.alert(
            'No se pudo guardar',
            error instanceof Error ? error.message : 'Error desconocido',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      parentProduct={parentProduct}
      subproduct={subproduct}
    />
  );
}
