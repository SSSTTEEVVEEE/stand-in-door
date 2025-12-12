import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EncryptionProvider } from "@/contexts/EncryptionContext";
import { SecureKeyboardProvider } from "@/contexts/SecureKeyboardContext";
import { GlobalSecureKeyboard } from "@/components/GlobalSecureKeyboard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <EncryptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SecureKeyboardProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app" element={<Index />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <GlobalSecureKeyboard />
          </SecureKeyboardProvider>
        </BrowserRouter>
      </TooltipProvider>
    </EncryptionProvider>
  </QueryClientProvider>
);

export default App;
