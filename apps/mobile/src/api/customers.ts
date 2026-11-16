import {
  Contact,
  ContactField,
  ContactsSortOrder,
  requestPermissionsAsync,
} from 'expo-contacts';

import { showPermissionDeniedAlert } from '../lib/androidPermissions';
import { normalizePhoneNumber } from '../services/phone';

export interface DeviceContactOption {
  displayName: string;
  phoneE164: string | null;
  rawPhone: string;
}

const CONTACT_PAGE_SIZE = 200;
const CONTACT_PAGE_CAP = 5000;

let cachedDeviceContacts: DeviceContactOption[] | null = null;
let deviceContactsInflight: Promise<DeviceContactOption[]> | null = null;

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function contactPageKey(contact: {
  fullName?: string | null;
  phones?: Array<{ number?: string | null }> | null;
}): string {
  const phones = (contact.phones ?? []).map((phone) => phone.number ?? '').join(',');
  return `${contact.fullName ?? ''}|${phones}`;
}

function compareDisplayName(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

async function readDeviceContacts(): Promise<DeviceContactOption[]> {
  const optionsList: DeviceContactOption[] = [];
  const seenPageKeys = new Set<string>();
  let offset = 0;

  while (optionsList.length < CONTACT_PAGE_CAP) {
    const page = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES], {
      limit: CONTACT_PAGE_SIZE,
      offset,
      sortOrder: ContactsSortOrder.GivenName,
    });

    if (page.length === 0) {
      break;
    }

    let freshOnPage = 0;
    for (const contact of page) {
      const key = contactPageKey(contact);
      if (seenPageKeys.has(key)) {
        continue;
      }
      seenPageKeys.add(key);
      freshOnPage += 1;

      const displayName = contact.fullName?.trim() || 'Sin nombre';
      for (const phone of contact.phones ?? []) {
        const rawPhone = phone.number?.trim();
        if (!rawPhone) {
          continue;
        }

        optionsList.push({
          displayName,
          phoneE164: normalizePhoneNumber(rawPhone),
          rawPhone,
        });
      }
    }

    if (freshOnPage === 0 || page.length < CONTACT_PAGE_SIZE) {
      break;
    }

    offset += page.length;
    await yieldToUi();
  }

  optionsList.sort((left, right) => compareDisplayName(left.displayName, right.displayName));
  return optionsList;
}

export async function loadDeviceContacts(options?: {
  silentPermissionDenied?: boolean;
}): Promise<DeviceContactOption[]> {
  if (cachedDeviceContacts) {
    return cachedDeviceContacts;
  }
  if (deviceContactsInflight) {
    return deviceContactsInflight;
  }

  deviceContactsInflight = (async () => {
    const permission = await requestPermissionsAsync();

    if (permission.status !== 'granted') {
      if (!options?.silentPermissionDenied) {
        showPermissionDeniedAlert('contacts', { canAskAgain: permission.canAskAgain !== false });
      }
      throw new Error('Necesitamos acceso a contactos para buscar un número.');
    }

    const contacts = await readDeviceContacts();
    cachedDeviceContacts = contacts;
    return contacts;
  })().finally(() => {
    deviceContactsInflight = null;
  });

  return deviceContactsInflight;
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
