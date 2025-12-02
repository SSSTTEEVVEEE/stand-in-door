-- Add end time, repeat days, and color columns to calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN encrypted_end_time text,
ADD COLUMN encrypted_repeat_days text,
ADD COLUMN encrypted_color text;

-- Add source tracking to checklist_reminders to know where auto-populated items came from
ALTER TABLE public.checklist_reminders
ADD COLUMN source_type text,
ADD COLUMN source_id uuid,
ADD COLUMN source_date text;