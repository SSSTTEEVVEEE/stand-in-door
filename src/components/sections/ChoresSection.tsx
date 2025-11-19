import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Chore {
  id?: string;
  name: string;
  period: number;
}

const ChoresSection = () => {
  const { toast } = useToast();
  const [chores, setChores] = useState<Chore[]>([]);
  const [newChoreName, setNewChoreName] = useState("");
  const [newChorePeriod, setNewChorePeriod] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pseudonymId, setPseudonymId] = useState<string>("");

  useEffect(() => {
    loadChores();
  }, []);

  const loadChores = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("pseudonym_id").eq("user_id", user.id).single();

      if (profile) {
        setPseudonymId(profile.pseudonym_id);

        const { data: choresData } = await supabase.from("chores").select("*").eq("pseudonym_id", profile.pseudonym_id);

        if (choresData) {
          setChores(
            choresData.map((c) => ({
              id: c.id,
              name: c.encrypted_name,
              period: parseInt(c.encrypted_period),
            })),
          );
        }
      }
    } catch (error) {
      console.error("Error loading chores:", error);
    } finally {
      setLoading(false);
    }
  };

  const addChore = async () => {
    if (!newChoreName || !newChorePeriod) {
      toast({
        title: "Invalid Input",
        description: "Please enter both name and period",
        variant: "destructive",
      });
      return;
    }

    const period = parseInt(newChorePeriod);
    if (period <= 0) {
      toast({
        title: "Invalid Period",
        description: "Period must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("chores")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_name: newChoreName,
          encrypted_period: period.toString(),
          encrypted_created_at: now,
          encrypted_updated_at: now,
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
        console.error("Error deleting chore:", error);
      }
    }
    setChores(chores.filter((_, i) => i !== index));
  };

  const runOptimization = async () => {
    setIsOptimizing(true);
    setProgress(0);
    setResults(null);

    const DAYS_TOTAL = 228;
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
    setIsOptimizing(false);
    setProgress(100);

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
