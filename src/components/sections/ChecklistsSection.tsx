import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface Reminder {
  id: string;
  text: string;
  completed: boolean;
  isOneOff?: boolean;
}

interface Checklist {
  id: string;
  name: string;
  reminders: Reminder[];
  isComplete: boolean;
}

const ChecklistsSection = () => {
  const { toast } = useToast();
  const { encrypt, decrypt, pseudonymId, isReady } = useEncryption();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newReminderText, setNewReminderText] = useState("");
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isReady && pseudonymId) {
      console.log('[ChecklistsSection] Encryption ready, loading checklists...');
      loadChecklists();
    }
  }, [isReady, pseudonymId]);

  const loadChecklists = async () => {
    if (!pseudonymId) {
      console.log('[ChecklistsSection] No pseudonym ID, skipping load');
      setLoading(false);
      return;
    }

    console.log('[ChecklistsSection] Loading checklists...');
    try {
      const { data: checklistsData, error } = await supabase
        .from("checklists")
        .select("*, checklist_reminders(*)")
        .eq("pseudonym_id", pseudonymId);

      if (error) {
        console.error('[ChecklistsSection] Error fetching checklists:', error);
        throw error;
      }

      console.log(`[ChecklistsSection] Fetched ${checklistsData?.length || 0} checklists`);

      if (checklistsData) {
        const decryptedChecklists = await Promise.all(
          checklistsData.map(async (c) => {
            try {
              const name = await decrypt(c.encrypted_name);
              const reminders = await Promise.all(
                c.checklist_reminders.map(async (r: any) => {
                  try {
                    const text = await decrypt(r.encrypted_text);
                    const completedStr = await decrypt(r.encrypted_completed);
                    return {
                      id: r.id,
                      text,
                      completed: completedStr === "true",
                      isOneOff: false,
                    };
                  } catch (error) {
                    console.error('[ChecklistsSection] Failed to decrypt reminder:', r.id, error);
                    return null;
                  }
                })
              );
              const validReminders = reminders.filter((r) => r !== null) as Reminder[];
              return {
                id: c.id,
                name,
                reminders: validReminders,
                isComplete: validReminders.length > 0 && validReminders.every(r => r.completed),
              };
            } catch (error) {
              console.error('[ChecklistsSection] Failed to decrypt checklist:', c.id, error);
              return null;
            }
          })
        );

        const validChecklists = decryptedChecklists.filter((c) => c !== null) as Checklist[];
        console.log(`[ChecklistsSection] Successfully decrypted ${validChecklists.length} checklists`);
        setChecklists(validChecklists);
      }
    } catch (error) {
      console.error('[ChecklistsSection] Error loading checklists:', error);
      toast({
        title: "Error Loading Checklists",
        description: "Could not load your checklists. Please try refreshing the page.",
        variant: "destructive",
      });
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

    if (!pseudonymId) {
      console.error('[ChecklistsSection] No pseudonym ID available');
      toast({
        title: "Session Error",
        description: "Your session data is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { encrypted: encryptedName } = await encrypt(newChecklistName);
      const { encrypted: encryptedCreatedAt } = await encrypt(now);

      const { data, error } = await supabase
        .from("checklists")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_name: encryptedName,
          encrypted_created_at: encryptedCreatedAt,
        })
        .select()
        .single();

      if (error) throw error;

      const newChecklist: Checklist = {
        id: data.id,
        name: newChecklistName,
        reminders: [],
        isComplete: false,
      };

      setChecklists([...checklists, newChecklist]);
      setNewChecklistName("");
      toast({
        title: "Checklist Created",
        description: `${newChecklist.name} is ready`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addReminder = async (checklistId: string, isOneOff: boolean = false) => {
    if (!newReminderText.trim()) {
      toast({
        title: "Invalid Input",
        description: "Task text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { encrypted: encryptedText } = await encrypt(newReminderText);
      const { encrypted: encryptedCompleted } = await encrypt("false");
      const { encrypted: encryptedCreatedAt } = await encrypt(now);

      const { data, error } = await supabase
        .from("checklist_reminders")
        .insert({
          checklist_id: checklistId,
          encrypted_text: encryptedText,
          encrypted_completed: encryptedCompleted,
          encrypted_created_at: encryptedCreatedAt,
        })
        .select()
        .single();

      if (error) throw error;

      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          const newReminders = [
            ...checklist.reminders,
            {
              id: data.id,
              text: newReminderText,
              completed: false,
              isOneOff,
            }
          ];
          return {
            ...checklist,
            reminders: newReminders,
            isComplete: false,
          };
        }
        return checklist;
      }));

      setNewReminderText("");
      toast({
        title: "Task Added",
        description: isOneOff ? "One-off task added" : "Recurring task added",
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
      const { encrypted: encryptedCompleted } = await encrypt(newCompleted.toString());
      
      const { error } = await supabase
        .from("checklist_reminders")
        .update({ 
          encrypted_completed: encryptedCompleted
        })
        .eq("id", reminderId);

      if (error) throw error;

      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          const newReminders = checklist.reminders.map(reminder =>
            reminder.id === reminderId
              ? { ...reminder, completed: newCompleted }
              : reminder
          );
          return {
            ...checklist,
            reminders: newReminders,
            isComplete: newReminders.length > 0 && newReminders.every(r => r.completed),
          };
        }
        return checklist;
      }));
    } catch (error) {
      // Error updating reminder
    }
  };

  const completeAllAndReset = async (checklistId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    try {
      const { encrypted: encryptedCompleted } = await encrypt("false");
      
      // Reset all reminders to incomplete
      await Promise.all(
        checklist.reminders.map(reminder =>
          supabase
            .from("checklist_reminders")
            .update({ 
              encrypted_completed: encryptedCompleted
            })
            .eq("id", reminder.id)
        )
      );

      setChecklists(checklists.map(c => {
        if (c.id === checklistId) {
          return {
            ...c,
            reminders: c.reminders.map(r => ({ ...r, completed: false })),
            isComplete: false,
          };
        }
        return c;
      }));

      toast({
        title: "Checklist Reset",
        description: "All tasks marked incomplete",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEditingReminder = (reminderId: string, currentText: string) => {
    setEditingReminderId(reminderId);
    setEditText(currentText);
  };

  const cancelEditingReminder = () => {
    setEditingReminderId(null);
    setEditText("");
  };

  const saveEditedReminder = async (checklistId: string, reminderId: string) => {
    if (!editText.trim()) {
      toast({
        title: "Invalid Input",
        description: "Task text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const { encrypted: encryptedText } = await encrypt(editText);
      
      const { error } = await supabase
        .from("checklist_reminders")
        .update({ 
          encrypted_text: encryptedText
        })
        .eq("id", reminderId);

      if (error) throw error;

      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            reminders: checklist.reminders.map(reminder =>
              reminder.id === reminderId
                ? { ...reminder, text: editText }
                : reminder
            )
          };
        }
        return checklist;
      }));

      setEditingReminderId(null);
      setEditText("");
      toast({
        title: "Task Updated",
        description: "Changes saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
        description: "Operation deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleExpanded = (checklistId: string) => {
    setExpandedChecklists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checklistId)) {
        newSet.delete(checklistId);
      } else {
        newSet.add(checklistId);
      }
      return newSet;
    });
  };

  if (loading) {
    return <div className="text-center p-8">LOADING...</div>;
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
        {checklists.map((checklist) => {
          const isExpanded = expandedChecklists.has(checklist.id) || !checklist.isComplete;
          
          return (
            <Card key={checklist.id} className="p-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => checklist.isComplete && toggleExpanded(checklist.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <h3 className="text-xl font-bold">{checklist.name}</h3>
                  {checklist.isComplete && (
                    <button>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChecklist(checklist.id);
                  }}
                >
                  DELETE
                </Button>
              </div>

              {isExpanded && (
                <>
                  <div className="space-y-2 mb-4">
                    {checklist.reminders.map((reminder) => (
                      <div key={reminder.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <Checkbox
                          checked={reminder.completed}
                          onCheckedChange={() => toggleReminder(checklist.id, reminder.id)}
                        />
                        {editingReminderId === reminder.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => saveEditedReminder(checklist.id, reminder.id)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditingReminder}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className={`flex-1 ${reminder.completed ? "line-through text-muted-foreground" : ""}`}>
                              {reminder.text}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingReminder(reminder.id, reminder.text)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={selectedChecklistId === checklist.id ? newReminderText : ""}
                        onChange={(e) => {
                          setSelectedChecklistId(checklist.id);
                          setNewReminderText(e.target.value);
                        }}
                        placeholder="Add recurring task..."
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => addReminder(checklist.id, false)}
                        className="font-bold"
                      >
                        ADD
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={selectedChecklistId === checklist.id ? newReminderText : ""}
                        onChange={(e) => {
                          setSelectedChecklistId(checklist.id);
                          setNewReminderText(e.target.value);
                        }}
                        placeholder="Add one-off task..."
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addReminder(checklist.id, true)}
                        className="font-bold"
                      >
                        ONE-OFF
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      {checklist.reminders.filter(r => r.completed).length} / {checklist.reminders.length} complete
                    </p>
                    {checklist.isComplete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeAllAndReset(checklist.id)}
                      >
                        RESET ALL
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {checklists.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No checklists created. Create your first operation above.</p>
        </Card>
      )}
    </div>
  );
};

export default ChecklistsSection;
