import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { updateProductDetails } from '../../../../../src/api/inventory';
import { ScreenContent } from '../../../../../src/components/ui';
import { InventoryScreenTitle } from '../../../../../src/components/inventoryUi';
import { useOwnerSessionContext } from '../../../../../src/context/OwnerSessionProvider';
import { useBusinessCenters } from '../../../../../src/hooks/useBusinessCenters';
import { useInventorySubproduct } from '../../../../../src/hooks/useInventoryProduct';
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
  const {
    businessCenterName,
    isLoading,
    parentProduct,
    products,
    reloadProducts,
    subproduct,
    subproductId,
  } = useInventorySubproduct(rawSubproductId);
  const businessCenters = useBusinessCenters();
  const [isSaving, setIsSaving] = useState(false);
  const parentProductId = parentProduct?.id ?? subproduct?.parentProductId ?? null;

  const categories = useMemo(
    () => collectCategoryOptions(products, subproduct?.category),
    [products, subproduct?.category],
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
          await reloadProducts();
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
