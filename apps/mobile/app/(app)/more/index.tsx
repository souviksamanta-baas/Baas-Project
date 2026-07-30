import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useProfileChrome } from '../../../src/context/ProfileChromeProvider';
import type { AccountMenuActionId, MoreMenuRowId } from '../../../src/lib/moreMenu';
import { whatsappConnectionLabel } from '../../../src/lib/whatsappPresentation';
import {
  productAddRoute,
  routes,
} from '../../../src/navigation/routes';
import { MoreScreen } from '../../../src/screens/MoreScreen';

function formatTimezoneLabel(timezone: string | null | undefined): string {
  if (!timezone) {
    return 'Argentina / Cordoba';
  }

  return timezone.replace(/^America\//, '').replace(/_/g, ' ');
}

export default function MoreRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, signOut } = useOwnerSessionContext();
  const profile = useProfileChrome();
  const isOwner = dashboard?.organization?.role === 'owner';
  const connection = dashboard?.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };
  const connectionCopy = whatsappConnectionLabel(connection);

  function openRow(rowId: MoreMenuRowId): void {
    switch (rowId) {
      case 'manage-stock':
        router.push(routes.inventoryManageStock);
        return;
      case 'add-product':
        router.push(productAddRoute('manage-stock'));
        return;
      case 'lots-movements':
        router.push(routes.inventoryLotsMovements);
        return;
      case 'notifications-tasks':
        router.push(routes.tasks);
        return;
      case 'billing':
        router.push(routes.billing);
        return;
      case 'account':
        router.push(routes.account);
        return;
      case 'integrations':
        router.push(routes.integrations);
        return;
      case 'suppliers':
        router.push(routes.suppliers);
        return;
      case 'help':
        router.push(routes.helpSupport);
        return;
      case 'privacy':
        router.push(routes.privacyData);
        return;
      case 'cash':
      default:
        return;
    }
  }

  function openAccountAction(actionId: AccountMenuActionId): void {
    switch (actionId) {
      case 'edit-profile':
        router.push(routes.editProfile);
        return;
      case 'staff-invite':
        router.push(routes.staffInvite);
        return;
      case 'business-settings':
        if (isOwner) {
          router.push(routes.businessSettings);
        }
        return;
      case 'whatsapp':
        router.push(routes.whatsappConnect);
        return;
      case 'sign-out':
        void signOut();
        return;
      default:
        return;
    }
  }

  return (
    <MoreScreen
      avatarUrl={profile.avatarUrl}
      businessName={dashboard?.organization?.name ?? null}
      canManageBusiness={isOwner}
      fullName={profile.fullName}
      onAccountAction={openAccountAction}
      onOpenRow={openRow}
      timezoneLabel={formatTimezoneLabel(dashboard?.organization?.timezone)}
      whatsappSubtitle={connectionCopy.subtitle}
      whatsappTitle={connectionCopy.title}
    />
  );
}
