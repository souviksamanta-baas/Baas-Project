import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { parseStaffInviteToken } from '../../src/lib/staffInviteToken';
import { routes } from '../../src/navigation/routes';
import { StaffInviteAcceptScreen } from '../../src/screens/StaffInviteAcceptScreen';

export default function InviteAcceptRoute(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const inviteToken = parseStaffInviteToken(params.token ?? null);

  if (!inviteToken) {
    return (
      <StaffInviteAcceptScreen
        inviteToken=""
        onAccepted={() => router.replace(routes.appHome)}
      />
    );
  }

  return (
    <StaffInviteAcceptScreen
      inviteToken={inviteToken}
      onAccepted={() => router.replace(routes.appHome)}
    />
  );
}
