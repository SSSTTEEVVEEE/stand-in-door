-- Fix search_path for functions missing it
ALTER FUNCTION public.check_bulk_operation_alert() SET search_path = public;
ALTER FUNCTION public.block_fraud_log_deletion() SET search_path = public;

-- RLS policies for auth_attempts (service role only via edge functions)
-- No user policies - inserts only via service role in edge function

-- RLS policies for fraud_audit_log (service role only, no user access)
-- No user policies - managed by triggers only

-- RLS policies for request_nonces (service role only)
-- No user policies - managed by edge function only

-- RLS policies for response_timing_data (anonymous insert for calibration)
CREATE POLICY "Anyone can insert timing data"
ON public.response_timing_data
FOR INSERT
WITH CHECK (true);

-- Only admins can read timing data for analysis
CREATE POLICY "Admins can view timing data"
ON public.response_timing_data
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));