import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { parseStaffInviteToken } from '../../src/lib/staffInviteToken';
import { routes } from '../../src/navigation/routes';
import { clearAuthEntryIntent } from '../../src/services/authIntent';
import { StaffInviteAcceptScreen } from '../../src/screens/StaffInviteAcceptScreen';

export default function InviteAcceptRoute(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const inviteToken = parseStaffInviteToken(params.token ?? null);

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
      onAccepted={() => {
        clearAuthEntryIntent();
        router.replace(routes.appHome);
      }}
    />
  );
}
