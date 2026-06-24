import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';

import { useOwnerSessionContext } from '../../src/context/OwnerSessionProvider';
import { routes } from '../../src/navigation/routes';
import { registerWhatsAppConnection } from '../../src/services/whatsapp';
import { WhatsAppConnectScreen } from '../../src/screens/WhatsAppConnectScreen';

export default function WhatsAppConnectRoute(): ReactElement {
  const router = useRouter();
  const session = useOwnerSessionContext();
  const [phoneNumberId, setPhoneNumberId] = useState(session.dashboard?.whatsappConnection.phoneNumberId ?? '');
  const [wabaId, setWabaId] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(
    session.dashboard?.whatsappConnection.displayPhoneNumber ?? '',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizationId = session.dashboard?.organization?.id ?? null;
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
      displayPhoneNumber={displayPhoneNumber}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onChangeDisplayPhoneNumber={(value) => {
        setErrorMessage(null);
        setDisplayPhoneNumber(value);
      }}
      onChangePhoneNumberId={(value) => {
        setErrorMessage(null);
        setPhoneNumberId(value);
      }}
      onChangeWabaId={setWabaId}
      onSubmit={async () => {
        if (!organizationId) {
          setErrorMessage('No encontramos tu organización.');
          return;
        }

        if (!phoneNumberId.trim() || !displayPhoneNumber.trim()) {
          setErrorMessage('Completá el Phone Number ID y el número visible.');
          return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
          await registerWhatsAppConnection({
            displayPhoneNumber,
            organizationId,
            phoneNumberId,
            wabaId: wabaId.trim() || undefined,
          });
          await session.refreshDashboard();
          router.replace(routes.account);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo conectar WhatsApp.');
        } finally {
          setIsSubmitting(false);
        }
      }}
      phoneNumberId={phoneNumberId}
      wabaId={wabaId}
    />
  );
}
