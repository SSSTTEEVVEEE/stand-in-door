-- Remove encryption_salt column from profiles table since we now use deterministic salts
ALTER TABLE public.profiles DROP COLUMN encryption_salt;

-- Update the handle_new_user trigger to not insert encryption_salt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile without encryption_salt (now using deterministic salts from email)
  INSERT INTO public.profiles (user_id)
  VALUES (new.id);
  
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
$function$;