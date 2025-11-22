-- Fix failed_auth_attempts RLS policy
-- Remove the public INSERT policy that allows anyone to insert
DROP POLICY IF EXISTS "Anyone can insert failed attempts" ON public.failed_auth_attempts;

-- Edge functions will use service role to insert fraud tracking data
-- Only admins can view the fraud data (existing SELECT policy remains)

COMMENT ON TABLE public.failed_auth_attempts IS 'Fraud detection data inserted by edge functions only using service role. No public access for inserts.';