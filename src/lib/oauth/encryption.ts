// AES-256-GCM encryption for OAuth tokens (Edge-safe, Web Crypto only)
// Key source: process.env.OAUTH_TOKEN_ENCRYPTION_KEY (base64 or passphrase)
// Stored format: "iv_base64:tag_base64:ciphertext_base64"

const OAUTH_TOKEN_ENCRYPTION_KEY = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined') {
    return crypto as Crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Node.js / SSR fallback (Buffer is available on Node, not on Edge)
  // eslint-disable-next-line no-undef
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Node.js / SSR fallback
  // eslint-disable-next-line no-undef
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function deriveKeyFromPassphrase(secret: string): Promise<CryptoKey> {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const salt = encoder.encode('cliprace-oauth-token-salt-v1');

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (!OAUTH_TOKEN_ENCRYPTION_KEY) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is not set');
  }

  const cryptoObj = getCrypto();

  // Try to interpret as base64-encoded 32-byte key first
  try {
    const keyBytes = base64ToBytes(OAUTH_TOKEN_ENCRYPTION_KEY);
    if (keyBytes.byteLength === 32) {
      const keyBuffer = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer;
      return cryptoObj.subtle.importKey(
        'raw',
        keyBuffer,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt', 'decrypt'],
      );
    }
  } catch {
    // Fallback to PBKDF2 below
  }

  // Otherwise, treat as passphrase and derive a key with PBKDF2
  return deriveKeyFromPassphrase(OAUTH_TOKEN_ENCRYPTION_KEY);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const cryptoObj = getCrypto();
  const key = await getEncryptionKey();

  const iv = cryptoObj.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  if (encryptedBytes.byteLength < 16) {
    throw new Error('Encryption failed: ciphertext too short');
  }

  // Web Crypto AES-GCM returns ciphertext || tag (tag = 16 bytes by default)
  const tagLength = 16;
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
  const tag = encryptedBytes.slice(encryptedBytes.length - tagLength);

  const ivB64 = bytesToBase64(iv);
  const tagB64 = bytesToBase64(tag);
  const ciphertextB64 = bytesToBase64(ciphertext);

  return `${ivB64}:${tagB64}:${ciphertextB64}`;
}

export async function decryptToken(encrypted: string): Promise<string> {
  const cryptoObj = getCrypto();
  const key = await getEncryptionKey();

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = base64ToBytes(ivB64);
  const tag = base64ToBytes(tagB64);
  const ciphertext = base64ToBytes(ciphertextB64);

  const combinedBuffer = new ArrayBuffer(ciphertext.byteLength + tag.byteLength);
  const combinedView = new Uint8Array(combinedBuffer);
  combinedView.set(ciphertext, 0);
  combinedView.set(tag, ciphertext.byteLength);

  // TypeScript's BufferSource definition is stricter than the runtime accepts here,
  // so we cast the Web Crypto call to any to avoid a false-positive type error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decrypted = await (cryptoObj.subtle.decrypt as any)(
    { name: 'AES-GCM', iv },
    key,
    combinedBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

