import { getAppStorageItem, removeAppStorageItem, setAppStorageItem } from './appStorage';

function storageKey(organizationId: string): string {
  return `baas.activeBusinessCenterId.${organizationId}`;
}

export async function getPreferredBusinessCenterId(
  organizationId: string,
): Promise<string | null> {
  return getAppStorageItem(storageKey(organizationId));
}

export async function setPreferredBusinessCenterId(
  organizationId: string,
  businessCenterId: string,
): Promise<void> {
  await setAppStorageItem(storageKey(organizationId), businessCenterId);
}

export async function clearPreferredBusinessCenterId(organizationId: string): Promise<void> {
  await removeAppStorageItem(storageKey(organizationId));
}
