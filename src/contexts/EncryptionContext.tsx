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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsReady(true);
        return;
      }

      // Get user profile with pseudonym
      const { data: profile } = await supabase
        .from("profiles")
        .select("pseudonym_id")
        .eq("user_id", session.user.id)
        .single();

      if (profile) {
        setPseudonymId(profile.pseudonym_id);
        
        // Try to retrieve stored key first
        const storedKey = await EncryptionService.retrieveKey(session.user.id);
        if (storedKey) {
          setEncryptionKey(storedKey);
          setSessionEncryptionKey(storedKey);
          console.log('[EncryptionContext] Restored encryption key from storage');
        } else {
          // Check if key is in memory
          const key = getSessionEncryptionKey();
          if (key) {
            setEncryptionKey(key);
          } else {
            console.warn('[EncryptionContext] No encryption key available - user may need to re-login');
          }
        }
      }
      
      setIsReady(true);
    };

    checkSession();
  }, []);

  const initializeEncryption = async (userEmail: string, password: string) => {
    // Derive deterministic salt from email
    const salt = await EncryptionService.deriveSalt(userEmail);
    
    // Derive encryption key
    const key = await EncryptionService.deriveKey(password, salt);
    
    setEncryptionKey(key);
    setEmail(userEmail);
    setSessionEncryptionKey(key);
    
    // Store key in sessionStorage for page refreshes
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await EncryptionService.storeKey(user.id, key);
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
