-- Create enum for user roles (stored separately for security)
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create profiles table with pseudonymization
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pseudonym_id TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  encrypted_email TEXT, -- Encrypted on client side
  encryption_salt TEXT NOT NULL, -- Server-side salt for key derivation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, encryption_salt)
  VALUES (new.id, encode(gen_random_bytes(32), 'hex'));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create chores table (all data encrypted client-side)
CREATE TABLE public.chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id TEXT NOT NULL REFERENCES public.profiles(pseudonym_id) ON DELETE CASCADE,
  encrypted_name TEXT NOT NULL, -- Encrypted chore name
  encrypted_period TEXT NOT NULL, -- Encrypted period value
  encrypted_created_at TEXT NOT NULL, -- Even timestamps are encrypted
  encrypted_updated_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

-- Create checklists table (zero-knowledge encrypted)
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id TEXT NOT NULL REFERENCES public.profiles(pseudonym_id) ON DELETE CASCADE,
  encrypted_name TEXT NOT NULL,
  encrypted_created_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Create checklist reminders table
CREATE TABLE public.checklist_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  encrypted_text TEXT NOT NULL,
  encrypted_completed TEXT NOT NULL, -- Boolean as encrypted string
  encrypted_created_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_reminders ENABLE ROW LEVEL SECURITY;

-- Create calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id TEXT NOT NULL REFERENCES public.profiles(pseudonym_id) ON DELETE CASCADE,
  encrypted_title TEXT NOT NULL,
  encrypted_description TEXT,
  encrypted_date TEXT NOT NULL,
  encrypted_time TEXT NOT NULL,
  encrypted_created_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Create failed auth attempts table (not encrypted - for security monitoring)
CREATE TABLE public.failed_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  navigator_data JSONB, -- MDN navigator telemetry
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

ALTER TABLE public.failed_auth_attempts ENABLE ROW LEVEL SECURITY;

-- Create focus monitoring table (encrypted)
CREATE TABLE public.focus_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id TEXT NOT NULL REFERENCES public.profiles(pseudonym_id) ON DELETE CASCADE,
  encrypted_field_name TEXT NOT NULL,
  encrypted_focus_duration TEXT NOT NULL, -- Duration in ms, encrypted
  encrypted_timestamp TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_monitoring ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for chores
CREATE POLICY "Users can view own chores"
  ON public.chores FOR SELECT
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chores"
  ON public.chores FOR INSERT
  WITH CHECK (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own chores"
  ON public.chores FOR UPDATE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own chores"
  ON public.chores FOR DELETE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for checklists
CREATE POLICY "Users can view own checklists"
  ON public.checklists FOR SELECT
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own checklists"
  ON public.checklists FOR INSERT
  WITH CHECK (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own checklists"
  ON public.checklists FOR UPDATE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own checklists"
  ON public.checklists FOR DELETE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for checklist_reminders
CREATE POLICY "Users can view own reminders"
  ON public.checklist_reminders FOR SELECT
  USING (
    checklist_id IN (
      SELECT id FROM public.checklists WHERE pseudonym_id IN (
        SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own reminders"
  ON public.checklist_reminders FOR INSERT
  WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.checklists WHERE pseudonym_id IN (
        SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own reminders"
  ON public.checklist_reminders FOR UPDATE
  USING (
    checklist_id IN (
      SELECT id FROM public.checklists WHERE pseudonym_id IN (
        SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own reminders"
  ON public.checklist_reminders FOR DELETE
  USING (
    checklist_id IN (
      SELECT id FROM public.checklists WHERE pseudonym_id IN (
        SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for calendar_events
CREATE POLICY "Users can view own events"
  ON public.calendar_events FOR SELECT
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own events"
  ON public.calendar_events FOR UPDATE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own events"
  ON public.calendar_events FOR DELETE
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for focus_monitoring
CREATE POLICY "Users can view own focus data"
  ON public.focus_monitoring FOR SELECT
  USING (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own focus data"
  ON public.focus_monitoring FOR INSERT
  WITH CHECK (
    pseudonym_id IN (
      SELECT pseudonym_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policy for failed_auth_attempts (admin only)
CREATE POLICY "Only admins can view failed attempts"
  ON public.failed_auth_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert failed attempts"
  ON public.failed_auth_attempts FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_chores_pseudonym ON public.chores(pseudonym_id);
CREATE INDEX idx_checklists_pseudonym ON public.checklists(pseudonym_id);
CREATE INDEX idx_calendar_events_pseudonym ON public.calendar_events(pseudonym_id);
CREATE INDEX idx_focus_monitoring_pseudonym ON public.focus_monitoring(pseudonym_id);
CREATE INDEX idx_failed_auth_email ON public.failed_auth_attempts(email);
CREATE INDEX idx_failed_auth_time ON public.failed_auth_attempts(attempt_time);

-- Trigger for updating profiles updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();