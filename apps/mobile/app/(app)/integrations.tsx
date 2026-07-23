import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { IntegrationsScreen } from '../../src/screens/IntegrationsScreen';

export default function IntegrationsRoute(): ReactElement {
  const router = useRouter();
  const { dashboard } = useOwnerSessionContext();

  return (
    <IntegrationsScreen
      onBack={() => router.back()}
      onOpenInstagram={() => router.push(routes.instagramConnect)}
      onOpenWhatsApp={() => router.push(routes.whatsappConnect)}
      instagramConnection={dashboard?.instagramConnection ?? null}
      whatsappConnection={dashboard?.whatsappConnection ?? null}
    />
  );
}
