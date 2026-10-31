import { Alert } from 'react-native';

import { apiFetchAuthJson } from '../api/client';
import { getPreferredOrganizationId } from './activeOrganization';

const inflight = new Map<string, Promise<void>>();

export function challengeIdFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const challengeId = url.searchParams.get('c')?.trim() ?? '';
  if (!challengeId) return null;

  const path = url.pathname.replace(/\/$/, '');
  const httpsPair = url.hostname === 'web.nexolia.com.ar' && path === '/pair';
  const appPair =
    url.protocol === 'baas-owner:' &&
    (url.hostname === 'pair' || path === '/pair' || path === 'pair');

  return httpsPair || appPair ? challengeId : null;
}

export function approveBrowserSession(
  challengeId: string,
  organizationId?: string | null,
  organizationName?: string | null,
): Promise<void> {
  const existing = inflight.get(challengeId);
  if (existing) return existing;

  const task = (async () => {
    const preferred = organizationId || (await getPreferredOrganizationId());
    const body: { challengeId: string; organizationId?: string } = { challengeId };
    if (preferred) body.organizationId = preferred;
    await apiFetchAuthJson('/auth/browser-sessions/approve', {
      body: JSON.stringify(body),
      method: 'POST',
    });
    const business = organizationName?.trim();
    Alert.alert(
      'Listo',
      business
        ? `La computadora entra a ${business}.`
        : 'La computadora ya puede usar tu sesión.',
    );
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'No pudimos vincular esta computadora.';
    if (/ya fue usado/i.test(message)) {
      Alert.alert('Listo', 'La computadora ya puede usar tu sesión.');
      return;
    }
    inflight.delete(challengeId);
    Alert.alert('No se pudo vincular', message);
  });

  inflight.set(challengeId, task);
  return task;
}
