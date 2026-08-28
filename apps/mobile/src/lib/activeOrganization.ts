import { getAppStorageItem, removeAppStorageItem, setAppStorageItem } from './appStorage';

const ACTIVE_ORG_KEY = 'baas.activeOrganizationId';

export async function getPreferredOrganizationId(): Promise<string | null> {
  return getAppStorageItem(ACTIVE_ORG_KEY);
}

export async function setPreferredOrganizationId(organizationId: string): Promise<void> {
  await setAppStorageItem(ACTIVE_ORG_KEY, organizationId);
}

export async function clearPreferredOrganizationId(): Promise<void> {
  await removeAppStorageItem(ACTIVE_ORG_KEY);
}
