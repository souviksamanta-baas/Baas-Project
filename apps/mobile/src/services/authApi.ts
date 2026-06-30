const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function requestWhatsAppOtp(phoneE164: string): Promise<void> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required for WhatsApp login.');
  }

  const response = await fetch(`${apiBaseUrl}/auth/otp/whatsapp/request`, {
    body: JSON.stringify({ phone: phoneE164 }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `No se pudo enviar el código por WhatsApp (HTTP ${response.status}).`);
  }
}

export async function verifyWhatsAppOtp(params: {
  otpCode: string;
  phoneE164: string;
}): Promise<string> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required for WhatsApp login.');
  }

  const response = await fetch(`${apiBaseUrl}/auth/otp/whatsapp/verify`, {
    body: JSON.stringify({
      code: params.otpCode.trim(),
      phone: params.phoneE164,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `No se pudo verificar el código (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as { tokenHash: string };

  if (!body.tokenHash) {
    throw new Error('La API no devolvió un token de sesión.');
  }

  return body.tokenHash;
}
