import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChoresSection from "@/components/sections/ChoresSection";
import ChecklistsSection from "@/components/sections/ChecklistsSection";
import CalendarSection from "@/components/sections/CalendarSection";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-2xl">
          <div className="space-y-2">
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter">STAND</h1>
            <p className="text-muted-foreground text-sm md:text-base tracking-widest uppercase">in the door</p>
          </div>

          <p className="text-foreground/80 text-lg max-w-xl mx-auto leading-relaxed">
            Robust task optimization. Zero-knowledge encryption. Complete operational control.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button size="lg" className="font-bold tracking-wide" onClick={() => setIsAuthenticated(true)}>
              DEPLOY
            </Button>
            <Button size="lg" variant="outline" className="font-bold tracking-wide">
              SECURE LOGIN
            </Button>
          </div>

          <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <Card className="p-6 border-border bg-card">
              <h3 className="font-bold text-xl mb-2">Tasks</h3>
              <p className="text-sm text-muted-foreground">
                ML-optimized task scheduling using Monte Carlo simulation to minimize workload variance across 228-day
                cycles.
              </p>
            </Card>
            <Card className="p-6 border-border bg-card">
              <h3 className="font-bold text-xl mb-2">CHECKLISTS</h3>
              <p className="text-sm text-muted-foreground">
                Tactical reminder systems with grouped operations for Critical task execution.
              </p>
            </Card>
            <Card className="p-6 border-border bg-card">
              <h3 className="font-bold text-xl mb-2">CALENDAR</h3>
              <p className="text-sm text-muted-foreground">
                Robust scheduling with seamless integration across all operational modules.
              </p>
            </Card>
          </div>

          <div className="pt-8 text-xs text-muted-foreground space-y-1">
            <p>🔒 Your Data is Protected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold">STAND</h1>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">in the door</p>
        </div>
        <Button variant="outline" size="sm" className="font-bold">
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
