import * as Contacts from 'expo-contacts';

import { normalizePhoneNumber } from './phone';

export interface DeviceContactOption {
  displayName: string;
  phoneE164: string | null;
  rawPhone: string;
}

export async function loadDeviceContacts(): Promise<DeviceContactOption[]> {
  const permission = await Contacts.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Necesitamos acceso a contactos para buscar un número.');
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    pageSize: 500,
    sort: Contacts.SortTypes.FirstName,
  });

  const options: DeviceContactOption[] = [];

  for (const contact of data) {
    const displayName = contact.name?.trim() || 'Sin nombre';
    const numbers = contact.phoneNumbers ?? [];

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
