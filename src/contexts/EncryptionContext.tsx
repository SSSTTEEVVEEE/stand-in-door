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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setIsReady(true);
          setKeyReady(false);
          return;
        }
        
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("pseudonym_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          setIsReady(true);
          setKeyReady(false);
          return;
        }

        if (profile) {
          setPseudonymId(profile.pseudonym_id);
          
          const storedEmail = EncryptionService.getStoredEmail(session.user.id);
          if (storedEmail) {
            setEmail(storedEmail);
          }
          
          const storedKey = await EncryptionService.retrieveKey(session.user.id);
          
          if (storedKey) {
            setEncryptionKey(storedKey);
            setSessionEncryptionKey(storedKey);
            setKeyReady(true);
          } else {
            const key = getSessionEncryptionKey();
            if (key) {
              setEncryptionKey(key);
              setKeyReady(true);
            } else {
              setKeyReady(false);
            }
          }
        } else {
          setKeyReady(false);
        }
        
        setIsReady(true);
      } catch (error) {
        setIsReady(true);
        setKeyReady(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setEncryptionKey(null);
        setPseudonymId(null);
        setEmail(null);
        setKeyReady(false);
        clearSessionEncryptionKey();
        
        if (session?.user?.id) {
          EncryptionService.clearKey(session.user.id);
        }
      } else if (event === 'SIGNED_IN' && session) {
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
      const salt = await EncryptionService.deriveSalt(userEmail);
      const key = await EncryptionService.deriveKey(password, salt);
      
      const isValid = await EncryptionService.validateKey(key);
      if (!isValid) {
        throw new Error('Generated key failed validation');
      }
      
      setEncryptionKey(key);
      setEmail(userEmail);
      setSessionEncryptionKey(key);
      setKeyReady(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await EncryptionService.storeKey(user.id, key, userEmail);
      } else {
        throw new Error('No user found after authentication');
      }
    } catch (error) {
      setKeyReady(false);
      throw error;
    }
  };

  const encrypt = async (data: string): Promise<{ encrypted: string; hash: string }> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
    return EncryptionService.encrypt(data, key);
  };

  const decrypt = async (encryptedData: string, expectedHash?: string): Promise<string> => {
    const key = encryptionKey || getSessionEncryptionKey();
    if (!key) {
      throw new Error("Encryption key not available. Please log out and log back in.");
    }
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
