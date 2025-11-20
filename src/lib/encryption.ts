// Client-side zero-knowledge encryption utilities
// Uses Web Crypto API for AES-256-GCM encryption

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

export class EncryptionService {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Derive encryption key from password using PBKDF2
  static async deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
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
  }

  // Encrypt data with AES-256-GCM
  static async encrypt(data: string, key: CryptoKey): Promise<string> {
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

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt data with AES-256-GCM
  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
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

    return this.decoder.decode(decrypted);
  }

  // Store encryption key in session storage (cleared on logout)
  static storeKey(userId: string, key: CryptoKey): void {
    try {
      // We can't directly store CryptoKey, so we store a flag
      sessionStorage.setItem(`enc_session_${userId}`, 'active');
      console.log('Encryption key session initialized for user:', userId);
    } catch (error) {
      console.error('Failed to store encryption session:', error);
      throw new Error('Could not initialize encryption session');
    }
  }

  static clearKey(userId: string): void {
    try {
      sessionStorage.removeItem(`enc_session_${userId}`);
      console.log('Encryption key session cleared for user:', userId);
    } catch (error) {
      console.error('Failed to clear encryption session:', error);
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
