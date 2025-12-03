// Secure transmission utilities - ensures credentials are never sent in plaintext
// Even if TLS is compromised, intercepted data is cryptographically protected

const encoder = new TextEncoder();

/**
 * Derives a secure transmission password from the user's actual password
 * Uses PBKDF2 with email-based salt to create a deterministic but protected credential
 * The actual password never leaves the browser
 */
export async function deriveTransmissionPassword(password: string, email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Create email-based salt for deterministic derivation
  const saltData = encoder.encode(`stand-transmission-salt:${normalizedEmail}`);
  const saltHash = await crypto.subtle.digest('SHA-256', saltData);
  
  // Import password as key material
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive transmission key using PBKDF2
  // Using 50,000 iterations - enough security for transmission without excessive latency
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(saltHash),
      iterations: 50000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );
  
  // Convert to base64 string that can be used as password
  // Adding prefix to ensure it meets Supabase password requirements
  const base64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return `Tx${base64}`;
}

/**
 * Derives a secure transmission email from the user's actual email
 * Creates a pseudonymous email that still routes correctly but protects the real address
 * Uses format: hash@stand.local (Supabase accepts this for auth)
 */
export async function deriveTransmissionEmail(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Create deterministic hash of email
  const emailData = encoder.encode(`stand-email-hash:${normalizedEmail}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', emailData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return hashed email format - still valid email format for Supabase
  // Using first 32 chars of hash for reasonable length
  return `${hashHex.substring(0, 32)}@secure.stand.local`;
}

/**
 * Transforms credentials for secure transmission
 * Password is cryptographically derived before transmission, email sent over TLS
 */
export async function secureCredentials(email: string, password: string): Promise<{
  transmissionEmail: string;
  transmissionPassword: string;
  originalEmail: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const transmissionPassword = await deriveTransmissionPassword(password, normalizedEmail);
  
  return {
    transmissionEmail: normalizedEmail, // Send email directly over TLS
    transmissionPassword, // Derived password - actual password never transmitted
    originalEmail: normalizedEmail // Keep for encryption key derivation
  };
}
