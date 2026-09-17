import { useEffect, useMemo, useState } from 'react';

import { loadDeviceContacts } from '../api/customers';
import { normalizePhoneNumber } from '../services/phone';

function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function phoneLookupKeys(value: string | null | undefined): string[] {
  const keys = new Set<string>();
  const raw = phoneDigits(value);
  const e164 = normalizePhoneNumber(value ?? '');
  const e164Digits = phoneDigits(e164);

  for (const candidate of [raw, e164Digits]) {
    if (!candidate) {
      continue;
    }
    keys.add(candidate);
    if (candidate.length >= 10) {
      keys.add(candidate.slice(-10));
    }
    if (candidate.length >= 8) {
      keys.add(candidate.slice(-8));
    }
  }

  return [...keys];
}

export function buildDeviceContactNameMap(
  contacts: Array<{ displayName: string; phoneE164: string | null; rawPhone: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const contact of contacts) {
    const name = contact.displayName.trim();
    if (!name || name === 'Sin nombre') {
      continue;
    }
    for (const key of [
      ...phoneLookupKeys(contact.phoneE164),
      ...phoneLookupKeys(contact.rawPhone),
    ]) {
      if (!map.has(key)) {
        map.set(key, name);
      }
    }
  }
  return map;
}

export function resolveDeviceContactName(
  map: Map<string, string>,
  phone: string | null | undefined,
): string | null {
  for (const key of phoneLookupKeys(phone)) {
    const name = map.get(key);
    if (name) {
      return name;
    }
  }
  return null;
}

export function useDeviceContactNames(): {
  isLoading: boolean;
  resolveName: (phone: string | null | undefined) => string | null;
} {
  const [nameByPhone, setNameByPhone] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void loadDeviceContacts({ silentPermissionDenied: true })
      .then((contacts) => {
        if (!mounted) {
          return;
        }
        setNameByPhone(buildDeviceContactNameMap(contacts));
      })
      .catch(() => {
        if (mounted) {
          setNameByPhone(new Map());
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(
    () => ({
      isLoading,
      resolveName: (phone: string | null | undefined) =>
        resolveDeviceContactName(nameByPhone, phone),
    }),
    [isLoading, nameByPhone],
  );
}
