import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'v1:';

function resolveKey(rawKey: string | undefined): Buffer {
  if (!rawKey?.trim()) {
    throw new Error('BAAS_TOKEN_ENCRYPTION_KEY is required to encrypt/decrypt secrets');
  }

  const trimmed = rawKey.trim();
  try {
    const fromB64 = Buffer.from(trimmed, 'base64');
    if (fromB64.length === 32) {
      return fromB64;
    }
  } catch {
    // fall through
  }

  // Derive a stable 32-byte key from arbitrary secrets (dev convenience).
  return createHash('sha256').update(trimmed).digest();
}

/** AES-256-GCM. Output format: v1:<iv_b64>:<tag_b64>:<cipher_b64> */
export function encryptSecret(plaintext: string, encryptionKey: string | undefined): string {
  const key = resolveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string, encryptionKey: string | undefined): string {
  if (!payload.startsWith(PREFIX)) {
    // Legacy plaintext rows from early Instagram spike.
    return payload;
  }

  const key = resolveKey(encryptionKey);
  const [, ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
