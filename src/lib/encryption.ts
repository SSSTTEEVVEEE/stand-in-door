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
        true, // Must be extractable to allow exporting for storage
        ['encrypt', 'decrypt']
      );
      
      console.log('[Encryption] Key derivation successful');
      return derivedKey;
    } catch (error) {
      console.error('[Encryption] Key derivation failed:', error);
      throw new Error(`Encryption key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Compute SHA3-512 hash for data integrity (deprecated - AES-GCM provides authentication)
  static computeHash(data: string): string {
    return sha3_512(data);
  }

  // Encrypt data with AES-256-GCM (authenticated encryption - no separate hash needed)
  static async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: string; hash: string }> {
    console.log('[Encryption] Encrypting data...');
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
    
    // Keep hash for backward compatibility but don't verify it
    const hash = this.computeHash(data);
    console.log('[Encryption] Data encrypted successfully');

    return { encrypted: encryptedString, hash };
  }

  // Decrypt data with AES-256-GCM (hash parameter ignored - AES-GCM provides authentication)
  static async decrypt(encryptedData: string, key: CryptoKey, expectedHash?: string): Promise<string> {
    console.log('[Encryption] Decrypting data...');
    try {
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
      console.log('[Encryption] Data decrypted successfully');

      // Note: We ignore expectedHash - AES-GCM already provides authenticated encryption
      // If the key is wrong or data is tampered, decrypt() will throw an error

      return decryptedString;
    } catch (error) {
      console.error('[Encryption] Decryption failed:', error);
      throw new Error('Decryption failed - invalid key or corrupted data');
    }
  }

  // Export key for storage
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // Import key from storage (MUST be extractable to match exportKey)
  static async importKey(keyData: string): Promise<CryptoKey> {
    console.log('[Encryption] Importing key from storage...');
    const keyBytes = new Uint8Array(
      atob(keyData).split('').map(c => c.charCodeAt(0))
    );
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: KEY_LENGTH },
      true, // CRITICAL: Must be extractable to allow re-export
      ['encrypt', 'decrypt']
    );
    console.log('[Encryption] Key imported successfully');
    return key;
  }

  // Validate key by testing encryption/decryption
  static async validateKey(key: CryptoKey): Promise<boolean> {
    try {
      console.log('[Encryption] Validating key...');
      const testData = 'test_validation_string';
      const { encrypted } = await this.encrypt(testData, key);
      const decrypted = await this.decrypt(encrypted, key);
      const isValid = decrypted === testData;
      console.log('[Encryption] Key validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('[Encryption] Key validation failed:', error);
      return false;
    }
  }

  // Store encryption key AND email in localStorage (persists across sessions)
  static async storeKey(userId: string, key: CryptoKey, email?: string): Promise<void> {
    try {
      console.log('[Encryption] Starting key export for user:', userId);
      const exportedKey = await this.exportKey(key);
      console.log('[Encryption] Key exported successfully, storing to localStorage...');
      
      localStorage.setItem(`enc_key_${userId}`, exportedKey);
      localStorage.setItem(`enc_session_${userId}`, 'active');
      
      // Store normalized email for key re-derivation if needed
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        localStorage.setItem(`enc_email_${userId}`, normalizedEmail);
        console.log('[Encryption] Email stored for potential key re-derivation');
      }
      
      console.log('[Encryption] Encryption key stored successfully for user:', userId);
    } catch (error) {
      console.error('[Encryption] Failed to store encryption key:', error);
      throw new Error('Could not store encryption key');
    }
  }

  static async retrieveKey(userId: string): Promise<CryptoKey | null> {
    try {
      console.log('[Encryption] Attempting to retrieve key for user:', userId);
      const exportedKey = localStorage.getItem(`enc_key_${userId}`);
      
      if (!exportedKey) {
        console.log('[Encryption] No stored encryption key found');
        return null;
      }
      
      console.log('[Encryption] Found stored key, importing...');
      const key = await this.importKey(exportedKey);
      
      // Validate the key works correctly
      console.log('[Encryption] Validating retrieved key...');
      const isValid = await this.validateKey(key);
      
      if (!isValid) {
        console.error('[Encryption] Retrieved key failed validation - clearing invalid key');
        this.clearKey(userId);
        return null;
      }
      
      console.log('[Encryption] Key imported and validated successfully');
      return key;
    } catch (error) {
      console.error('[Encryption] Failed to retrieve encryption key:', error);
      // Clear potentially corrupted key
      this.clearKey(userId);
      return null;
    }
  }

  // Get stored email for key re-derivation
  static getStoredEmail(userId: string): string | null {
    try {
      return localStorage.getItem(`enc_email_${userId}`);
    } catch (error) {
      console.error('[Encryption] Failed to retrieve stored email:', error);
      return null;
    }
  }

  static clearKey(userId: string): void {
    try {
      localStorage.removeItem(`enc_key_${userId}`);
      localStorage.removeItem(`enc_session_${userId}`);
      localStorage.removeItem(`enc_email_${userId}`);
      console.log('[Encryption] Encryption key and email cleared for user:', userId);
    } catch (error) {
      console.error('[Encryption] Failed to clear encryption key:', error);
    }
  }

  static hasKey(userId: string): boolean {
    try {
      return localStorage.getItem(`enc_session_${userId}`) === 'active';
    } catch (error) {
      console.error('[Encryption] Failed to check encryption session:', error);
      return false;
    }
  }
}
