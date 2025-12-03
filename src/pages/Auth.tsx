import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { authSchema } from "@/lib/validation";
import { secureCredentials } from "@/lib/secureTransmission";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { initializeEncryption } = useEncryption();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/app");
      }
    });
  }, [navigate]);

  // Server-side fraud detection via edge function
  // Note: We hash the email before sending to protect user identity
  const trackFailedAttempt = async (hashedEmail: string, reason: string) => {
    try {
      const navigatorData = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
      };

      await supabase.functions.invoke('track-auth-attempt', {
        body: { email: hashedEmail, reason, navigatorData },
      });
    } catch (error) {
      // Silently fail - don't block auth flow
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Derive secure transmission credentials - actual password/email never sent to server
      const { transmissionEmail, transmissionPassword, originalEmail } = 
        await secureCredentials(validation.data.email, validation.data.password);

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: transmissionEmail,
          password: transmissionPassword,
        });

        if (error) {
          // Track failed attempt with hashed email (protects real email)
          await trackFailedAttempt(transmissionEmail, `Login failed: ${error.message}`);
          
          toast({
            title: "Authentication Failed",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.user) {
          try {
            // Initialize encryption with ORIGINAL credentials (never sent to server)
            await initializeEncryption(originalEmail, validation.data.password);

            toast({
              title: "Access Granted",
              description: "Authentication successful",
            });
            navigate("/app");
          } catch (encryptionError: any) {
            toast({
              title: "Encryption Failed",
              description: "Could not initialize encryption. Please try again.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: transmissionEmail,
          password: transmissionPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          // Track signup error with hashed email
          await trackFailedAttempt(transmissionEmail, `Signup error: ${error.message}`);
          
          toast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.user) {
          toast({
            title: "Account Created",
            description: "Please check your email to verify your account before logging in.",
          });
          setIsLogin(true);
          setPassword("");
        }
      }
    } catch (error: any) {
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
