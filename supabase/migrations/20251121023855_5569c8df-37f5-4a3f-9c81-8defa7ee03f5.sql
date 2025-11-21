-- Add data_hash columns for SHA3-512 integrity validation on all encrypted tables
-- This ensures data hasn't been tampered with

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS data_hash text;

ALTER TABLE public.checklist_reminders 
ADD COLUMN IF NOT EXISTS data_hash text;

ALTER TABLE public.checklists 
ADD COLUMN IF NOT EXISTS data_hash text;

ALTER TABLE public.chores 
ADD COLUMN IF NOT EXISTS data_hash text;

ALTER TABLE public.focus_monitoring 
ADD COLUMN IF NOT EXISTS data_hash text;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS data_hash text;

-- Add encrypted created_at to user_roles for complete encryption coverage
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS encrypted_created_at text;

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS data_hash text;

COMMENT ON COLUMN public.calendar_events.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.checklist_reminders.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.checklists.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.chores.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.focus_monitoring.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.profiles.data_hash IS 'SHA3-512 hash for data integrity verification';
COMMENT ON COLUMN public.user_roles.data_hash IS 'SHA3-512 hash for data integrity verification';