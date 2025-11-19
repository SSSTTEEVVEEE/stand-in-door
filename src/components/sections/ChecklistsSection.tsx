import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Reminder {
  id: string;
  text: string;
  completed: boolean;
}

interface Checklist {
  id: string;
  name: string;
  reminders: Reminder[];
}

const ChecklistsSection = () => {
  const { toast } = useToast();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newReminderText, setNewReminderText] = useState("");
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pseudonymId, setPseudonymId] = useState<string>("");

  useEffect(() => {
    loadChecklists();
  }, []);

  const loadChecklists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("pseudonym_id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setPseudonymId(profile.pseudonym_id);

        const { data: checklistsData } = await supabase
          .from("checklists")
          .select("*, checklist_reminders(*)")
          .eq("pseudonym_id", profile.pseudonym_id);

        if (checklistsData) {
          setChecklists(checklistsData.map(c => ({
            id: c.id,
            name: c.encrypted_name,
            reminders: c.checklist_reminders.map((r: any) => ({
              id: r.id,
              text: r.encrypted_text,
              completed: r.encrypted_completed === "true"
            }))
          })));
        }
      }
    } catch (error) {
      console.error("Error loading checklists:", error);
    } finally {
      setLoading(false);
    }
  };

  const createChecklist = async () => {
    if (!newChecklistName.trim()) {
      toast({
        title: "Invalid Input",
        description: "Checklist name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("checklists")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_name: newChecklistName,
          encrypted_created_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const newChecklist: Checklist = {
        id: data.id,
        name: newChecklistName,
        reminders: [],
      };

      setChecklists([...checklists, newChecklist]);
      setNewChecklistName("");
      toast({
        title: "Checklist Created",
        description: `${newChecklist.name} is ready for deployment`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addReminder = async (checklistId: string) => {
    if (!newReminderText.trim()) {
      toast({
        title: "Invalid Input",
        description: "Reminder text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("checklist_reminders")
        .insert({
          checklist_id: checklistId,
          encrypted_text: newReminderText,
          encrypted_completed: "false",
          encrypted_created_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            reminders: [
              ...checklist.reminders,
              {
                id: data.id,
                text: newReminderText,
                completed: false,
              }
            ]
          };
        }
        return checklist;
      }));

      setNewReminderText("");
      toast({
        title: "Reminder Added",
        description: "Task added to checklist",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleReminder = async (checklistId: string, reminderId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    const reminder = checklist?.reminders.find(r => r.id === reminderId);
    
    if (!reminder) return;

    try {
      const newCompleted = !reminder.completed;
      const { error } = await supabase
        .from("checklist_reminders")
        .update({ encrypted_completed: newCompleted.toString() })
        .eq("id", reminderId);

      if (error) throw error;

      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            reminders: checklist.reminders.map(reminder =>
              reminder.id === reminderId
                ? { ...reminder, completed: newCompleted }
                : reminder
            )
          };
        }
        return checklist;
      }));
    } catch (error) {
      console.error("Error updating reminder:", error);
    }
  };

  const deleteChecklist = async (checklistId: string) => {
    try {
      const { error } = await supabase
        .from("checklists")
        .delete()
        .eq("id", checklistId);

      if (error) throw error;

      setChecklists(checklists.filter(c => c.id !== checklistId));
      toast({
        title: "Checklist Removed",
        description: "Operation deleted from system",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">CREATE CHECKLIST</h2>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="checklistName">Operation Name</Label>
            <Input
              id="checklistName"
              value={newChecklistName}
              onChange={(e) => setNewChecklistName(e.target.value)}
              placeholder="e.g., MORNING ROUTINE"
              className="font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={createChecklist} className="font-bold">
              CREATE
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {checklists.map((checklist) => (
          <Card key={checklist.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{checklist.name}</h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteChecklist(checklist.id)}
              >
                DELETE
              </Button>
            </div>

            <div className="space-y-2 mb-4">
              {checklist.reminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                  <Checkbox
                    checked={reminder.completed}
                    onCheckedChange={() => toggleReminder(checklist.id, reminder.id)}
                  />
                  <span className={reminder.completed ? "line-through text-muted-foreground" : ""}>
                    {reminder.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={selectedChecklistId === checklist.id ? newReminderText : ""}
                onChange={(e) => {
                  setSelectedChecklistId(checklist.id);
                  setNewReminderText(e.target.value);
                }}
                placeholder="Add reminder..."
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                onClick={() => addReminder(checklist.id)}
                className="font-bold"
              >
                ADD
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {checklist.reminders.filter(r => r.completed).length} / {checklist.reminders.length} complete
            </p>
          </Card>
        ))}
      </div>

      {checklists.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No checklists deployed. Create your first operation above.</p>
        </Card>
      )}
    </div>
  );
};

export default ChecklistsSection;
