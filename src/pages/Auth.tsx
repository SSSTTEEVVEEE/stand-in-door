import { useState, useEffect, useCallback } from "react";
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
import { useFraudTelemetry } from "@/hooks/useFraudTelemetry";
import { TrackingEnforcementModal } from "@/components/TrackingEnforcementModal";
import { SecureKeyboard } from "@/components/SecureKeyboard";
import { SecureInput } from "@/components/SecureInput";
import { useIsMobile } from "@/hooks/use-mobile";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { initializeEncryption } = useEncryption();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  
  // Secure keyboard state
  const [activeField, setActiveField] = useState<"email" | "password" | null>(null);
  
  // Fraud telemetry
  const {
    collectAll,
    sendTelemetry,
    reset: resetTelemetry,
    trackingBlocked,
    isCollecting,
    startContinuousMonitoring,
    stopContinuousMonitoring,
  } = useFraudTelemetry();
  
  // Secure keyboard handlers
  const handleKeyPress = useCallback((char: string) => {
    if (activeField === "email") {
      setEmail((prev) => prev + char);
    } else if (activeField === "password") {
      setPassword((prev) => prev + char);
    }
  }, [activeField]);
  
  const handleDelete = useCallback(() => {
    if (activeField === "email") {
      setEmail((prev) => prev.slice(0, -1));
    } else if (activeField === "password") {
      setPassword((prev) => prev.slice(0, -1));
    }
  }, [activeField]);
  
  const handleKeyboardSubmit = useCallback(() => {
    setActiveField(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        stopContinuousMonitoring();
        navigate("/app");
      }
    });
  }, [navigate, stopContinuousMonitoring]);

  // Retry telemetry collection when modal is shown
  const handleTelemetryRetry = async () => {
    const success = await collectAll(1);
    if (success && email) {
      await sendTelemetry(email, isLogin ? 'login' : 'signup');
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
      // Reset and collect fresh telemetry
      resetTelemetry();
      await collectAll();
      
      // Send telemetry (non-blocking for auth flow)
      const telemetryResult = await sendTelemetry(
        validation.data.email, 
        isLogin ? 'login' : 'signup'
      );
      
      // If tracking is blocked but we should continue, start monitoring
      if (telemetryResult.continueTelemetry) {
        startContinuousMonitoring(validation.data.email);
      }

      // Derive secure transmission credentials
      const { transmissionEmail, transmissionPassword, originalEmail } = 
        await secureCredentials(validation.data.email, validation.data.password);

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: transmissionEmail,
          password: transmissionPassword,
        });

        if (error) {
          // Send failure telemetry
          await sendTelemetry(validation.data.email, 'login');
          
          toast({
            title: "Authentication Failed",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.user) {
          try {
            await initializeEncryption(originalEmail, validation.data.password);
            stopContinuousMonitoring();
            
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
          await sendTelemetry(validation.data.email, 'signup');
          
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
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      onTouchStart={() => {
        // Close keyboard when tapping outside inputs
        if (activeField) {
          setActiveField(null);
        }
      }}
    >
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">STAND</h1>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">in the door</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            {isMobile ? (
              <SecureInput
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                onFocus={() => setActiveField("email")}
                onBlur={() => {}}
                placeholder="your@email.com"
                isFocused={activeField === "email"}
              />
            ) : (
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="font-mono"
              />
            )}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            {isMobile ? (
              <SecureInput
                id="password"
                type="password"
                value={password}
                onChange={setPassword}
                onFocus={() => setActiveField("password")}
                onBlur={() => {}}
                placeholder="••••••••"
                isFocused={activeField === "password"}
              />
            ) : (
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
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full font-bold" 
            disabled={loading || isCollecting}
          >
            {loading ? "PROCESSING..." : isCollecting ? "VERIFYING..." : isLogin ? "LOGIN" : "REGISTER"}
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
      
      {/* Security verification modal - blocks interaction when tracking fails */}
      <TrackingEnforcementModal 
        isOpen={trackingBlocked} 
        onRetry={handleTelemetryRetry}
      />
      
      {/* Secure keyboard for mobile */}
      {isMobile && (
        <SecureKeyboard
          visible={activeField !== null}
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onSubmit={handleKeyboardSubmit}
        />
      )}
    </div>
  );
};

export default Auth;
