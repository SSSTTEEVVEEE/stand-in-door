import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EncryptionService } from "@/lib/encryption";

interface EncryptionContextType {
  encryptionKey: CryptoKey | null;
  pseudonymId: string | null;
  email: string | null;
  isReady: boolean;
  keyReady: boolean; // Separate flag for key availability
  encrypt: (data: string) => Promise<{ encrypted: string; hash: string }>;
  decrypt: (encryptedData: string, expectedHash?: string) => Promise<string>;
  initializeEncryption: (email: string, password: string) => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

// Store encryption key in memory for the session
let sessionEncryptionKey: CryptoKey | null = null;

export const setSessionEncryptionKey = (key: CryptoKey) => {
  sessionEncryptionKey = key;
};

export const getSessionEncryptionKey = (): CryptoKey | null => {
  return sessionEncryptionKey;
};

export const clearSessionEncryptionKey = () => {
  sessionEncryptionKey = null;
};

export const EncryptionProvider = ({ children }: { children: ReactNode }) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [pseudonymId, setPseudonymId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [keyReady, setKeyReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[EncryptionContext] Checking session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('[EncryptionContext] No active session');
          setIsReady(true);
          setKeyReady(false);
          return;
        }

        console.log('[EncryptionContext] Active session found for user:', session.user.id);
        console.log('[EncryptionContext] Fetching profile...');
        
        // Get user profile with pseudonym
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("pseudonym_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error('[EncryptionContext] Error fetching profile:', error);
          setIsReady(true);
          setKeyReady(false);
          return;
        }

        if (profile) {
          console.log('[EncryptionContext] Profile found, pseudonym_id:', profile.pseudonym_id);
          setPseudonymId(profile.pseudonym_id);
          
          // Get stored email
          const storedEmail = EncryptionService.getStoredEmail(session.user.id);
          if (storedEmail) {
            console.log('[EncryptionContext] Found stored email for key derivation');
            setEmail(storedEmail);
          }
          
          // Try to retrieve stored key first
          console.log('[EncryptionContext] Attempting to retrieve stored key...');
          const storedKey = await EncryptionService.retrieveKey(session.user.id);
          
          if (storedKey) {
            console.log('[EncryptionContext] Successfully restored encryption key from localStorage');
            setEncryptionKey(storedKey);
            setSessionEncryptionKey(storedKey);
            setKeyReady(true);
          } else {
            // Check if key is in memory
            console.log('[EncryptionContext] No stored key, checking memory...');
            const key = getSessionEncryptionKey();
            if (key) {
              console.log('[EncryptionContext] Using encryption key from memory');
              setEncryptionKey(key);
              setKeyReady(true);
            } else {
              console.warn('[EncryptionContext] ⚠️ NO ENCRYPTION KEY AVAILABLE - User must re-login with password');
              setKeyReady(false);
            }
          }
        } else {
          console.warn('[EncryptionContext] No profile found for user');
          setKeyReady(false);
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('[EncryptionContext] Unexpected error during session check:', error);
        setIsReady(true);
        setKeyReady(false);
      }
    };

    // Initial check
    console.log('[EncryptionContext] Provider mounted, starting initial session check...');
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[EncryptionContext] 🔔 Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('[EncryptionContext] 🚪 User signed out, clearing encryption data');
        setEncryptionKey(null);
        setPseudonymId(null);
        setEmail(null);
        setKeyReady(false);
        clearSessionEncryptionKey();
        
        // Clear stored keys on sign out
        if (session?.user?.id) {
          EncryptionService.clearKey(session.user.id);
        }
      } else if (event === 'SIGNED_IN' && session) {
        console.log('[EncryptionContext] ✅ User signed in, re-checking session');
        // Defer to avoid race conditions
        setTimeout(() => {
          checkSession();
        }, 100);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeEncryption = async (userEmail: string, password: string) => {
    try {
      console.log('[EncryptionContext] 🔐 Starting encryption initialization...');
      console.log('[EncryptionContext] Email:', userEmail);
      
      // Derive deterministic salt from email
      console.log('[EncryptionContext] Step 1: Deriving salt from email...');
      const salt = await EncryptionService.deriveSalt(userEmail);
      console.log('[EncryptionContext] Salt derived (length):', salt.length);
      
      // Derive encryption key using PBKDF2
      console.log('[EncryptionContext] Step 2: Deriving encryption key with PBKDF2...');
      const key = await EncryptionService.deriveKey(password, salt);
      console.log('[EncryptionContext] Key derived successfully');
      
      // Validate the key works
      console.log('[EncryptionContext] Step 3: Validating key...');
      const isValid = await EncryptionService.validateKey(key);
      if (!isValid) {
        throw new Error('Generated key failed validation');
      }
      console.log('[EncryptionContext] Key validated successfully');
      
      // Set key in state and memory
      console.log('[EncryptionContext] Step 4: Setting encryption key in state...');
      setEncryptionKey(key);
      setEmail(userEmail);
      setSessionEncryptionKey(key);
      setKeyReady(true);
      
      // Store key in localStorage for persistence
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[EncryptionContext] Step 5: Storing key to localStorage for user:', user.id);
        await EncryptionService.storeKey(user.id, key, userEmail);
        console.log('[EncryptionContext] ✅ Encryption initialization complete');
      } else {
        throw new Error('No user found after authentication');
      }
    } catch (error) {
      console.error('[EncryptionContext] ❌ Encryption initialization failed:', error);
      setKeyReady(false);
      throw error;
    }
  };

  const encrypt = async (data: string): Promise<{ encrypted: string; hash: string }> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      console.error('[EncryptionContext] ❌ Encryption key not available');
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
    console.log('[EncryptionContext] Encrypting data...');
    return EncryptionService.encrypt(data, key);
  };

  const decrypt = async (encryptedData: string, expectedHash?: string): Promise<string> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      console.error('[EncryptionContext] ❌ Decryption key not available');
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
    console.log('[EncryptionContext] Decrypting data...');
    // Note: expectedHash is now ignored - AES-GCM provides authenticated encryption
    return EncryptionService.decrypt(encryptedData, key);
  };

  const value = {
    encryptionKey,
    pseudonymId,
    email,
    isReady,
    keyReady,
    encrypt,
    decrypt,
    initializeEncryption,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
};
