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

      // Get user profile with salt and pseudonym
      const { data: profile } = await supabase
        .from("profiles")
        .select("encryption_salt, pseudonym_id")
        .eq("user_id", session.user.id)
        .single();

      if (profile) {
        setPseudonymId(profile.pseudonym_id);
        
        // Check if key is in session
        if (EncryptionService.hasKey(session.user.id)) {
          // In a real implementation, we'd need to properly restore the key
          // For now, we'll prompt for password on page refresh
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

  const encrypt = async (data: string): Promise<string> => {
    if (!encryptionKey) {
      throw new Error("Encryption key not available");
    }
    return EncryptionService.encrypt(data, encryptionKey);
  };

  const decrypt = async (encryptedData: string): Promise<string> => {
    if (!encryptionKey) {
      throw new Error("Encryption key not available");
    }
    return EncryptionService.decrypt(encryptedData, encryptionKey);
  };

  return {
    encrypt,
    decrypt,
    pseudonymId,
    isReady,
  };
};
