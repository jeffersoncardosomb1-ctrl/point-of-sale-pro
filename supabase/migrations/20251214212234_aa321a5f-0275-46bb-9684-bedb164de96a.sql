-- Update handle_new_user to NOT auto-assign roles for non-first users
-- and set is_active=false until admin approves
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the first user
  SELECT (count(*) = 0) INTO is_first_user FROM public.profiles;

  -- Insert profile: first user is active, others need approval
  INSERT INTO public.profiles (id, first_name, last_name, is_admin, is_active)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    is_first_user,
    is_first_user  -- first user is active, others need approval
  );

  -- Only assign role for first user (admin), others wait for admin approval
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  END IF;

  RETURN new;
END;
$$;