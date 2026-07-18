import {
  Contact,
  ContactField,
  ContactsSortOrder,
  requestPermissionsAsync,
} from 'expo-contacts';

import { normalizePhoneNumber } from '../services/phone';

export interface DeviceContactOption {
  displayName: string;
  phoneE164: string | null;
  rawPhone: string;
}

export async function loadDeviceContacts(): Promise<DeviceContactOption[]> {
  const permission = await requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Necesitamos acceso a contactos para buscar un número.');
  }

  const contacts = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES], {
    limit: 500,
    sortOrder: ContactsSortOrder.GivenName,
  });

  const options: DeviceContactOption[] = [];

  for (const contact of contacts) {
    const displayName = contact.fullName?.trim() || 'Sin nombre';
    const numbers = contact.phones ?? [];

    for (const phone of numbers) {
      const rawPhone = phone.number?.trim();

      if (!rawPhone) {
        continue;
      }

      options.push({
        displayName,
        phoneE164: normalizePhoneNumber(rawPhone),
        rawPhone,
      });
    }
  }

  return options.sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'));
}

export function filterContactOptions(
  options: DeviceContactOption[],
  query: string,
): DeviceContactOption[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => {
    return (
      option.displayName.toLowerCase().includes(normalizedQuery) ||
      option.rawPhone.includes(normalizedQuery) ||
      (option.phoneE164?.includes(normalizedQuery) ?? false)
    );
  });
}
