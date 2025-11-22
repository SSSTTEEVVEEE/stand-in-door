-- Remove redundant created_at columns from tables with encrypted_created_at
ALTER TABLE calendar_events DROP COLUMN IF EXISTS created_at;
ALTER TABLE checklist_reminders DROP COLUMN IF EXISTS created_at;
ALTER TABLE checklists DROP COLUMN IF EXISTS created_at;
ALTER TABLE chores DROP COLUMN IF EXISTS created_at;