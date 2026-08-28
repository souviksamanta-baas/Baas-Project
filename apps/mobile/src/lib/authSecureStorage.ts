import * as SecureStore from 'expo-secure-store';

/**
 * Chunked SecureStore adapter for Supabase Auth sessions.
 * Avoids plain AsyncStorage for refresh/access tokens (Test Launch #9).
 * SecureStore has ~2KB value limits on some platforms, so large session JSON is chunked.
 */
const CHUNK_SIZE = 1800;
const memoryFallback = new Map<string, string>();

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  // Survives app kill / reboot once the device has been unlocked once.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function chunkCountKey(key: string): string {
  return `${key}__chunk_count`;
}

function chunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
    if (value != null) {
      memoryFallback.set(key, value);
    }
    return value ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
    // Verify the write so silent SecureStore failures do not leave us
    // with only an in-memory session that dies on process exit.
    const readBack = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
    if (readBack !== value) {
      console.warn('[authSecureStorage] SecureStore write verification failed for', key);
    }
  } catch (error) {
    console.warn('[authSecureStorage] SecureStore set failed; session may not survive restart', error);
  }
}

async function secureDelete(key: string): Promise<void> {
  memoryFallback.delete(key);
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  } catch {
    // Ignore native delete failures.
  }
}

async function clearChunks(key: string): Promise<void> {
  const countRaw = await secureGet(chunkCountKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  if (Number.isFinite(count) && count > 0) {
    for (let i = 0; i < count; i += 1) {
      await secureDelete(chunkKey(key, i));
    }
  }
  await secureDelete(chunkCountKey(key));
  await secureDelete(key);
}

export const authSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await secureGet(chunkCountKey(key));
    if (countRaw) {
      const count = Number.parseInt(countRaw, 10);
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await secureGet(chunkKey(key, i));
        if (part == null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    }

    return secureGet(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await secureSet(key, value);
      return;
    }

    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await secureSet(chunkCountKey(key), String(chunks));
    for (let i = 0; i < chunks; i += 1) {
      await secureSet(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
  },
};
