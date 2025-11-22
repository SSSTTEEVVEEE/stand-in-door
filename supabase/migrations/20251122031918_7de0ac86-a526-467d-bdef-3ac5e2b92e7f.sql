-- Remove data_hash columns from all tables (no longer needed - AES-GCM provides authentication)
-- This simplifies the schema and removes the broken hash verification system

ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.checklist_reminders DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.checklists DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.chores DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.focus_monitoring DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS data_hash;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS data_hash;