import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { useProfileChrome } from '../../src/context/ProfileChromeProvider';
import { routes } from '../../src/navigation/routes';
import { AccountScreen } from '../../src/screens/AccountScreen';

function formatTimezoneLabel(timezone: string | null | undefined): string {
  if (!timezone) {
    return 'Argentina / Cordoba';
  }

  return timezone.replace(/^America\//, '').replace(/_/g, ' ');
}

export default function AccountRoute(): ReactElement {
  const router = useRouter();
  const { dashboard, signOut } = useOwnerSessionContext();
  const profile = useProfileChrome();
  const isOwner = dashboard?.organization?.role === 'owner';

  return (
    <AccountScreen
      avatarUrl={profile.avatarUrl}
      businessName={dashboard?.organization?.name ?? null}
      fullName={profile.fullName}
      onOpenBusinessSettings={
        isOwner
          ? () => {
              router.push(routes.businessSettings);
            }
          : undefined
      }
      onOpenEditProfile={() => router.push(routes.editProfile)}
      onOpenPrivacyData={() => router.push(routes.privacyData)}
      onOpenStaffInvite={() => router.push(routes.staffInvite)}
      onOpenWhatsAppSetup={() => router.push(routes.whatsappConnect)}
      onSignOut={signOut}
      onUploadAvatar={profile.uploadAvatar}
      role={dashboard?.organization?.role ?? null}
      timezoneLabel={formatTimezoneLabel(dashboard?.organization?.timezone)}
      whatsappConnection={dashboard?.whatsappConnection ?? null}
    />
  );
}
