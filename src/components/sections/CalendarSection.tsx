import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SecureInputWrapper as Input } from "@/components/SecureInputWrapper";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calendarEventSchema } from "@/lib/validation";
import { ColorPicker } from "@/components/ui/color-picker";
import { RepeatDaysSelector } from "@/components/ui/repeat-days-selector";
import { stripWatermarkChars } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  repeatDays?: string[];
  color?: string;
  description?: string;
}

type ViewType = "day" | "week" | "month" | "year";

const CalendarSection = () => {
  const { toast } = useToast();
  const { encrypt, decrypt, pseudonymId, isReady, keyReady } = useEncryption();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");

  const openEventDialog = (prefilledDate?: string, prefilledTime?: string) => {
    setNewEvent({
      title: "",
      date: prefilledDate || "",
      time: prefilledTime || "09:00",
      endTime: "",
      repeatDays: [],
      color: "#7d8c5c",
      description: "",
    });
    setIsDialogOpen(true);
  };
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "09:00",
    endTime: "",
    repeatDays: [] as string[],
    color: "#7d8c5c",
    description: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (isReady && keyReady && pseudonymId) {
      loadEvents();
      cleanupOldEvents();
    } else if (isReady && !keyReady) {
      setLoading(false);
    }
  }, [isReady, keyReady, pseudonymId]);
  
  // Cleanup events before December if today is Dec 3rd or later
  const cleanupOldEvents = async () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed, so December is 11
    const currentDate = today.getDate();
    
    // Only run if December 3rd or later
    if (currentMonth === 11 && currentDate >= 3) {
      const decemberFirst = new Date(today.getFullYear(), 11, 1);
      
      try {
        const eventsToDelete = events.filter(e => {
          const eventDate = new Date(e.date);
          return eventDate < decemberFirst;
        });

        if (eventsToDelete.length > 0) {
          await Promise.all(
            eventsToDelete.map(e => 
              supabase.from("calendar_events").delete().eq("id", e.id)
            )
          );
          
          setEvents(events.filter(e => !eventsToDelete.find(d => d.id === e.id)));
        }
      } catch (error) {
        // Silently handle cleanup errors
      }
    }
  };

  // Scroll to today in day view
  useEffect(() => {
    if (viewType === "day") {
      setTimeout(() => {
        const todayCard = document.getElementById("today-card");
        if (todayCard) {
          todayCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [viewType]);

  const loadEvents = async () => {
    if (!pseudonymId) {
      setLoading(false);
      return;
    }

    try {
      const { data: eventsData, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("pseudonym_id", pseudonymId);

      if (error) {
        throw error;
      }

      if (eventsData) {
        const decryptedEvents = await Promise.all(
          eventsData.map(async (e: any) => {
            try {
              // Hash is no longer verified - AES-GCM provides authenticated encryption
              const title = await decrypt(e.encrypted_title);
              const date = await decrypt(e.encrypted_date);
              const time = await decrypt(e.encrypted_time);
              const description = e.encrypted_description 
                ? await decrypt(e.encrypted_description)
                : undefined;
              const endTime = e.encrypted_end_time
                ? await decrypt(e.encrypted_end_time)
                : undefined;
              const repeatDaysStr = e.encrypted_repeat_days
                ? await decrypt(e.encrypted_repeat_days)
                : undefined;
              const repeatDays = repeatDaysStr ? JSON.parse(repeatDaysStr) : undefined;
              const color = e.encrypted_color
                ? await decrypt(e.encrypted_color)
                : undefined;

              return {
                id: e.id,
                title,
                date,
                time,
                endTime,
                repeatDays,
                color,
                description,
              };
            } catch (error) {
              return null;
            }
          })
        );

        const validEvents = decryptedEvents.filter((e) => e !== null) as CalendarEvent[];
        
        validEvents.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateA.getTime() - dateB.getTime();
        });

        setEvents(validEvents);
      }
    } catch (error) {
      toast({
        title: "Error Loading Events",
        description: "Could not load your events. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async () => {
    // Validate input with zod schema
    const validation = calendarEventSchema.safeParse({
      title: newEvent.title,
      description: newEvent.description || '',
      date: newEvent.date,
      time: newEvent.time || '09:00',
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
      const { title, description, date, time } = validation.data;
      const { encrypted: encTitle } = await encrypt(newEvent.title);
      const { encrypted: encDate } = await encrypt(newEvent.date);
      const { encrypted: encTime } = await encrypt(newEvent.time);
      const { encrypted: encDesc } = await encrypt(newEvent.description || "");
      const { encrypted: encCreated } = await encrypt(now);
      const { encrypted: encEndTime } = newEvent.endTime 
        ? await encrypt(newEvent.endTime) 
        : { encrypted: null };
      const { encrypted: encRepeatDays } = newEvent.repeatDays.length > 0 
        ? await encrypt(JSON.stringify(newEvent.repeatDays)) 
        : { encrypted: null };
      const { encrypted: encColor } = newEvent.color 
        ? await encrypt(newEvent.color) 
        : { encrypted: null };

      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_title: encTitle,
          encrypted_date: encDate,
          encrypted_time: encTime,
          encrypted_description: encDesc,
          encrypted_created_at: encCreated,
          encrypted_end_time: encEndTime,
          encrypted_repeat_days: encRepeatDays,
          encrypted_color: encColor,
        })
        .select()
        .single();

      if (error) throw error;

      setEvents([
        ...events,
        {
          id: data.id,
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.time,
          endTime: newEvent.endTime || undefined,
          repeatDays: newEvent.repeatDays.length > 0 ? newEvent.repeatDays : undefined,
          color: newEvent.color || undefined,
          description: newEvent.description,
        },
      ]);

      setNewEvent({ title: "", date: "", time: "09:00", endTime: "", repeatDays: [], color: "#7d8c5c", description: "" });
      setIsDialogOpen(false);
      toast({
        title: "Event Scheduled",
        description: "Event added to calendar",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateEvent = async () => {
    // Validate input with zod schema
    const validation = calendarEventSchema.safeParse({
      title: newEvent.title,
      description: newEvent.description || '',
      date: newEvent.date,
      time: newEvent.time || '09:00',
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

    if (!editingEvent) {
      toast({
        title: "Error",
        description: "No event selected for editing",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      // Use validated and sanitized data
      const { title, description, date, time } = validation.data;
      const { encrypted: encTitle } = await encrypt(title);
      const { encrypted: encDate } = await encrypt(date);
      const { encrypted: encTime } = await encrypt(time);
      const { encrypted: encDesc } = description ? await encrypt(description) : { encrypted: "" };
      const { encrypted: encCreated } = await encrypt(now);
      const { encrypted: encEndTime } = newEvent.endTime 
        ? await encrypt(newEvent.endTime) 
        : { encrypted: null };
      const { encrypted: encRepeatDays } = newEvent.repeatDays.length > 0 
        ? await encrypt(JSON.stringify(newEvent.repeatDays)) 
        : { encrypted: null };
      const { encrypted: encColor } = newEvent.color 
        ? await encrypt(newEvent.color) 
        : { encrypted: null };

      const { error } = await supabase
        .from("calendar_events")
        .update({
          encrypted_title: encTitle,
          encrypted_date: encDate,
          encrypted_time: encTime,
          encrypted_description: encDesc,
          encrypted_created_at: encCreated,
          encrypted_end_time: encEndTime,
          encrypted_repeat_days: encRepeatDays,
          encrypted_color: encColor,
        })
        .eq("id", editingEvent.id);

      if (error) throw error;

      await loadEvents();
      setIsEditDialogOpen(false);
      setEditingEvent(null);
      setNewEvent({ title: "", date: "", time: "09:00", endTime: "", repeatDays: [], color: "#7d8c5c", description: "" });
      
      toast({
        title: "Event Updated",
        description: "Event updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      setEvents(events.filter((e) => e.id !== eventId));
      setIsEditDialogOpen(false);
      setEditingEvent(null);
      toast({
        title: "Event Deleted",
        description: "Event removed from calendar",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      date: event.date,
      time: event.time,
      endTime: event.endTime || "",
      repeatDays: event.repeatDays || [],
      color: event.color || "#7d8c5c",
      description: event.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    switch (viewType) {
      case "day":
        newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1));
        break;
      case "week":
        newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7));
        break;
      case "month":
        newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1));
        break;
      case "year":
        newDate.setFullYear(currentDate.getFullYear() + (direction === "next" ? 1 : -1));
        break;
    }
    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    const options: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
    switch (viewType) {
      case "day":
        return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      case "week":
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      case "month":
        return currentDate.toLocaleDateString("en-US", options);
      case "year":
        return currentDate.getFullYear().toString();
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth();
    const weekDays = ["M", "T", "W", "Th", "F", "Sa", "Su"];
    const allDays = [];

    // Calculate days from previous month to show
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    // Add days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      allDays.push({
        day,
        date: new Date(prevYear, prevMonth, day),
        isCurrentMonth: false,
      });
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      allDays.push({
        day,
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Add days from next month to fill the grid (6 rows * 7 days = 42 cells)
    const remainingCells = 42 - allDays.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      allDays.push({
        day,
        date: new Date(nextYear, nextMonth, day),
        isCurrentMonth: false,
      });
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div key={day} className="text-center font-bold text-sm py-2 border-r border-border last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        {/* Calendar grid - 6 rows */}
        <div className="flex-1 grid grid-rows-6">
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {allDays.slice(rowIdx * 7, (rowIdx + 1) * 7).map((dayObj, colIdx) => {
                const dayEvents = getEventsForDate(dayObj.date);
                const isToday = dayObj.date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`border-r border-border last:border-r-0 p-2 cursor-pointer ${
                      dayObj.isCurrentMonth ? "bg-background" : "bg-muted/20"
                    } ${isToday ? "bg-primary/10" : ""} hover:bg-muted/50 transition-colors`}
                    onClick={() => openEventDialog(dayObj.date.toISOString().split('T')[0])}
                  >
                    <div className={`text-sm font-bold mb-1 ${isToday ? "text-primary" : ""} ${!dayObj.isCurrentMonth ? "text-muted-foreground" : ""}`}>
                      {dayObj.day}
                    </div>
                    <div className="space-y-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs px-1 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80"
                          style={{ 
                            backgroundColor: event.color ? `${event.color}40` : 'hsl(var(--primary) / 0.2)',
                            borderLeft: event.color ? `3px solid ${event.color}` : '3px solid hsl(var(--primary))'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(event);
                          }}
                          title={`${event.time}${event.endTime ? `-${event.endTime}` : ''} - ${stripWatermarkChars(event.title)}${event.repeatDays?.length ? ' (repeats)' : ''}`}
                        >
                          {event.time} {stripWatermarkChars(event.title)}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{dayEvents.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      // Create a new date object for each day to avoid mutation issues
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      weekDays.push(date);
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex h-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col flex-1">
          <div className="flex h-16 border-b border-border">
            <div className="w-14 border-r border-border" />
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((date) => {
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={date.toISOString()} className={`text-center border-r border-border last:border-r-0 py-2 ${isToday ? "bg-primary/10" : ""}`}>
                    <div className="text-xs text-muted-foreground uppercase">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable time and events grid */}
          <ScrollArea className="flex-1">
            <div className="flex">
              {/* Time column */}
              <div className="w-14 border-r border-border">
                {hours.map((hour) => (
                  <div key={hour} className="h-16 border-b border-border/50 px-1 py-1 text-xs text-muted-foreground">
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>

              {/* Events grid */}
              <div className="flex-1 grid grid-cols-7">
                {weekDays.map((date) => {
                  const dayEvents = getEventsForDate(date);
                  const dateStr = date.toISOString().split('T')[0];
                  
                  return (
                    <div key={date.toISOString()} className="border-r border-border last:border-r-0">
                      {hours.map((hour) => {
                        const hourEvents = dayEvents.filter((e) => parseInt(e.time.split(":")[0]) === hour);
                        const timeStr = `${hour.toString().padStart(2, "0")}:00`;
                        
                        return (
                          <div 
                            key={hour} 
                            className="h-16 border-b border-border/50 p-1 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => hourEvents.length === 0 && openEventDialog(dateStr, timeStr)}
                          >
                            {hourEvents.map((event) => (
                              <div
                                key={event.id}
                                className="text-xs p-1 bg-primary/20 rounded cursor-pointer hover:bg-primary/30 truncate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(event);
                                }}
                                title={`${event.time} - ${stripWatermarkChars(event.title)}`}
                              >
                                <div className="font-bold">{event.time}</div>
                                <div className="truncate">{stripWatermarkChars(event.title)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const { daysInMonth, year, month } = getDaysInMonth();
    const daysInCurrentMonth = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      daysInCurrentMonth.push(date);
    }

    const todayDate = new Date();
    const todayIndex = daysInCurrentMonth.findIndex(
      date => date.toDateString() === todayDate.toDateString()
    );

    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          {daysInCurrentMonth.map((date) => {
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            const dayNumber = date.getDate();

            return (
              <Card 
                key={date.toISOString()} 
                id={isToday ? "today-card" : undefined}
                className={`p-4 ${isToday ? "border-primary border-2" : ""}`}
              >
                <div className="flex gap-4 cursor-pointer" onClick={() => openEventDialog(date.toISOString().split('T')[0])}>
                  <div className="flex flex-col items-center justify-center min-w-[60px] border-r pr-4">
                    <div className="text-sm text-muted-foreground uppercase">{dayName}</div>
                    <div className={`text-3xl font-bold ${isToday ? "text-primary" : ""}`}>{dayNumber}</div>
                  </div>
                  <div className="flex-1">
                    {dayEvents.length > 0 ? (
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-3 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(event);
                            }}
                          >
                            <div className="font-bold">{event.time} - {stripWatermarkChars(event.title)}</div>
                            {event.description && (
                              <div className="text-sm text-muted-foreground mt-1">{stripWatermarkChars(event.description)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No events scheduled. Click + to add an event for this day.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const year = currentDate.getFullYear();

    return (
      <div className="grid grid-cols-4 gap-4">
        {months.map((month) => {
          const date = new Date(year, month, 1);
          const monthEvents = events.filter((e) => {
            const eventDate = new Date(e.date);
            return eventDate.getFullYear() === year && eventDate.getMonth() === month;
          });

          return (
            <Card 
              key={month} 
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setCurrentDate(date);
                setViewType("month");
              }}
            >
              <div className="text-center font-bold mb-2">
                {date.toLocaleDateString("en-US", { month: "short" })}
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">LOADING...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* View options with navigation */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <h2 className="text-xl font-bold text-center flex-1">{getDateRangeText()}</h2>

        <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule New Event</DialogTitle>
            <DialogDescription>
              Add a new event to your calendar with a title, date, and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="eventTitle">Title</Label>
              <Input
                id="eventTitle"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eventDate">Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="eventTime">Start Time</Label>
                <Input
                  id="eventTime"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="eventEndTime">End Time (Optional)</Label>
              <Input
                id="eventEndTime"
                type="time"
                value={newEvent.endTime}
                onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="mb-2 block">Repeats?</Label>
              <RepeatDaysSelector
                selectedDays={newEvent.repeatDays}
                onChange={(days) => setNewEvent({ ...newEvent, repeatDays: days })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Color</Label>
              <ColorPicker
                color={newEvent.color}
                onChange={(color) => setNewEvent({ ...newEvent, color })}
              />
            </div>
            <div>
              <Label htmlFor="eventDescription">Description (Optional)</Label>
              <Textarea
                id="eventDescription"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Event details..."
                className="font-mono"
              />
            </div>
            <Button onClick={addEvent} className="w-full font-bold">
              SCHEDULE EVENT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar view */}
      <div className="flex-1 overflow-hidden">
        {viewType === "month" && renderMonthView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "day" && renderDayView()}
        {viewType === "year" && renderYearView()}
      </div>

      {/* Footer with view selector and today button */}
      <div className="flex items-center justify-center gap-2 py-1 px-2 border-t bg-background">
        <Button
          variant={viewType === "day" ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setViewType("day")}
        >
          Day
        </Button>
        <Button
          variant={viewType === "week" ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setViewType("week")}
        >
          Week
        </Button>
        <Button
          variant={viewType === "month" ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setViewType("month")}
        >
          Month
        </Button>
        <Button
          variant={viewType === "year" ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setViewType("year")}
        >
          Year
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setCurrentDate(new Date())}
        >
          Today
        </Button>
      </div>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update or delete this event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-time">Start Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-endTime">End Time (Optional)</Label>
              <Input
                id="edit-endTime"
                type="time"
                value={newEvent.endTime}
                onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="mb-2 block">Repeats?</Label>
              <RepeatDaysSelector
                selectedDays={newEvent.repeatDays}
                onChange={(days) => setNewEvent({ ...newEvent, repeatDays: days })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Color</Label>
              <ColorPicker
                color={newEvent.color}
                onChange={(color) => setNewEvent({ ...newEvent, color })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Event details..."
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={updateEvent} className="flex-1 font-bold">
                UPDATE
              </Button>
              <Button 
                onClick={() => editingEvent && deleteEvent(editingEvent.id)} 
                variant="destructive"
                className="flex-1 font-bold"
              >
                DELETE
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarSection;
