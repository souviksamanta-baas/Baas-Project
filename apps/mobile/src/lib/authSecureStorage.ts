import * as SecureStore from 'expo-secure-store';

/**
 * Chunked SecureStore adapter for Supabase Auth sessions.
 * Avoids plain AsyncStorage for refresh/access tokens (Test Launch #9).
 * SecureStore has ~2KB value limits on some platforms, so large session JSON is chunked.
 */
const CHUNK_SIZE = 1800;
const memoryFallback = new Map<string, string>();

function chunkCountKey(key: string): string {
  return `${key}__chunk_count`;
}

function chunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Keep memory fallback for the current session.
  }
}

async function secureDelete(key: string): Promise<void> {
  memoryFallback.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
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
