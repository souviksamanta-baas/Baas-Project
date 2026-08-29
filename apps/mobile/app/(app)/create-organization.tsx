import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { createOrganizationWithOwner } from '../../src/api/dashboard';
import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { setPreferredOrganizationId } from '../../src/lib/activeOrganization';
import { normalizeNavShortcutId, type NavShortcutId } from '../../src/lib/navShortcut';
import { routes } from '../../src/navigation/routes';
import { OnboardingScreen } from '../../src/screens/OnboardingScreen';
import {
  DEFAULT_ORGANIZATION_FEATURE_FLAGS,
  resolveOrganizationFeatureFlags,
  type OrganizationFeatureFlags,
} from '../../src/types/features';

export default function CreateOrganizationRoute(): ReactElement {
  const router = useRouter();
  const { refreshDashboard } = useOwnerSessionContext();
  const [businessName, setBusinessName] = useState('');
  const [navShortcut, setNavShortcut] = useState<NavShortcutId>('ventas');
  const [verticalId, setVerticalId] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<OrganizationFeatureFlags>({
    ...DEFAULT_ORGANIZATION_FEATURE_FLAGS,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(async (): Promise<void> => {
    if (!businessName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresá el nombre de tu negocio para continuar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const organizationId = await createOrganizationWithOwner(businessName.trim(), {
        featureFlags: resolveOrganizationFeatureFlags(featureFlags),
        navShortcut,
        verticalId,
      });
      await setPreferredOrganizationId(organizationId);
      await refreshDashboard();
      router.replace(routes.appHome);
    } catch (error) {
      Alert.alert(
        'No se pudo crear el negocio',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [businessName, featureFlags, navShortcut, refreshDashboard, router, verticalId]);

  return (
    <OnboardingScreen
      businessName={businessName}
      featureFlags={featureFlags}
      initialStep="create"
      isSubmitting={isSubmitting}
      navShortcut={navShortcut}
      onBack={() => router.back()}
      onChangeBusinessName={setBusinessName}
      onChangeFeatureFlags={(next) => setFeatureFlags(resolveOrganizationFeatureFlags(next))}
      onChangeNavShortcut={(value) => setNavShortcut(normalizeNavShortcutId(value))}
      onChangeVerticalId={setVerticalId}
      onCreateOrganization={() => {
        void handleCreate();
      }}
      onJoinWithInviteToken={() => undefined}
      onSignOut={() => router.back()}
      submitLabel="Crear y cambiar a este negocio"
      verticalId={verticalId}
    />
  );
}
