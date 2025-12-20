-- Fix profiles SELECT policy to use is_admin function instead of checking record's is_admin column
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT
USING (
  auth.uid() = id  -- Users can view their own profile
  OR 
  public.is_admin(auth.uid())  -- Admins can view all profiles
);

-- Also update DELETE and UPDATE policies to allow admins to manage profiles
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

CREATE POLICY "profiles_delete_policy" ON profiles
FOR DELETE
USING (
  auth.uid() = id 
  OR 
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

CREATE POLICY "profiles_update_policy" ON profiles
FOR UPDATE
USING (
  auth.uid() = id 
  OR 
  public.is_admin(auth.uid())
);