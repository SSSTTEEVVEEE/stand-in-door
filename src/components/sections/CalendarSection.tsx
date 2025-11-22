import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/contexts/EncryptionContext";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description?: string;
}

type ViewType = "day" | "week" | "month" | "year";

const CalendarSection = () => {
  const { toast } = useToast();
  const { encrypt, decrypt, pseudonymId } = useEncryption();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "09:00",
    description: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    if (!pseudonymId) {
      setLoading(false);
      return;
    }

    try {
      const { data: eventsData } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("pseudonym_id", pseudonymId)
        .order("created_at", { ascending: false });

      if (eventsData) {
        const decryptedEvents = await Promise.all(
          eventsData.map(async (e) => {
            try {
              const title = await decrypt(e.encrypted_title, e.data_hash || undefined);
              const date = await decrypt(e.encrypted_date, e.data_hash || undefined);
              const time = await decrypt(e.encrypted_time, e.data_hash || undefined);
              const description = e.encrypted_description 
                ? await decrypt(e.encrypted_description, e.data_hash || undefined)
                : undefined;

              return {
                id: e.id,
                title,
                date,
                time,
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
      // Error loading events
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      toast({
        title: "Invalid Input",
        description: "Title and date are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { encrypted: encTitle } = await encrypt(newEvent.title);
      const { encrypted: encDate } = await encrypt(newEvent.date);
      const { encrypted: encTime } = await encrypt(newEvent.time);
      const { encrypted: encDesc } = await encrypt(newEvent.description || "");
      const { encrypted: encCreated } = await encrypt(now);
      const { hash: dataHash } = await encrypt(`${newEvent.title}|${newEvent.date}|${newEvent.time}`);

      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_title: encTitle,
          encrypted_date: encDate,
          encrypted_time: encTime,
          encrypted_description: encDesc,
          encrypted_created_at: encCreated,
          data_hash: dataHash,
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
          description: newEvent.description,
        },
      ]);

      setNewEvent({ title: "", date: "", time: "09:00", description: "" });
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

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      setEvents(events.filter((e) => e.id !== eventId));
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
    const days = [];
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square border border-border/50 bg-muted/20" />);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <div
          key={day}
          className={`aspect-square border border-border/50 p-2 bg-background hover:bg-muted/50 transition-colors ${
            isToday ? "border-primary border-2" : ""
          }`}
        >
          <div className={`text-sm font-bold mb-1 ${isToday ? "text-primary" : ""}`}>{day}</div>
          <div className="space-y-1 overflow-hidden">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="text-xs px-1 py-0.5 bg-primary/20 rounded truncate cursor-pointer hover:bg-primary/30"
                onClick={() => deleteEvent(event.id)}
                title={`${event.time} - ${event.title} (Click to delete)`}
              >
                {event.time} {event.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-0">
          {weekDays.map((day) => (
            <div key={day} className="text-center font-bold text-sm py-2 border-b border-border">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0 border border-border">
          {days}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => {
          const dayEvents = getEventsForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <Card key={date.toISOString()} className={`p-3 ${isToday ? "border-primary border-2" : ""}`}>
              <div className="text-center mb-2">
                <div className="text-xs text-muted-foreground">{date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{date.getDate()}</div>
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="text-xs p-2 bg-primary/20 rounded cursor-pointer hover:bg-primary/30"
                    onClick={() => deleteEvent(event.id)}
                    title="Click to delete"
                  >
                    <div className="font-bold">{event.time}</div>
                    <div className="truncate">{event.title}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <ScrollArea className="h-[600px]">
        <div className="space-y-1">
          {hours.map((hour) => {
            const hourEvents = dayEvents.filter((e) => parseInt(e.time.split(":")[0]) === hour);
            const timeLabel = `${hour.toString().padStart(2, "0")}:00`;

            return (
              <div key={hour} className="flex border-t border-border/50">
                <div className="w-20 text-sm text-muted-foreground p-2">{timeLabel}</div>
                <div className="flex-1 min-h-[60px] p-2 space-y-1">
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 bg-primary/20 rounded cursor-pointer hover:bg-primary/30"
                      onClick={() => deleteEvent(event.id)}
                      title="Click to delete"
                    >
                      <div className="font-bold">{event.time} - {event.title}</div>
                      {event.description && (
                        <div className="text-xs text-muted-foreground mt-1">{event.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
            <Card key={month} className="p-3">
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
    <div className="space-y-4">
      {/* View selector */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          <Button
            variant={viewType === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("day")}
            className="font-bold"
          >
            DAY
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("week")}
            className="font-bold"
          >
            WEEK
          </Button>
          <Button
            variant={viewType === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("month")}
            className="font-bold"
          >
            MONTH
          </Button>
          <Button
            variant={viewType === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("year")}
            className="font-bold"
          >
            YEAR
          </Button>
        </div>
      </ScrollArea>

      {/* Calendar header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold">{getDateRangeText()}</h2>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
              TODAY
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold">
                <Plus className="w-4 h-4 mr-2" />
                NEW EVENT
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Event</DialogTitle>
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
                    <Label htmlFor="eventTime">Time</Label>
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
        </div>
      </Card>

      {/* Calendar view */}
      <Card className="p-4">
        {viewType === "month" && renderMonthView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "day" && renderDayView()}
        {viewType === "year" && renderYearView()}
      </Card>
    </div>
  );
};

export default CalendarSection;
