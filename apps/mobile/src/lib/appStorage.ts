import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny key-value storage for non-secret app cache (presupuestos, proveedores, etc.).
 * Supabase Auth sessions use authSecureStorage (SecureStore), not this module.
 * Prefers AsyncStorage (Expo Go–compatible v2). Falls back to memory if the
 * native module is unavailable so the UI never surfaces a hard crash.
 */
const memoryFallback = new Map<string, string>();

export async function getAppStorageItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export async function setAppStorageItem(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);

  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Keep the in-memory write so the current session still works.
  }
}

export async function removeAppStorageItem(key: string): Promise<void> {
  memoryFallback.delete(key);

  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // See setAppStorageItem.
  }
}

export const appStorage = {
  getItem: getAppStorageItem,
  removeItem: removeAppStorageItem,
  setItem: setAppStorageItem,
};
