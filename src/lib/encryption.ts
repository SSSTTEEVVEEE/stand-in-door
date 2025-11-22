// Client-side zero-knowledge encryption utilities
// Uses Web Crypto API for AES-256-GCM encryption with SHA3-512 integrity validation

import { sha3_512 } from 'js-sha3';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

export class EncryptionService {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Derive deterministic salt from email address
  static async deriveSalt(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();
    const data = this.encoder.encode(normalizedEmail);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Derive encryption key from password using PBKDF2
  static async deriveKey(password: string, salt: string): Promise<CryptoKey> {
    try {
      console.log('[Encryption] Starting key derivation...');
      
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      
      if (!salt || salt.length === 0) {
        throw new Error('Encryption salt is required');
      }
      
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        this.encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: this.encoder.encode(salt),
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
      
      console.log('[Encryption] Key derivation successful');
      return derivedKey;
    } catch (error) {
      console.error('[Encryption] Key derivation failed:', error);
      throw new Error(`Encryption key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Compute SHA3-512 hash for data integrity
  static computeHash(data: string): string {
    return sha3_512(data);
  }

  // Encrypt data with AES-256-GCM and return with hash
  static async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: string; hash: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      this.encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    const encryptedString = btoa(String.fromCharCode(...combined));
    const hash = this.computeHash(data);

    return { encrypted: encryptedString, hash };
  }

  // Decrypt data with AES-256-GCM and verify hash
  static async decrypt(encryptedData: string, key: CryptoKey, expectedHash?: string): Promise<string> {
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const decryptedString = this.decoder.decode(decrypted);

    // Verify data integrity if hash provided
    if (expectedHash) {
      const computedHash = this.computeHash(decryptedString);
      if (computedHash !== expectedHash) {
        throw new Error('Data integrity check failed: hash mismatch');
      }
    }

    return decryptedString;
  }

  // Export key for storage
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // Import key from storage
  static async importKey(keyData: string): Promise<CryptoKey> {
    const keyBytes = new Uint8Array(
      atob(keyData).split('').map(c => c.charCodeAt(0))
    );
    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Store encryption key in session storage (cleared on logout)
  static async storeKey(userId: string, key: CryptoKey): Promise<void> {
    try {
      const exportedKey = await this.exportKey(key);
      sessionStorage.setItem(`enc_key_${userId}`, exportedKey);
      sessionStorage.setItem(`enc_session_${userId}`, 'active');
      console.log('Encryption key stored for user:', userId);
    } catch (error) {
      console.error('Failed to store encryption key:', error);
      throw new Error('Could not store encryption key');
    }
  }

  static async retrieveKey(userId: string): Promise<CryptoKey | null> {
    try {
      const exportedKey = sessionStorage.getItem(`enc_key_${userId}`);
      if (!exportedKey) {
        console.log('No stored encryption key found for user:', userId);
        return null;
      }
      return await this.importKey(exportedKey);
    } catch (error) {
      console.error('Failed to retrieve encryption key:', error);
      return null;
    }
  }

  static clearKey(userId: string): void {
    try {
      sessionStorage.removeItem(`enc_key_${userId}`);
      sessionStorage.removeItem(`enc_session_${userId}`);
      console.log('Encryption key cleared for user:', userId);
    } catch (error) {
      console.error('Failed to clear encryption key:', error);
    }
  }

  static hasKey(userId: string): boolean {
    try {
      return sessionStorage.getItem(`enc_session_${userId}`) === 'active';
    } catch (error) {
      console.error('Failed to check encryption session:', error);
      return false;
    }
  }
}
