import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChoresSection from "@/components/sections/ChoresSection";
import ChecklistsSection from "@/components/sections/ChecklistsSection";
import CalendarSection from "@/components/sections/CalendarSection";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { EncryptionService } from "@/lib/encryption";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    if (user) {
      EncryptionService.clearKey(user.id);
    }
    await supabase.auth.signOut();
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
    <div className="min-h-screen p-4 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold">STAND</h1>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">in the door</p>
        </div>
        <Button variant="outline" size="sm" className="font-bold" onClick={handleLogout}>
          LOGOUT
        </Button>
      </header>

      <Tabs defaultValue="chores" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="chores" className="font-bold">
            CHORES
          </TabsTrigger>
          <TabsTrigger value="checklists" className="font-bold">
            CHECKLISTS
          </TabsTrigger>
          <TabsTrigger value="calendar" className="font-bold">
            CALENDAR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chores">
          <ChoresSection />
        </TabsContent>

        <TabsContent value="checklists">
          <ChecklistsSection />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
