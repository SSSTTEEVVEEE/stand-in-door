import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EncryptionService } from "@/lib/encryption";

interface EncryptionContextType {
  encryptionKey: CryptoKey | null;
  pseudonymId: string | null;
  email: string | null;
  isReady: boolean;
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

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('[EncryptionContext] No active session');
          setIsReady(true);
          return;
        }

        console.log('[EncryptionContext] Active session found, fetching profile...');
        
        // Get user profile with pseudonym
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("pseudonym_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error('[EncryptionContext] Error fetching profile:', error);
          setIsReady(true);
          return;
        }

        if (profile) {
          console.log('[EncryptionContext] Profile found, pseudonym_id:', profile.pseudonym_id);
          setPseudonymId(profile.pseudonym_id);
          
          // Try to retrieve stored key first
          const storedKey = await EncryptionService.retrieveKey(session.user.id);
          if (storedKey) {
            setEncryptionKey(storedKey);
            setSessionEncryptionKey(storedKey);
            console.log('[EncryptionContext] Restored encryption key from localStorage');
          } else {
            // Check if key is in memory
            const key = getSessionEncryptionKey();
            if (key) {
              setEncryptionKey(key);
              console.log('[EncryptionContext] Using encryption key from memory');
            } else {
              console.warn('[EncryptionContext] No encryption key available - user needs to re-login');
            }
          }
        } else {
          console.warn('[EncryptionContext] No profile found for user');
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('[EncryptionContext] Unexpected error during session check:', error);
        setIsReady(true);
      }
    };

    checkSession();
  }, []);

  const initializeEncryption = async (userEmail: string, password: string) => {
    try {
      console.log('[EncryptionContext] Starting encryption initialization...');
      
      // Derive deterministic salt from email
      console.log('[EncryptionContext] Deriving salt from email...');
      const salt = await EncryptionService.deriveSalt(userEmail);
      
      // Derive encryption key
      console.log('[EncryptionContext] Deriving encryption key...');
      const key = await EncryptionService.deriveKey(password, salt);
      
      console.log('[EncryptionContext] Setting encryption key in state...');
      setEncryptionKey(key);
      setEmail(userEmail);
      setSessionEncryptionKey(key);
      
      // Store key in localStorage for persistence
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[EncryptionContext] Storing key to localStorage...');
        await EncryptionService.storeKey(user.id, key);
        console.log('[EncryptionContext] Encryption initialization complete');
      } else {
        throw new Error('No user found after authentication');
      }
    } catch (error) {
      console.error('[EncryptionContext] Encryption initialization failed:', error);
      throw error;
    }
  };

  const encrypt = async (data: string): Promise<{ encrypted: string; hash: string }> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      console.error('[EncryptionContext] Encryption key not available');
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
    return EncryptionService.encrypt(data, key);
  };

  const decrypt = async (encryptedData: string, expectedHash?: string): Promise<string> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      console.error('[EncryptionContext] Encryption key not available');
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
    return EncryptionService.decrypt(encryptedData, key, expectedHash);
  };

  const value = {
    encryptionKey,
    pseudonymId,
    email,
    isReady,
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
