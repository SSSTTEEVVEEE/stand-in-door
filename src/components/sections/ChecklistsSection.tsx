import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SecureInputWrapper as Input } from "@/components/SecureInputWrapper";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { checklistSchema, reminderSchema } from "@/lib/validation";
import { getNextRepeatDate } from "@/components/ui/repeat-days-selector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Reminder {
  id: string;
  text: string;
  completed: boolean;
  isOneOff?: boolean;
  sourceType?: string; // 'chore' | 'event'
  sourceId?: string;
  sourceDate?: string;
  color?: string;
  repeatDays?: string[];
}

interface Checklist {
  id: string;
  name: string;
  reminders: Reminder[];
  isComplete: boolean;
}

// Military-inspired pastel colors
const TASK_COLOR = "#7d8c5c"; // Olive green for chores/tasks

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
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editChecklistName, setEditChecklistName] = useState("");
  const [simpleReminders, setSimpleReminders] = useState<Reminder[]>([]);
  const [newSimpleReminderText, setNewSimpleReminderText] = useState("");
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);

  useEffect(() => {
    if (isReady && pseudonymId) {
      loadChecklists();
    }
  }, [isReady, pseudonymId]);

  // Auto-populate reminders on sign-in
  useEffect(() => {
    if (isReady && pseudonymId && !loading && !hasAutoPopulated) {
      autoPopulateReminders();
      setHasAutoPopulated(true);
    }
  }, [isReady, pseudonymId, loading, hasAutoPopulated]);

  const autoPopulateReminders = async () => {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Get existing simple reminders to avoid duplicates
      const existingTexts = new Set(simpleReminders.map(r => r.text));
      
      // Fetch chores
      const { data: choresData } = await supabase
        .from("chores")
        .select("*")
        .eq("pseudonym_id", pseudonymId);
      
      // Fetch calendar events
      const { data: eventsData } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("pseudonym_id", pseudonymId);
      
      const newReminders: { text: string; sourceType: string; sourceId: string; sourceDate: string; color?: string; repeatDays?: string[] }[] = [];
      
      // Process chores - add for each day from start of month to today
      if (choresData) {
        for (const chore of choresData) {
          try {
            const name = await decrypt(chore.encrypted_name);
            const period = parseInt(await decrypt(chore.encrypted_period));
            
            // Calculate which days this chore should appear
            let currentDate = new Date(startOfMonth);
            while (currentDate <= today) {
              const daysSinceStart = Math.floor((currentDate.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceStart % period === 0) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const reminderText = `[TASK] ${name} - ${dateStr}`;
                if (!existingTexts.has(reminderText)) {
                  newReminders.push({
                    text: reminderText,
                    sourceType: 'chore',
                    sourceId: chore.id,
                    sourceDate: dateStr,
                    color: TASK_COLOR,
                  });
                  existingTexts.add(reminderText);
                }
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } catch (e) {
            // Skip invalid chores
          }
        }
      }
      
      // Process calendar events
      if (eventsData) {
        for (const event of eventsData) {
          try {
            const title = await decrypt(event.encrypted_title);
            const eventDate = await decrypt(event.encrypted_date);
            const eventDateTime = new Date(eventDate);
            
            // Decrypt repeat days if present
            let repeatDays: string[] = [];
            if (event.encrypted_repeat_days) {
              try {
                const repeatDaysStr = await decrypt(event.encrypted_repeat_days);
                repeatDays = JSON.parse(repeatDaysStr);
              } catch (e) {
                // No repeat days
              }
            }
            
            // Decrypt color if present
            let color: string | undefined;
            if (event.encrypted_color) {
              try {
                color = await decrypt(event.encrypted_color);
              } catch (e) {
                // No color
              }
            }
            
            // Add events that fall within start of month to today
            if (eventDateTime >= startOfMonth && eventDateTime <= today) {
              const dateStr = eventDate;
              const reminderText = `[EVENT] ${title} - ${dateStr}`;
              if (!existingTexts.has(reminderText)) {
                newReminders.push({
                  text: reminderText,
                  sourceType: 'event',
                  sourceId: event.id,
                  sourceDate: dateStr,
                  color,
                  repeatDays,
                });
                existingTexts.add(reminderText);
              }
            }
            
            // For repeating events, add instances for each repeat day up to today
            if (repeatDays.length > 0) {
              const dayMap: Record<string, number> = {
                "Su": 0, "M": 1, "Tu": 2, "W": 3, "Th": 4, "F": 5, "Sa": 6
              };
              const repeatDayNumbers = repeatDays.map(d => dayMap[d]).filter(n => n !== undefined);
              
              let checkDate = new Date(startOfMonth);
              while (checkDate <= today) {
                if (repeatDayNumbers.includes(checkDate.getDay())) {
                  const dateStr = checkDate.toISOString().split('T')[0];
                  const reminderText = `[EVENT] ${title} - ${dateStr}`;
                  if (!existingTexts.has(reminderText)) {
                    newReminders.push({
                      text: reminderText,
                      sourceType: 'event',
                      sourceId: event.id,
                      sourceDate: dateStr,
                      color,
                      repeatDays,
                    });
                    existingTexts.add(reminderText);
                  }
                }
                checkDate.setDate(checkDate.getDate() + 1);
              }
            }
          } catch (e) {
            // Skip invalid events
          }
        }
      }
      
      // Add new reminders to database
      if (newReminders.length > 0) {
        await addAutoPopulatedReminders(newReminders);
      }
    } catch (error) {
      // Silent fail for auto-population
    }
  };

  const addAutoPopulatedReminders = async (reminders: { text: string; sourceType: string; sourceId: string; sourceDate: string; color?: string; repeatDays?: string[] }[]) => {
    try {
      const now = new Date().toISOString();
      const { encrypted: encryptedName } = await encrypt("_simple_reminders");
      const { encrypted: encryptedCreatedAt } = await encrypt(now);
      
      // Get or create simple reminders checklist
      let simpleChecklistId = checklists.find(c => c.name === "_simple_reminders")?.id;
      
      if (!simpleChecklistId) {
        const { data: checklistData, error: checklistError } = await supabase
          .from("checklists")
          .insert({
            pseudonym_id: pseudonymId,
            encrypted_name: encryptedName,
            encrypted_created_at: encryptedCreatedAt,
          })
          .select()
          .single();
        
        if (checklistError) return;
        simpleChecklistId = checklistData.id;
      }
      
      const newReminderItems: Reminder[] = [];
      
      for (const reminder of reminders) {
        const { encrypted: encryptedText } = await encrypt(reminder.text);
        const { encrypted: encryptedCompleted } = await encrypt("false");
        
        const { data, error } = await supabase
          .from("checklist_reminders")
          .insert({
            checklist_id: simpleChecklistId,
            encrypted_text: encryptedText,
            encrypted_completed: encryptedCompleted,
            encrypted_created_at: encryptedCreatedAt,
            source_type: reminder.sourceType,
            source_id: reminder.sourceId,
            source_date: reminder.sourceDate,
          })
          .select()
          .single();
        
        if (!error && data) {
          newReminderItems.push({
            id: data.id,
            text: reminder.text,
            completed: false,
            isOneOff: true,
            sourceType: reminder.sourceType,
            sourceId: reminder.sourceId,
            sourceDate: reminder.sourceDate,
            color: reminder.color,
            repeatDays: reminder.repeatDays,
          });
        }
      }
      
      if (newReminderItems.length > 0) {
        setSimpleReminders(prev => [...prev, ...newReminderItems]);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const loadChecklists = async () => {
    if (!pseudonymId) {
      setLoading(false);
      return;
    }

    try {
      const { data: checklistsData, error } = await supabase
        .from("checklists")
        .select("*, checklist_reminders(*)")
        .eq("pseudonym_id", pseudonymId);

      if (error) {
        throw error;
      }

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
              return null;
            }
          })
        );

        const validChecklists = decryptedChecklists.filter((c) => c !== null) as Checklist[];
        
        // Separate simple reminders from regular checklists
        const simpleChecklistData = validChecklists.find(c => c.name === "_simple_reminders");
        if (simpleChecklistData) {
          setSimpleReminders(simpleChecklistData.reminders.map(r => ({ ...r, isOneOff: true })));
        }
        
        setChecklists(validChecklists);
      }
    } catch (error) {
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
    // Validate input with zod schema
    const validation = checklistSchema.safeParse({
      name: newChecklistName,
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
      const now = new Date().toISOString();
      // Use validated and sanitized data
      const { name } = validation.data;
      const { encrypted: encryptedName } = await encrypt(name);
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
        name: name,
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
    // Validate input with zod schema
    const validation = reminderSchema.safeParse({
      text: newReminderText,
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

    try {
      const now = new Date().toISOString();
      // Use validated and sanitized data
      const { text } = validation.data;
      const { encrypted: encryptedText } = await encrypt(text);
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

  const completeAllAndReset = async (checklistId: string, silent: boolean = false) => {
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

      if (!silent) {
        toast({
          title: "Checklist Reset",
          description: "All tasks marked incomplete",
        });
      }
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleAccordionChange = (value: string[]) => {
    // Find newly opened accordions
    const newlyOpened = value.filter(id => !openAccordions.includes(id));
    
    // Reset tasks for newly opened checklists
    newlyOpened.forEach(checklistId => {
      const checklist = checklists.find(c => c.id === checklistId);
      if (checklist && checklist.reminders.some(r => r.completed)) {
        completeAllAndReset(checklistId, true);
      }
    });
    
    setOpenAccordions(value);
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

  const startEditingChecklist = (checklistId: string, currentName: string) => {
    setEditingChecklistId(checklistId);
    setEditChecklistName(currentName);
  };

  const cancelEditingChecklist = () => {
    setEditingChecklistId(null);
    setEditChecklistName("");
  };

  const saveEditedChecklist = async (checklistId: string) => {
    const validation = checklistSchema.safeParse({ name: editChecklistName });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.issues[0]?.message || "Invalid input",
        variant: "destructive",
      });
      return;
    }

    try {
      const { encrypted: encryptedName } = await encrypt(validation.data.name);
      const { error } = await supabase
        .from("checklists")
        .update({ encrypted_name: encryptedName })
        .eq("id", checklistId);

      if (error) throw error;

      setChecklists(checklists.map(c =>
        c.id === checklistId ? { ...c, name: validation.data.name } : c
      ));
      setEditingChecklistId(null);
      setEditChecklistName("");
      toast({ title: "Checklist Updated", description: "Changes saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const addSimpleReminder = async () => {
    const validation = reminderSchema.safeParse({ text: newSimpleReminderText });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.issues[0]?.message || "Invalid input",
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
      const now = new Date().toISOString();
      const { encrypted: encryptedText } = await encrypt(validation.data.text);
      const { encrypted: encryptedCompleted } = await encrypt("false");
      const { encrypted: encryptedCreatedAt } = await encrypt(now);
      const { encrypted: encryptedName } = await encrypt("_simple_reminders");

      // Create a special checklist for simple reminders if it doesn't exist
      let simpleChecklistId = checklists.find(c => c.name === "_simple_reminders")?.id;
      
      if (!simpleChecklistId) {
        const { data: checklistData, error: checklistError } = await supabase
          .from("checklists")
          .insert({
            pseudonym_id: pseudonymId,
            encrypted_name: encryptedName,
            encrypted_created_at: encryptedCreatedAt,
          })
          .select()
          .single();

        if (checklistError) throw checklistError;
        simpleChecklistId = checklistData.id;
      }

      const { data, error } = await supabase
        .from("checklist_reminders")
        .insert({
          checklist_id: simpleChecklistId,
          encrypted_text: encryptedText,
          encrypted_completed: encryptedCompleted,
          encrypted_created_at: encryptedCreatedAt,
        })
        .select()
        .single();

      if (error) throw error;

      setSimpleReminders([...simpleReminders, {
        id: data.id,
        text: validation.data.text,
        completed: false,
        isOneOff: true,
      }]);
      setNewSimpleReminderText("");
      toast({ title: "Reminder Added", description: "Simple reminder created" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleSimpleReminder = async (reminderId: string) => {
    const reminder = simpleReminders.find(r => r.id === reminderId);
    if (!reminder) return;

    // If completing the reminder, handle repeating events
    if (!reminder.completed) {
      try {
        // Check if it's a repeating event
        if (reminder.repeatDays && reminder.repeatDays.length > 0 && reminder.sourceType === 'event') {
          // Reschedule to next repeat day
          const nextDate = getNextRepeatDate(reminder.repeatDays, new Date());
          if (nextDate) {
            const dateStr = nextDate.toISOString().split('T')[0];
            const baseText = reminder.text.replace(/ - \d{4}-\d{2}-\d{2}$/, '');
            const newText = `${baseText} - ${dateStr}`;
            
            // Update the reminder with new date
            const { encrypted: encryptedText } = await encrypt(newText);
            await supabase
              .from("checklist_reminders")
              .update({ 
                encrypted_text: encryptedText,
                source_date: dateStr 
              })
              .eq("id", reminderId);
            
            setSimpleReminders(simpleReminders.map(r => 
              r.id === reminderId ? { ...r, text: newText, sourceDate: dateStr } : r
            ));
            toast({ title: "Event Rescheduled", description: `Moved to ${dateStr}` });
            return;
          }
        }
        
        // Delete non-repeating reminders
        const { error } = await supabase
          .from("checklist_reminders")
          .delete()
          .eq("id", reminderId);

        if (error) throw error;

        setSimpleReminders(simpleReminders.filter(r => r.id !== reminderId));
        toast({ title: "Reminder Completed", description: "Reminder removed from list" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const deleteSimpleReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from("checklist_reminders")
        .delete()
        .eq("id", reminderId);

      if (error) throw error;

      setSimpleReminders(simpleReminders.filter(r => r.id !== reminderId));
      toast({ title: "Reminder Deleted", description: "Simple reminder removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="text-center p-8">LOADING...</div>;
  }

  return (
    <div className="space-y-6 pb-32">
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
            <Button onClick={createChecklist} className="font-bold">CREATE</Button>
          </div>
        </div>
      </Card>

      {checklists.filter(c => c.name !== "_simple_reminders").length > 0 && (
        <Accordion type="multiple" className="space-y-4" value={openAccordions} onValueChange={handleAccordionChange}>
          {checklists.filter(c => c.name !== "_simple_reminders").map((checklist) => (
            <AccordionItem key={checklist.id} value={checklist.id} className="border rounded-lg">
              <Card className="border-0">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    {editingChecklistId === checklist.id ? (
                      <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editChecklistName}
                          onChange={(e) => setEditChecklistName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => saveEditedChecklist(checklist.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditingChecklist}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold">{checklist.name}</h3>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditingChecklist(checklist.id, checklist.name)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteChecklist(checklist.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
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
                            <Button size="sm" variant="ghost" onClick={cancelEditingReminder}>
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

                  <div className="flex gap-2 mb-2">
                    <Input
                      value={selectedChecklistId === checklist.id ? newReminderText : ""}
                      onChange={(e) => {
                        setSelectedChecklistId(checklist.id);
                        setNewReminderText(e.target.value);
                      }}
                      placeholder="Add task..."
                      className="font-mono text-sm"
                    />
                    <Button size="sm" onClick={() => addReminder(checklist.id, false)} className="font-bold">
                      ADD
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      {checklist.reminders.filter(r => r.completed).length} / {checklist.reminders.length} complete
                    </p>
                    {checklist.isComplete && (
                      <Button size="sm" variant="outline" onClick={() => completeAllAndReset(checklist.id)}>
                        RESET ALL
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {checklists.filter(c => c.name !== "_simple_reminders").length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No checklists created. Create your first operation above.</p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">SIMPLE REMINDERS</h2>
        <div className="flex gap-2 mb-4">
          <Input
            value={newSimpleReminderText}
            onChange={(e) => setNewSimpleReminderText(e.target.value)}
            placeholder="Add a simple reminder..."
            className="font-mono"
          />
          <Button onClick={addSimpleReminder} className="font-bold">ADD</Button>
        </div>

        {simpleReminders.length > 0 ? (
          <div className="space-y-2">
            {simpleReminders.map((reminder) => (
              <div 
                key={reminder.id} 
                className="flex items-center gap-3 p-2 rounded transition-opacity"
                style={{
                  backgroundColor: reminder.color ? `${reminder.color}20` : 'hsl(var(--muted) / 0.5)',
                  borderLeft: reminder.color ? `3px solid ${reminder.color}` : undefined,
                }}
              >
                <Checkbox
                  checked={reminder.completed}
                  onCheckedChange={() => toggleSimpleReminder(reminder.id)}
                />
                <span className={`flex-1 ${reminder.completed ? "line-through text-muted-foreground" : ""}`}>
                  {reminder.text}
                  {reminder.repeatDays && reminder.repeatDays.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">(repeats)</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteSimpleReminder(reminder.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No simple reminders yet. Add one above.
          </p>
        )}
      </Card>
    </div>
  );
};

export default ChecklistsSection;
