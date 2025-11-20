-- Fix the handle_new_user trigger to use built-in functions instead of gen_random_bytes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use gen_random_uuid() instead of gen_random_bytes for encryption salt
  INSERT INTO public.profiles (user_id, encryption_salt)
  VALUES (new.id, encode(digest(gen_random_uuid()::text || new.id::text, 'sha256'), 'hex'));
  
  -- Insert default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$;