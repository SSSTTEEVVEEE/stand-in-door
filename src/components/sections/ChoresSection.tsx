import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { choreSchema } from "@/lib/validation";

interface Chore {
  id?: string;
  name: string;
  period: number;
}

const ChoresSection = () => {
  const { toast } = useToast();
  const { encrypt, decrypt, pseudonymId, isReady } = useEncryption();
  const [chores, setChores] = useState<Chore[]>([]);
  const [newChoreName, setNewChoreName] = useState("");
  const [newChorePeriod, setNewChorePeriod] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isReady && pseudonymId) {
      loadChores();
    }
  }, [isReady, pseudonymId]);

  const loadChores = async () => {
    if (!pseudonymId) {
      setLoading(false);
      return;
    }

    try {
      const { data: choresData, error } = await supabase
        .from("chores")
        .select("*")
        .eq("pseudonym_id", pseudonymId);

      if (error) {
        throw error;
      }

      if (choresData) {
        const decryptedChores = await Promise.all(
          choresData.map(async (c) => {
            try {
              const name = await decrypt(c.encrypted_name);
              const period = parseInt(await decrypt(c.encrypted_period));
              return {
                id: c.id,
                name,
                period,
              };
            } catch (error) {
              return null;
            }
          })
        );

        const validChores = decryptedChores.filter((c) => c !== null) as Chore[];
        setChores(validChores);
      }
    } catch (error) {
      toast({
        title: "Error Loading Chores",
        description: "Could not load your chores. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addChore = async () => {
    // Validate input with zod schema
    const validation = choreSchema.safeParse({
      name: newChoreName,
      period: parseInt(newChorePeriod) || 0,
    });

    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "Invalid input";
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    if (!pseudonymId) {
      toast({
        title: "Session Error",
        description: "Your session data is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use validated and sanitized data
      const { name, period } = validation.data;
      const now = new Date().toISOString();
      const { encrypted: encryptedName } = await encrypt(name);
      const { encrypted: encryptedPeriod } = await encrypt(period.toString());
      const { encrypted: encryptedCreatedAt } = await encrypt(now);
      const { encrypted: encryptedUpdatedAt } = await encrypt(now);

      const { data, error } = await supabase
        .from("chores")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_name: encryptedName,
          encrypted_period: encryptedPeriod,
          encrypted_created_at: encryptedCreatedAt,
          encrypted_updated_at: encryptedUpdatedAt,
        })
        .select()
        .single();

      if (error) throw error;

      setChores([...chores, { id: data.id, name: newChoreName, period }]);
      setNewChoreName("");
      setNewChorePeriod("");
      toast({
        title: "Chore Added",
        description: `${newChoreName} added to optimization queue`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeChore = async (index: number) => {
    const chore = chores[index];
    if (chore.id) {
      try {
        await supabase.from("chores").delete().eq("id", chore.id);
      } catch (error) {
        // Silently handle deletion errors
      }
    }
    setChores(chores.filter((_, i) => i !== index));
  };

  const runOptimization = async () => {
    setIsOptimizing(true);
    setProgress(0);
    setResults(null);

    // Delete existing calendar events from chores
    try {
      const { data: existingEvents } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("pseudonym_id", pseudonymId);
      
      if (existingEvents && existingEvents.length > 0) {
        await supabase
          .from("calendar_events")
          .delete()
          .eq("pseudonym_id", pseudonymId);
      }
    } catch (error) {
      // Continue with optimization
    }

    const DAYS_TOTAL = 84;
    const SAMPLE_SIZE = 20000;

    const computeSchedule = (offsets: Record<string, number>) => {
      const schedule = Array(DAYS_TOTAL)
        .fill(0)
        .map(() => [] as string[]);
      chores.forEach(({ name, period }) => {
        const start = offsets[name];
        for (let day = start; day <= DAYS_TOTAL; day += period) {
          schedule[day - 1].push(name);
        }
      });
      return schedule;
    };

    const evaluateSchedule = (schedule: string[][]) => {
      const counts = schedule.map((d) => d.length);
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
      return { mean, variance };
    };

    const generateOffsets = () => {
      const offsets: Record<string, number> = {};
      chores.forEach(({ name, period }) => {
        offsets[name] = Math.floor(Math.random() * period) + 1;
      });
      return offsets;
    };

    const best: any[] = [];

    for (let trial = 0; trial < SAMPLE_SIZE; trial++) {
      const offsets = generateOffsets();
      const schedule = computeSchedule(offsets);
      const { mean, variance } = evaluateSchedule(schedule);

      best.push({ offsets, schedule, mean, variance });
      best.sort((a, b) => a.variance - b.variance);
      if (best.length > 5) best.pop();

      if (trial % 100 === 0) {
        setProgress((trial / SAMPLE_SIZE) * 100);
        await new Promise((r) => setTimeout(r, 1));
      }
    }

    setResults(best[0]);
    setProgress(100);

    // Generate calendar events
    try {
      const today = new Date();
      const calendarEvents = [];
      
      for (const chore of chores) {
        let currentDate = new Date(today);
        currentDate.setDate(currentDate.getDate() + (best[0].offsets[chore.name] || 0));
        
        while (currentDate <= new Date(today.getTime() + DAYS_TOTAL * 24 * 60 * 60 * 1000)) {
          const eventDate = currentDate.toISOString().split('T')[0];
          const eventTime = "09:00";
          
          const { encrypted: encTitle } = await encrypt(chore.name);
          const { encrypted: encDate } = await encrypt(eventDate);
          const { encrypted: encTime } = await encrypt(eventTime);
          const { encrypted: encDesc } = await encrypt(`Recurring chore (every ${chore.period} days)`);
          const { encrypted: encCreated } = await encrypt(new Date().toISOString());
          
          calendarEvents.push({
            pseudonym_id: pseudonymId,
            encrypted_title: encTitle,
            encrypted_date: encDate,
            encrypted_time: encTime,
            encrypted_description: encDesc,
            encrypted_created_at: encCreated,
          });
          
          currentDate = new Date(currentDate.getTime() + chore.period * 24 * 60 * 60 * 1000);
        }
      }
      
      if (calendarEvents.length > 0) {
        await supabase.from("calendar_events").insert(calendarEvents);
      }
    } catch (error) {
      // Error creating calendar events
    }

    setIsOptimizing(false);

    toast({
      title: "Optimization Complete",
      description: `Variance: ${best[0].variance.toFixed(3)} | Mean: ${best[0].mean.toFixed(2)}`,
    });
  };

  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">TASK CONFIGURATION</h2>

        <div className="space-y-4 mb-6">
          {chores.map((chore, index) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded">
              <span className="font-bold min-w-[100px]">{chore.name}</span>
              <span className="text-muted-foreground">Period: {chore.period} days</span>
              <Button variant="destructive" size="sm" onClick={() => removeChore(index)} className="ml-auto">
                REMOVE
              </Button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="choreName">Chore Name</Label>
            <Input
              id="choreName"
              value={newChoreName}
              onChange={(e) => setNewChoreName(e.target.value)}
              placeholder="e.g., DISHES"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="chorePeriod">Period (days)</Label>
            <Input
              id="chorePeriod"
              type="number"
              value={newChorePeriod}
              onChange={(e) => setNewChorePeriod(e.target.value)}
              placeholder="task frequency (days)"
              className="font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addChore} className="w-full font-bold">
              ADD TASK
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">OPTIMIZATION</h2>

        <Button
          onClick={runOptimization}
          disabled={isOptimizing || chores.length === 0}
          className="w-full font-bold mb-4"
          size="lg"
        >
          {isOptimizing ? "OPTIMIZING..." : "RUN SIMULATION"}
        </Button>

        {isOptimizing && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{progress.toFixed(0)}% complete</p>
          </div>
        )}

        {results && (
          <div className="mt-6 p-4 bg-muted/50 rounded space-y-2">
            <h3 className="font-bold">OPTIMAL SCHEDULE FOUND</h3>
            <p className="text-sm">Variance: {results.variance.toFixed(3)}</p>
            <p className="text-sm">Mean Tasks/Day: {results.mean.toFixed(2)}</p>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Optimal Start Offsets:</p>
              {Object.entries(results.offsets).map(([name, offset]: [string, any]) => (
                <p key={name} className="text-xs font-mono">
                  {name}: Day {offset}
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChoresSection;
