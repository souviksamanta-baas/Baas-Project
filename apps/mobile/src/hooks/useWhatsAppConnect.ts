import { useCallback, useState } from 'react';

import { registerWhatsAppConnection } from '../api/whatsapp';

export function useWhatsAppConnect(params: {
  initialDisplayPhoneNumber?: string | null;
  initialPhoneNumberId?: string | null;
  onSuccess: () => Promise<void>;
  organizationId: string | null;
}): {
  displayPhoneNumber: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  phoneNumberId: string;
  setDisplayPhoneNumber: (value: string) => void;
  setPhoneNumberId: (value: string) => void;
  setWabaId: (value: string) => void;
  submit: () => Promise<void>;
  wabaId: string;
} {
  const [phoneNumberId, setPhoneNumberId] = useState(params.initialPhoneNumberId ?? '');
  const [wabaId, setWabaId] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(params.initialDisplayPhoneNumber ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (): Promise<void> => {
    if (!params.organizationId) {
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
        organizationId: params.organizationId,
        phoneNumberId,
        wabaId: wabaId.trim() || undefined,
      });
      await params.onSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo conectar WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  }, [displayPhoneNumber, params, phoneNumberId, wabaId]);

  return {
    displayPhoneNumber,
    errorMessage,
    isSubmitting,
    phoneNumberId,
    setDisplayPhoneNumber: (value) => {
      setErrorMessage(null);
      setDisplayPhoneNumber(value);
    },
    setPhoneNumberId: (value) => {
      setErrorMessage(null);
      setPhoneNumberId(value);
    },
    setWabaId,
    submit,
    wabaId,
  };
}
