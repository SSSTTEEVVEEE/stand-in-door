import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

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

  const createChecklist = () => {
    if (!newChecklistName.trim()) {
      toast({
        title: "Invalid Input",
        description: "Checklist name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const newChecklist: Checklist = {
      id: Date.now().toString(),
      name: newChecklistName,
      reminders: [],
    };

    setChecklists([...checklists, newChecklist]);
    setNewChecklistName("");
    toast({
      title: "Checklist Created",
      description: `${newChecklist.name} is ready for deployment`,
    });
  };

  const addReminder = (checklistId: string) => {
    if (!newReminderText.trim()) {
      toast({
        title: "Invalid Input",
        description: "Reminder text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setChecklists(checklists.map(checklist => {
      if (checklist.id === checklistId) {
        return {
          ...checklist,
          reminders: [
            ...checklist.reminders,
            {
              id: Date.now().toString(),
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
  };

  const toggleReminder = (checklistId: string, reminderId: string) => {
    setChecklists(checklists.map(checklist => {
      if (checklist.id === checklistId) {
        return {
          ...checklist,
          reminders: checklist.reminders.map(reminder =>
            reminder.id === reminderId
              ? { ...reminder, completed: !reminder.completed }
              : reminder
          )
        };
      }
      return checklist;
    }));
  };

  const deleteChecklist = (checklistId: string) => {
    setChecklists(checklists.filter(c => c.id !== checklistId));
    toast({
      title: "Checklist Removed",
      description: "Operation deleted from system",
    });
  };

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
