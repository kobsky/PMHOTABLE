-- Fix handle_new_user trigger function.
-- Root cause: function ran in auth schema context and could not resolve
-- unqualified "profiles" → "auth.profiles does not exist" → OTP 500 error.
-- Fix: SET search_path = public + explicit public.profiles reference.
-- Also adds ON CONFLICT DO NOTHING to make it idempotent.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  return new;
end;
$$;
