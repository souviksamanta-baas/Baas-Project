import { Platform } from 'react-native';

export function formatApiFetchError(error: unknown): Error {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
    const hint = origin
      ? ` En Chrome, agregá ${origin} a BAAS_CORS_ALLOWED_ORIGINS en Railway y reiniciá la API.`
      : ' Verificá que EXPO_PUBLIC_API_BASE_URL apunte a una API accesible desde este dispositivo.';

    return new Error(`No pudimos contactar la API.${hint}`);
  }

  return error instanceof Error ? error : new Error('Error de red desconocido.');
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw formatApiFetchError(error);
  }
}
