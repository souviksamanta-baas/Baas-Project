import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export function getApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required.');
  }

  return apiBaseUrl;
}

export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Iniciá sesión para continuar.');
  }

  return session.access_token;
}

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

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`;
  const response = await apiFetch(url, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (HTTP ${response.status}).`);
  }

  return (await response.json()) as T;
}

export async function apiFetchAuthJson<T>(
  path: string,
  init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> },
): Promise<T> {
  const token = await getAccessToken();

  return apiFetchJson<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}
