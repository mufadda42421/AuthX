/**
 * AuthenticatorX IndexedDB & Chrome Storage Vault
 * Manages encrypted account records, master password initialization,
 * auto-lock intervals, and secure in-memory key lifecycle.
 */

import {
  EncryptedPayload,
  deriveKeyFromPassword,
  createPasswordVerifier,
  encryptText,
  decryptText,
  getRandomBytes,
  uint8ArrayToBase64,
  base64ToUint8Array,
  createEncryptedBackup,
  restoreEncryptedBackup,
} from './crypto';
import { HashAlgorithm } from './totp';

export interface StoredAccountRecord {
  id: string;
  issuer: string;
  accountName: string;
  digits: number;
  period: number;
  algorithm: HashAlgorithm;
  createdAt: number;
  updatedAt: number;
  encryptedSecret: EncryptedPayload;
}

export interface DecryptedAccount {
  id: string;
  issuer: string;
  accountName: string;
  secret: string; // Plaintext Base32 secret kept ONLY in ephemeral unlocked memory
  digits: number;
  period: number;
  algorithm: HashAlgorithm;
  createdAt: number;
  updatedAt: number;
}

export type ThemeType = 'dark-navy' | 'cyber-midnight' | 'deep-slate' | 'oled-black';

export interface VaultSettings {
  autoLockMinutes: number; // 1, 5, 15, 30, 0 (never)
  theme: ThemeType;
  showNextCode: boolean;
  compactView: boolean;
}

export interface VaultMetadata {
  isInitialized: boolean;
  salt: string; // Base64
  verifierHash: string;
  settings: VaultSettings;
  accountCount?: number;
}

const DB_NAME = 'AuthenticatorX_Vault';
const DB_VERSION = 1;
const STORE_META = 'metadata';
const STORE_ACCOUNTS = 'accounts';

const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  theme: 'dark-navy',
  showNextCode: false,
  compactView: false,
};

class VaultStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeCryptoKey: CryptoKey | null = null;
  private activeMasterSalt: Uint8Array | null = null;
  private lastActivityTimestamp: number = Date.now();
  private lockListeners: Array<() => void> = [];

  constructor() {
    this.initActivityTracking();
  }

  private initActivityTracking() {
    if (typeof window === 'undefined') return;
    const updateActivity = () => {
      this.lastActivityTimestamp = Date.now();
    };
    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          const accStore = db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
          accStore.createIndex('issuer', 'issuer', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Retrieves vault initialization metadata
   */
  async getMetadata(): Promise<VaultMetadata> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get('vault_config');

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result.data);
        } else {
          resolve({
            isInitialized: false,
            salt: '',
            verifierHash: '',
            settings: DEFAULT_SETTINGS,
          });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Sets up master password for the first time
   */
  async initializeVault(masterPassword: string): Promise<void> {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters long.');
    }

    const salt = getRandomBytes(16);
    const verifierHash = await createPasswordVerifier(masterPassword, salt);

    const meta: VaultMetadata = {
      isInitialized: true,
      salt: uint8ArrayToBase64(salt),
      verifierHash,
      settings: DEFAULT_SETTINGS,
    };

    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      const req = store.put({ key: 'vault_config', data: meta });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Derive active key in memory
    this.activeMasterSalt = salt;
    this.activeCryptoKey = await deriveKeyFromPassword(masterPassword, salt);
    this.lastActivityTimestamp = Date.now();
  }

  /**
   * Unlocks the vault with master password
   */
  async unlock(password: string): Promise<boolean> {
    const meta = await this.getMetadata();
    if (!meta.isInitialized) {
      throw new Error('Vault is not yet initialized.');
    }

    const salt = base64ToUint8Array(meta.salt);
    const calculatedHash = await createPasswordVerifier(password, salt);

    if (calculatedHash !== meta.verifierHash) {
      return false; // Wrong password
    }

    this.activeMasterSalt = salt;
    this.activeCryptoKey = await deriveKeyFromPassword(password, salt);
    this.lastActivityTimestamp = Date.now();
    return true;
  }

  /**
   * Checks if vault is locked
   */
  isLocked(): boolean {
    return this.activeCryptoKey === null;
  }

  /**
   * Locks the vault immediately, wiping all ephemeral keys from memory
   */
  lock(): void {
    this.activeCryptoKey = null;
    this.activeMasterSalt = null;
    this.lockListeners.forEach((fn) => fn());
  }

  onLock(listener: () => void): () => void {
    this.lockListeners.push(listener);
    return () => {
      this.lockListeners = this.lockListeners.filter((fn) => fn !== listener);
    };
  }

  /**
   * Checks auto-lock based on elapsed inactivity
   */
  checkAutoLock(autoLockMinutes: number): boolean {
    if (this.isLocked() || autoLockMinutes <= 0) return false;
    const elapsedMinutes = (Date.now() - this.lastActivityTimestamp) / (1000 * 60);
    if (elapsedMinutes >= autoLockMinutes) {
      this.lock();
      return true;
    }
    return false;
  }

  /**
   * Updates vault settings
   */
  async updateSettings(newSettings: Partial<VaultSettings>): Promise<VaultSettings> {
    const meta = await this.getMetadata();
    const updated: VaultSettings = {
      ...meta.settings,
      ...newSettings,
    };
    meta.settings = updated;

    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      const req = store.put({ key: 'vault_config', data: meta });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return updated;
  }

  /**
   * Retrieves and decrypts all account records
   */
  async getAccounts(): Promise<DecryptedAccount[]> {
    if (this.isLocked() || !this.activeCryptoKey) {
      throw new Error('Vault is locked. Unlock with master password to view accounts.');
    }

    const db = await this.openDB();
    const records = await new Promise<StoredAccountRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readonly');
      const store = tx.objectStore(STORE_ACCOUNTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const decryptedList: DecryptedAccount[] = [];

    for (const rec of records) {
      try {
        const decryptedSecret = await decryptText(rec.encryptedSecret, this.activeCryptoKey);
        decryptedList.push({
          id: rec.id,
          issuer: rec.issuer,
          accountName: rec.accountName,
          secret: decryptedSecret,
          digits: rec.digits,
          period: rec.period,
          algorithm: rec.algorithm,
          createdAt: rec.createdAt,
          updatedAt: rec.updatedAt,
        });
      } catch (err) {
        console.error(`Failed to decrypt account ${rec.id}:`, err);
      }
    }

    return decryptedList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * Adds an account, encrypting the secret with AES-GCM before storage
   */
  async addAccount(accountData: {
    issuer: string;
    accountName: string;
    secret: string;
    digits?: number;
    period?: number;
    algorithm?: HashAlgorithm;
  }): Promise<DecryptedAccount> {
    if (this.isLocked() || !this.activeCryptoKey) {
      throw new Error('Vault is locked.');
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const cleanSecret = accountData.secret.toUpperCase().replace(/[\s\-=]/g, '');

    const encryptedSecret = await encryptText(
      cleanSecret,
      this.activeCryptoKey,
      this.activeMasterSalt || undefined
    );

    const record: StoredAccountRecord = {
      id,
      issuer: accountData.issuer.trim() || 'Service',
      accountName: accountData.accountName.trim() || 'Account',
      digits: accountData.digits || 6,
      period: accountData.period || 30,
      algorithm: accountData.algorithm || 'SHA-1',
      createdAt: now,
      updatedAt: now,
      encryptedSecret,
    };

    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
      const store = tx.objectStore(STORE_ACCOUNTS);
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return {
      id: record.id,
      issuer: record.issuer,
      accountName: record.accountName,
      secret: cleanSecret,
      digits: record.digits,
      period: record.period,
      algorithm: record.algorithm,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Updates an existing account
   */
  async updateAccount(
    id: string,
    updates: Partial<{
      issuer: string;
      accountName: string;
      secret: string;
      digits: number;
      period: number;
      algorithm: HashAlgorithm;
    }>
  ): Promise<void> {
    if (this.isLocked() || !this.activeCryptoKey) {
      throw new Error('Vault is locked.');
    }

    const db = await this.openDB();
    const existing = await new Promise<StoredAccountRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readonly');
      const req = tx.objectStore(STORE_ACCOUNTS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!existing) {
      throw new Error('Account not found.');
    }

    let encryptedSecret = existing.encryptedSecret;
    if (updates.secret) {
      const cleanSecret = updates.secret.toUpperCase().replace(/[\s\-=]/g, '');
      encryptedSecret = await encryptText(
        cleanSecret,
        this.activeCryptoKey,
        this.activeMasterSalt || undefined
      );
    }

    const updatedRecord: StoredAccountRecord = {
      ...existing,
      issuer: updates.issuer !== undefined ? updates.issuer.trim() : existing.issuer,
      accountName: updates.accountName !== undefined ? updates.accountName.trim() : existing.accountName,
      digits: updates.digits !== undefined ? updates.digits : existing.digits,
      period: updates.period !== undefined ? updates.period : existing.period,
      algorithm: updates.algorithm !== undefined ? updates.algorithm : existing.algorithm,
      updatedAt: Date.now(),
      encryptedSecret,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
      const req = tx.objectStore(STORE_ACCOUNTS).put(updatedRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Deletes an account
   */
  async deleteAccount(id: string): Promise<void> {
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
      const req = tx.objectStore(STORE_ACCOUNTS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Changes master password and re-encrypts all accounts
   */
  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New master password must be at least 8 characters.');
    }

    const unlocked = await this.unlock(currentPassword);
    if (!unlocked) {
      throw new Error('Current master password is incorrect.');
    }

    // Decrypt all existing accounts with current key
    const currentAccounts = await this.getAccounts();

    // Generate new salt and new verifier
    const newSalt = getRandomBytes(16);
    const newVerifierHash = await createPasswordVerifier(newPassword, newSalt);
    const newKey = await deriveKeyFromPassword(newPassword, newSalt);

    const meta = await this.getMetadata();
    meta.salt = uint8ArrayToBase64(newSalt);
    meta.verifierHash = newVerifierHash;

    const db = await this.openDB();
    const tx = db.transaction([STORE_META, STORE_ACCOUNTS], 'readwrite');

    // Update meta
    tx.objectStore(STORE_META).put({ key: 'vault_config', data: meta });

    // Clear and re-encrypt all accounts with new key
    const accStore = tx.objectStore(STORE_ACCOUNTS);
    accStore.clear();

    for (const acc of currentAccounts) {
      const encryptedSecret = await encryptText(acc.secret, newKey, newSalt);
      const record: StoredAccountRecord = {
        id: acc.id,
        issuer: acc.issuer,
        accountName: acc.accountName,
        digits: acc.digits,
        period: acc.period,
        algorithm: acc.algorithm,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
        encryptedSecret,
      };
      accStore.put(record);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.activeCryptoKey = newKey;
    this.activeMasterSalt = newSalt;
  }

  /**
   * Exports an encrypted backup file package
   */
  async exportBackup(backupPassword: string): Promise<string> {
    if (this.isLocked()) {
      throw new Error('Unlock vault before exporting backup.');
    }
    const accounts = await this.getAccounts();
    const exportData = {
      exportedAt: new Date().toISOString(),
      app: 'AuthenticatorX',
      accounts: accounts.map((a) => ({
        issuer: a.issuer,
        accountName: a.accountName,
        secret: a.secret,
        digits: a.digits,
        period: a.period,
        algorithm: a.algorithm,
      })),
    };

    const backupPayload = await createEncryptedBackup(
      JSON.stringify(exportData, null, 2),
      backupPassword
    );

    return JSON.stringify(backupPayload, null, 2);
  }

  /**
   * Restores an encrypted backup file package
   */
  async importBackup(
    backupFileContent: string,
    backupPassword: string
  ): Promise<{ importedCount: number }> {
    if (this.isLocked()) {
      throw new Error('Unlock vault before importing backup.');
    }

    let parsedBackup;
    try {
      parsedBackup = JSON.parse(backupFileContent);
    } catch {
      throw new Error('Invalid backup file. Not valid JSON.');
    }

    const decryptedJson = await restoreEncryptedBackup(parsedBackup, backupPassword);
    const data = JSON.parse(decryptedJson);

    if (!data.accounts || !Array.isArray(data.accounts)) {
      throw new Error('Decrypted backup does not contain valid accounts array.');
    }

    let count = 0;
    for (const acc of data.accounts) {
      if (acc.secret && acc.issuer) {
        await this.addAccount({
          issuer: acc.issuer,
          accountName: acc.accountName || 'Imported Account',
          secret: acc.secret,
          digits: acc.digits || 6,
          period: acc.period || 30,
          algorithm: acc.algorithm || 'SHA-1',
        });
        count++;
      }
    }

    return { importedCount: count };
  }

  /**
   * Resets vault completely (deletes all accounts and metadata)
   */
  async resetVault(): Promise<void> {
    this.lock();
    const db = await this.openDB();
    const tx = db.transaction([STORE_META, STORE_ACCOUNTS], 'readwrite');
    tx.objectStore(STORE_META).clear();
    tx.objectStore(STORE_ACCOUNTS).clear();

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const vault = new VaultStorage();
