/**
 * Web Crypto API Vault Security Module
 * Implements PBKDF2 (100,000 iterations, SHA-256) + AES-GCM (256-bit) authenticated encryption.
 * Zero plaintext secrets in storage.
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64 (12 bytes for AES-GCM)
  salt: string;       // Base64 (16 bytes for PBKDF2)
  version: number;
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  checksum: string;
  data: EncryptedPayload;
}

const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const SALT_LENGTH = 16; // 128-bit salt

// Utility: Uint8Array <-> Base64
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates cryptographically secure random bytes
 */
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a master password and salt using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Creates a verifier hash for checking master password validity without storing the password
 */
export async function createPasswordVerifier(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const hash = await window.crypto.subtle.digest('SHA-256', derivedBits);
  return uint8ArrayToBase64(new Uint8Array(hash));
}

/**
 * Encrypts a plaintext string using AES-GCM with a derived key or password
 */
export async function encryptText(
  plaintext: string,
  passwordOrKey: string | CryptoKey,
  existingSalt?: Uint8Array
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const encodedPlaintext = encoder.encode(plaintext);
  const iv = getRandomBytes(IV_LENGTH);

  let key: CryptoKey;
  let salt: Uint8Array;

  if (typeof passwordOrKey === 'string') {
    salt = existingSalt || getRandomBytes(SALT_LENGTH);
    key = await deriveKeyFromPassword(passwordOrKey, salt);
  } else {
    key = passwordOrKey;
    salt = existingSalt || new Uint8Array(0);
  }

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encodedPlaintext
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
    version: 1,
  };
}

/**
 * Decrypts an encrypted payload using AES-GCM
 */
export async function decryptText(
  payload: EncryptedPayload,
  passwordOrKey: string | CryptoKey
): Promise<string> {
  const iv = base64ToUint8Array(payload.iv);
  const ciphertext = base64ToUint8Array(payload.ciphertext);

  let key: CryptoKey;
  if (typeof passwordOrKey === 'string') {
    const salt = base64ToUint8Array(payload.salt);
    key = await deriveKeyFromPassword(passwordOrKey, salt);
  } else {
    key = passwordOrKey;
  }

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch {
    throw new Error('Decryption failed: Incorrect master password or corrupted payload.');
  }
}

/**
 * Computes a SHA-256 integrity checksum of a string
 */
export async function computeIntegrityChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(content));
  return uint8ArrayToBase64(new Uint8Array(digest));
}

/**
 * Generates an encrypted backup file package
 */
export async function createEncryptedBackup(
  jsonDataString: string,
  backupPassword: string
): Promise<BackupPayload> {
  const salt = getRandomBytes(SALT_LENGTH);
  const encrypted = await encryptText(jsonDataString, backupPassword, salt);
  const checksum = await computeIntegrityChecksum(encrypted.ciphertext + encrypted.iv);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    checksum,
    data: encrypted,
  };
}

/**
 * Verifies and restores an encrypted backup package
 */
export async function restoreEncryptedBackup(
  backup: BackupPayload,
  backupPassword: string
): Promise<string> {
  if (!backup || !backup.data || !backup.checksum) {
    throw new Error('Invalid backup structure.');
  }

  const calculatedChecksum = await computeIntegrityChecksum(
    backup.data.ciphertext + backup.data.iv
  );

  if (calculatedChecksum !== backup.checksum) {
    throw new Error('Backup integrity verification failed! The file may have been tampered with or corrupted.');
  }

  return decryptText(backup.data, backupPassword);
}
