-- Create auth_attempts table for comprehensive logging
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempt_type text NOT NULL CHECK (attempt_type IN ('login', 'signup', 'monitoring')),
  success boolean DEFAULT false,
  session_id uuid,
  user_info jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS with no user access (service role only)
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Create fraud_audit_log table - Immutable Merkle tree chain
CREATE TABLE IF NOT EXISTS public.fraud_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  previous_hash text,
  entry_hash text NOT NULL,
  chain_position bigint NOT NULL,
  ip_hash text,
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fraud_audit_log ENABLE ROW LEVEL SECURITY;

-- Create request_nonces table - Anti-replay protection
CREATE TABLE IF NOT EXISTS public.request_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL UNIQUE,
  session_id uuid,
  expected_response_time timestamptz,
  actual_response_time timestamptz,
  timing_valid boolean,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.request_nonces ENABLE ROW LEVEL SECURITY;

-- Create response_timing_data table - Anonymous timing calibration
CREATE TABLE IF NOT EXISTS public.response_timing_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_duration_ms integer,
  request_type text,
  endpoint_category text,
  http_status integer,
  connection_type text,
  effective_type text,
  downlink_estimate numeric,
  rtt_estimate integer,
  is_anomalous boolean DEFAULT false,
  anomaly_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.response_timing_data ENABLE ROW LEVEL SECURITY;

-- Function to compute audit hash
CREATE OR REPLACE FUNCTION public.compute_audit_hash(
  p_entry_type text,
  p_table_name text,
  p_record_id uuid,
  p_operation text,
  p_old_data jsonb,
  p_new_data jsonb,
  p_previous_hash text,
  p_chain_position bigint,
  p_timestamp timestamptz
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hash_input text;
BEGIN
  hash_input := COALESCE(p_entry_type, '') || '|' ||
                COALESCE(p_table_name, '') || '|' ||
                COALESCE(p_record_id::text, '') || '|' ||
                COALESCE(p_operation, '') || '|' ||
                COALESCE(p_old_data::text, '') || '|' ||
                COALESCE(p_new_data::text, '') || '|' ||
                COALESCE(p_previous_hash, '') || '|' ||
                COALESCE(p_chain_position::text, '') || '|' ||
                COALESCE(p_timestamp::text, '');
  RETURN encode(extensions.digest(hash_input, 'sha256'), 'hex');
END;
$$;

-- Function to add audit entry with auto-linking
CREATE OR REPLACE FUNCTION public.add_audit_entry(
  p_entry_type text,
  p_table_name text,
  p_record_id uuid,
  p_operation text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_ip_hash text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_hash text;
  v_chain_position bigint;
  v_entry_hash text;
  v_entry_id uuid;
  v_timestamp timestamptz;
BEGIN
  v_timestamp := now();
  
  -- Get previous entry
  SELECT entry_hash, chain_position INTO v_previous_hash, v_chain_position
  FROM public.fraud_audit_log
  ORDER BY chain_position DESC
  LIMIT 1;
  
  v_chain_position := COALESCE(v_chain_position, 0) + 1;
  
  -- Compute hash
  v_entry_hash := public.compute_audit_hash(
    p_entry_type, p_table_name, p_record_id, p_operation,
    p_old_data, p_new_data, v_previous_hash, v_chain_position, v_timestamp
  );
  
  -- Insert entry
  INSERT INTO public.fraud_audit_log (
    entry_type, table_name, record_id, operation,
    old_data, new_data, previous_hash, entry_hash,
    chain_position, ip_hash, session_id, created_at
  ) VALUES (
    p_entry_type, p_table_name, p_record_id, p_operation,
    p_old_data, p_new_data, v_previous_hash, v_entry_hash,
    v_chain_position, p_ip_hash, p_session_id, v_timestamp
  ) RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$;

-- Function to verify chain integrity
CREATE OR REPLACE FUNCTION public.verify_audit_chain_integrity()
RETURNS TABLE(
  is_valid boolean,
  broken_at_position bigint,
  expected_hash text,
  actual_hash text,
  total_entries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_previous_hash text;
  v_computed_hash text;
  v_total bigint;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.fraud_audit_log;
  
  FOR v_entry IN SELECT * FROM public.fraud_audit_log ORDER BY chain_position ASC LOOP
    v_computed_hash := public.compute_audit_hash(
      v_entry.entry_type, v_entry.table_name, v_entry.record_id,
      v_entry.operation, v_entry.old_data, v_entry.new_data,
      v_previous_hash, v_entry.chain_position, v_entry.created_at
    );
    
    IF v_computed_hash != v_entry.entry_hash THEN
      RETURN QUERY SELECT false, v_entry.chain_position, v_computed_hash, v_entry.entry_hash, v_total;
      RETURN;
    END IF;
    
    IF v_entry.previous_hash IS DISTINCT FROM v_previous_hash THEN
      RETURN QUERY SELECT false, v_entry.chain_position, v_previous_hash, v_entry.previous_hash, v_total;
      RETURN;
    END IF;
    
    v_previous_hash := v_entry.entry_hash;
  END LOOP;
  
  RETURN QUERY SELECT true, NULL::bigint, NULL::text, NULL::text, v_total;
END;
$$;

-- Function to check bulk operations
CREATE OR REPLACE FUNCTION public.check_bulk_operation_alert()
RETURNS TABLE(
  alert_type text,
  operation_count bigint,
  time_window_seconds integer,
  session_id uuid,
  ip_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'BULK_OPERATION_DETECTED'::text,
    COUNT(*)::bigint,
    60,
    f.session_id,
    f.ip_hash
  FROM public.fraud_audit_log f
  WHERE f.created_at > now() - interval '60 seconds'
  GROUP BY f.session_id, f.ip_hash
  HAVING COUNT(*) > 5;
END;
$$;

-- Trigger function to audit auth_attempts
CREATE OR REPLACE FUNCTION public.audit_auth_attempts_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.add_audit_entry(
      'DELETION_BLOCKED', 'auth_attempts', OLD.id, 'DELETE_ATTEMPTED',
      to_jsonb(OLD), NULL, NULL, OLD.session_id
    );
    RAISE EXCEPTION 'Deletion of auth_attempts records is prohibited';
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.add_audit_entry(
      'RECORD_CREATED', 'auth_attempts', NEW.id, 'INSERT',
      NULL, to_jsonb(NEW), NULL, NEW.session_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.add_audit_entry(
      'RECORD_MODIFIED', 'auth_attempts', NEW.id, 'UPDATE',
      to_jsonb(OLD), to_jsonb(NEW), NULL, NEW.session_id
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on auth_attempts
DROP TRIGGER IF EXISTS audit_auth_attempts ON public.auth_attempts;
CREATE TRIGGER audit_auth_attempts
  BEFORE INSERT OR UPDATE OR DELETE ON public.auth_attempts
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_attempts_trigger();

-- Block deletion on fraud_audit_log
CREATE OR REPLACE FUNCTION public.block_fraud_log_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fraud_audit_log records is prohibited';
END;
$$;

DROP TRIGGER IF EXISTS prevent_fraud_log_delete ON public.fraud_audit_log;
CREATE TRIGGER prevent_fraud_log_delete
  BEFORE DELETE ON public.fraud_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_fraud_log_deletion();