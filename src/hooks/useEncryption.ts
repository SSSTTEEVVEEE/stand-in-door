import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EncryptionService } from "@/lib/encryption";

export const useEncryption = () => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [pseudonymId, setPseudonymId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeEncryption = async () => {
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
        
        // Check if key is in session
        if (EncryptionService.hasKey(session.user.id)) {
          // Key is stored in memory
          setIsReady(true);
        } else {
          // Key not available - user needs to re-login
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    };

    initializeEncryption();
  }, []);

  const encrypt = async (data: string): Promise<{ encrypted: string; hash: string }> => {
    if (!encryptionKey) {
      throw new Error("Encryption key not available");
    }
    return EncryptionService.encrypt(data, encryptionKey);
  };

  const decrypt = async (encryptedData: string, expectedHash?: string): Promise<string> => {
    if (!encryptionKey) {
      throw new Error("Encryption key not available");
    }
    return EncryptionService.decrypt(encryptedData, encryptionKey, expectedHash);
  };

  return {
    encrypt,
    decrypt,
    pseudonymId,
    isReady,
  };
};
