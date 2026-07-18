import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { useWhatsAppConnect } from '../../src/hooks/useWhatsAppConnect';
import { routes } from '../../src/navigation/routes';
import { WhatsAppConnectScreen } from '../../src/screens/WhatsAppConnectScreen';

export default function WhatsAppConnectRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const connect = useWhatsAppConnect({
    initialDisplayPhoneNumber: session.dashboard?.whatsappConnection.displayPhoneNumber,
    initialPhoneNumberId: session.dashboard?.whatsappConnection.phoneNumberId,
    onSuccess: async () => {
      await session.refreshDashboard();
      router.replace(routes.account);
    },
    organizationId: session.dashboard?.organization?.id ?? null,
  });

  const connection = session.dashboard?.whatsappConnection ?? {
    status: 'not_configured' as const,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedAt: null,
    lastStatusCheckAt: null,
    lastError: null,
  };

  return (
    <WhatsAppConnectScreen
      connection={connection}
      displayPhoneNumber={connect.displayPhoneNumber}
      errorMessage={connect.errorMessage}
      isSubmitting={connect.isSubmitting}
      onChangeDisplayPhoneNumber={connect.setDisplayPhoneNumber}
      onChangePhoneNumberId={connect.setPhoneNumberId}
      onChangeWabaId={connect.setWabaId}
      onBack={() => router.back()}
      onSubmit={connect.submit}
      phoneNumberId={connect.phoneNumberId}
      wabaId={connect.wabaId}
    />
  );
}
