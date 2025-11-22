import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ChoresSection from "@/components/sections/ChoresSection";
import ChecklistsSection from "@/components/sections/ChecklistsSection";
import CalendarSection from "@/components/sections/CalendarSection";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { EncryptionService } from "@/lib/encryption";
import { ListTodo, CheckSquare, Calendar, User as UserIcon } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"chores" | "checklists" | "calendar">("chores");

  useEffect(() => {
    console.log('[Index] Initializing authentication check...');
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        console.log('[Index] No active session, redirecting to landing page');
        navigate("/");
      } else {
        console.log('[Index] Active session found for user:', session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Index] Auth state changed:', _event);
      setUser(session?.user ?? null);
      if (!session) {
        console.log('[Index] Session ended, redirecting to landing page');
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    console.log('[Index] Logging out user...');
    if (user) {
      EncryptionService.clearKey(user.id);
    }
    await supabase.auth.signOut();
    console.log('[Index] Logout complete, redirecting to landing page');
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">INITIALIZING...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }


  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 p-4 md:p-8">
        {activeView === "chores" && <ChoresSection />}
        {activeView === "checklists" && <ChecklistsSection />}
        {activeView === "calendar" && <CalendarSection />}
      </main>

      <footer className="p-4 md:p-6 border-t flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">STAND</h1>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">in the door</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveView("chores")}
            className={`p-2 rounded-lg transition-colors ${
              activeView === "chores" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-label="Chores"
          >
            <ListTodo className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveView("checklists")}
            className={`p-2 rounded-lg transition-colors ${
              activeView === "checklists" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-label="Checklists"
          >
            <CheckSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveView("calendar")}
            className={`p-2 rounded-lg transition-colors ${
              activeView === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-label="Calendar"
          >
            <Calendar className="w-5 h-5" />
          </button>
          <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Logout">
            <UserIcon className="w-5 h-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;
