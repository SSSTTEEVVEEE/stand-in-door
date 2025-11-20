import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EncryptionService } from "@/lib/encryption";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[Auth] User already logged in, redirecting to /app');
        navigate("/app");
      }
    });
  }, [navigate]);

  // Track failed login attempts for fraud detection (3 strikes rule)
  const getFailedAttempts = (email: string): number => {
    try {
      const key = `failed_attempts_${email}`;
      const attempts = sessionStorage.getItem(key);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      console.error('[Auth] Error reading failed attempts:', error);
      return 0;
    }
  };

  const incrementFailedAttempts = (email: string): number => {
    try {
      const key = `failed_attempts_${email}`;
      const currentAttempts = getFailedAttempts(email);
      const newAttempts = currentAttempts + 1;
      sessionStorage.setItem(key, newAttempts.toString());
      console.log(`[Auth] Failed attempts for ${email}: ${newAttempts}`);
      return newAttempts;
    } catch (error) {
      console.error('[Auth] Error incrementing failed attempts:', error);
      return 1;
    }
  };

  const clearFailedAttempts = (email: string): void => {
    try {
      const key = `failed_attempts_${email}`;
      sessionStorage.removeItem(key);
      console.log(`[Auth] Cleared failed attempts for ${email}`);
    } catch (error) {
      console.error('[Auth] Error clearing failed attempts:', error);
    }
  };

  const trackFailedAttempt = async (email: string, reason: string) => {
    try {
      console.log('[Auth] Tracking failed attempt:', { email, reason });
      const navigatorData = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
      };

      const { error } = await supabase.from("failed_auth_attempts").insert({
        email,
        reason,
        navigator_data: navigatorData,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error('[Auth] Failed to track auth attempt:', error);
      } else {
        console.log('[Auth] Successfully tracked fraud telemetry for:', email);
      }
    } catch (error) {
      console.error('[Auth] Exception tracking auth attempt:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log(`[Auth] ${isLogin ? 'Login' : 'Signup'} attempt for:`, email);

    try {
      if (isLogin) {
        console.log('[Auth] Starting login process...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('[Auth] Login error:', error);
          
          // Increment failed attempts counter
          const attempts = incrementFailedAttempts(email);
          
          // Only track in database after 3 failed attempts (fraud telemetry)
          if (attempts >= 3) {
            console.warn('[Auth] FRAUD ALERT: 3+ failed login attempts detected for:', email);
            await trackFailedAttempt(email, `Multiple failed attempts: ${error.message}`);
          }
          
          toast({
            title: "Authentication Failed",
            description: attempts >= 3 
              ? "Multiple failed attempts detected. Please verify your credentials."
              : error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.user) {
          console.log('[Auth] Login successful for user:', data.user.id);
          
          // Clear failed attempts on successful login
          clearFailedAttempts(email);
          
          try {
            console.log('[Auth] Fetching user profile...');
            // Derive encryption key from password
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("encryption_salt")
              .eq("user_id", data.user.id)
              .single();

            if (profileError) {
              console.error('[Auth] Profile fetch error:', profileError);
              throw new Error(`Profile fetch failed: ${profileError.message}`);
            }

            if (!profile) {
              console.error('[Auth] No profile found for user:', data.user.id);
              throw new Error("User profile not found");
            }

            if (!profile.encryption_salt) {
              console.error('[Auth] No encryption salt in profile');
              throw new Error("Encryption configuration missing");
            }

            console.log('[Auth] Deriving encryption key...');
            const key = await EncryptionService.deriveKey(password, profile.encryption_salt);
            EncryptionService.storeKey(data.user.id, key);
            console.log('[Auth] Encryption key stored successfully');

            toast({
              title: "Access Granted",
              description: "Authentication successful",
            });
            navigate("/app");
          } catch (encryptionError: any) {
            console.error('[Auth] Encryption initialization failed:', encryptionError);
            toast({
              title: "Encryption Failed",
              description: encryptionError.message || "Could not initialize encryption. Please try again.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
        }
      } else {
        console.log('[Auth] Starting signup process...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          console.error('[Auth] Signup error:', error);
          
          // Track signup errors as fraud telemetry
          await trackFailedAttempt(email, `Signup error: ${error.message}`);
          
          toast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.user) {
          console.log('[Auth] Signup successful, user ID:', data.user.id);
          
          // Wait for the database trigger to create profile
          console.log('[Auth] Waiting for profile creation...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            console.log('[Auth] Verifying profile creation...');
            // Verify profile was created with encryption salt
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("encryption_salt, pseudonym_id")
              .eq("user_id", data.user.id)
              .single();

            if (profileError) {
              console.error('[Auth] Profile verification error:', profileError);
              throw new Error(`Profile verification failed: ${profileError.message}`);
            }

            if (!profile || !profile.encryption_salt) {
              console.error('[Auth] Profile missing or incomplete:', profile);
              throw new Error("Encryption setup incomplete");
            }

            console.log('[Auth] Profile verified successfully');
            toast({
              title: "Account Created",
              description: "You can now log in with your credentials",
            });
            setIsLogin(true);
            
            // Clear the form
            setPassword("");
          } catch (verificationError: any) {
            console.error('[Auth] Profile verification failed:', verificationError);
            toast({
              title: "Setup Error",
              description: verificationError.message || "Account created but encryption setup incomplete. Please contact support.",
              variant: "destructive",
            });
            
            // Track this critical error
            await trackFailedAttempt(email, `Profile setup failed: ${verificationError.message}`);
          }
        }
      }
    } catch (error: any) {
      console.error('[Auth] Unexpected error:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">STAND</h1>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">in the door</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="font-mono"
            />
          </div>

          <Button type="submit" className="w-full font-bold" disabled={loading}>
            {loading ? "PROCESSING..." : isLogin ? "LOGIN" : "REGISTER"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "Need an account? Register" : "Already have an account? Login"}
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground"></div>
      </Card>
    </div>
  );
};

export default Auth;
