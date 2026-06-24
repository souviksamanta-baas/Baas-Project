import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../../src/context/OwnerSessionProvider';
import { useInbox } from '../../../src/hooks/useInbox';
import { conversationRoute, routes } from '../../../src/navigation/routes';
import { InboxScreen } from '../../../src/screens/InboxScreen';

export default function InboxRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const inbox = useInbox(organizationId, businessCenterId);

  return (
    <InboxScreen
      conversations={inbox.conversations}
      errorMessage={inbox.errorMessage}
      isLoading={inbox.isLoading}
      onOpenConversation={(conversationId) => router.push(conversationRoute(conversationId))}
      onOpenWhatsAppSetup={() => router.push(routes.whatsappConnect)}
      whatsappConnection={dashboard?.whatsappConnection ?? null}
    />
  );
}
