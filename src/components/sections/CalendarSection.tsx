import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
}

const CalendarSection = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [pseudonymId, setPseudonymId] = useState<string>("");

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
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

        const { data: eventsData } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("pseudonym_id", profile.pseudonym_id);

        if (eventsData) {
          setEvents(eventsData.map(e => ({
            id: e.id,
            title: e.encrypted_title,
            date: e.encrypted_date,
            time: e.encrypted_time,
            description: e.encrypted_description || ""
          })).sort((a, b) => 
            new Date(a.date + " " + a.time).getTime() - new Date(b.date + " " + b.time).getTime()
          ));
        }
      }
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          pseudonym_id: pseudonymId,
          encrypted_title: newEvent.title,
          encrypted_date: newEvent.date,
          encrypted_time: newEvent.time,
          encrypted_description: newEvent.description,
          encrypted_created_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const event: CalendarEvent = {
        id: data.id,
        ...newEvent,
      };

      setEvents([...events, event].sort((a, b) => 
        new Date(a.date + " " + a.time).getTime() - new Date(b.date + " " + b.time).getTime()
      ));

      setNewEvent({ title: "", date: "", time: "", description: "" });
      
      toast({
        title: "Event Scheduled",
        description: `${event.title} added to calendar`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setEvents(events.filter(e => e.id !== id));
      toast({
        title: "Event Removed",
        description: "Operation removed from calendar",
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

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter(e => e.date >= today);
  const pastEvents = events.filter(e => e.date < today);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">SCHEDULE EVENT</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="eventTitle">Mission Title</Label>
            <Input
              id="eventTitle"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="e.g., TEAM BRIEFING"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="eventDescription">Description</Label>
            <Input
              id="eventDescription"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Optional details"
              className="font-mono"
            />
          </div>
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

        <Button onClick={addEvent} className="w-full font-bold">
          DEPLOY EVENT
        </Button>
      </Card>

      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3">UPCOMING OPERATIONS</h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-sm font-mono">
                      {new Date(event.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })} • {event.time}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteEvent(event.id)}
                  >
                    CANCEL
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-3 text-muted-foreground">PAST OPERATIONS</h3>
          <div className="space-y-3">
            {pastEvents.map((event) => (
              <Card key={event.id} className="p-4 opacity-60">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-xs font-mono">
                      {new Date(event.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })} • {event.time}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteEvent(event.id)}
                  >
                    DELETE
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No operations scheduled. Deploy your first event above.</p>
        </Card>
      )}
    </div>
  );
};

export default CalendarSection;
