import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';

interface TrackingEnforcementModalProps {
  isOpen: boolean;
  onRetry?: () => void;
}

export function TrackingEnforcementModal({ isOpen, onRetry }: TrackingEnforcementModalProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Auto-retry every 5 seconds
  useEffect(() => {
    if (!isOpen) {
      setRetryCount(0);
      return;
    }
    
    const interval = setInterval(() => {
      if (!isRetrying && onRetry) {
        setIsRetrying(true);
        setRetryCount(prev => prev + 1);
        
        // Call retry and wait a moment
        Promise.resolve(onRetry()).finally(() => {
          setTimeout(() => setIsRetrying(false), 1000);
        });
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isOpen, isRetrying, onRetry]);
  
  // Prevent closing via escape or outside click
  const handleOpenChange = (open: boolean) => {
    // Only allow opening, not closing
    if (open) return;
  };
  
  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent 
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <Shield className="h-16 w-16 text-destructive" />
              <AlertTriangle className="h-6 w-6 text-destructive absolute -bottom-1 -right-1 bg-background rounded-full" />
            </div>
          </div>
          
          <AlertDialogTitle className="text-center text-xl">
            Security Verification Required
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-center space-y-4">
            <p>
              We detected that security verification was blocked on your device. 
              This may be due to browser extensions, privacy settings, or network configuration.
            </p>
            
            <div className="bg-muted p-4 rounded-lg text-sm text-left">
              <p className="font-semibold mb-2">To continue, please:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Disable ad blockers for this site</li>
                <li>Disable privacy extensions temporarily</li>
                <li>Ensure JavaScript is fully enabled</li>
                <li>Try using a different browser</li>
              </ul>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying security status...</span>
                </>
              ) : (
                <span>Retrying verification in 5 seconds... (Attempt {retryCount + 1})</span>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
