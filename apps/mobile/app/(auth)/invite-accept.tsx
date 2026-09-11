import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { parseStaffInviteToken } from '../../src/lib/staffInviteToken';
import { routes } from '../../src/navigation/routes';
import { clearAuthEntryIntent } from '../../src/services/authIntent';
import { StaffInviteAcceptScreen } from '../../src/screens/StaffInviteAcceptScreen';

export default function InviteAcceptRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const params = useLocalSearchParams<{ token?: string }>();
  const inviteToken = parseStaffInviteToken(params.token ?? null);

  const refreshSession = useCallback(
    async (organizationId?: string) => {
      await session.refreshDashboard(organizationId);
    },
    [session.refreshDashboard],
  );

  const handleAccepted = useCallback(() => {
    clearAuthEntryIntent();
    router.replace(routes.appHome);
  }, [router]);

  if (!inviteToken) {
    return (
      <StaffInviteAcceptScreen
        inviteToken=""
        onAccepted={() => {
          clearAuthEntryIntent();
          router.replace(routes.authWelcome);
        }}
      />
    );
  }

  return (
    <StaffInviteAcceptScreen
      inviteToken={inviteToken}
      onRefreshSession={refreshSession}
      onAccepted={handleAccepted}
    />
  );
}
