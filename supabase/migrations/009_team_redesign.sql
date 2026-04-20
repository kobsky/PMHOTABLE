-- Migration 009: Team redesign — multi-role profiles, placeholder members
-- Changes:
--   1. role: text → text[] (support multiple roles per member)
--   2. Drop department column (unused in app logic)
--   3. Add profile_type: 'active' | 'placeholder' | 'invited'
--   4. Make email nullable (placeholder profiles may not have email)
--   5. Add linked_user_id (placeholder → auth user link after invite acceptance)
--   6. Update RLS to allow team management of all profiles
-- All statements are idempotent (safe to re-run).

-- 1. Convert role: text → text[]
--    Guard with a type-check so this block only runs when column is still text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'role'
      AND data_type    = 'text'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

    ALTER TABLE profiles
      ALTER COLUMN role TYPE text[]
      USING CASE
        WHEN role IS NULL     THEN ARRAY[]::text[]
        WHEN role::text = ''  THEN ARRAY[]::text[]
        ELSE ARRAY[role::text]
      END;

    ALTER TABLE profiles ALTER COLUMN role SET DEFAULT '{}';
  END IF;
END $$;

-- 2. Remove department (not used anywhere in application logic)
ALTER TABLE profiles DROP COLUMN IF EXISTS department;

-- 3. Add profile_type — distinguishes real users from placeholders
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'active'
  CHECK (profile_type IN ('active', 'placeholder', 'invited'));

-- 4. Make email nullable — placeholder profiles created without invite don't need email
ALTER TABLE profiles
  ALTER COLUMN email DROP NOT NULL;

-- 5. Add linked_user_id — set when placeholder accepts invite and creates auth account
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- 6. Rebuild role index: array → GIN index for efficient containment queries
DROP INDEX IF EXISTS idx_profiles_role;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles USING GIN(role);

-- 7. RLS: replace restrictive self-update policy with team-management policy
--    Drop both the old name and the new name so re-runs don't error.
DROP POLICY IF EXISTS "users_can_update_own_profile"  ON profiles;
DROP POLICY IF EXISTS "authenticated_profiles_update" ON profiles;

CREATE POLICY "authenticated_profiles_update" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 8. INSERT policy for placeholder profile creation
DROP POLICY IF EXISTS "authenticated_profiles_insert" ON profiles;

CREATE POLICY "authenticated_profiles_insert" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 9. DELETE policy (only placeholder/invited profiles can be deleted)
DROP POLICY IF EXISTS "authenticated_profiles_delete" ON profiles;

CREATE POLICY "authenticated_profiles_delete" ON profiles
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND profile_type IN ('placeholder', 'invited')
  );

-- Done. After applying locally:
-- supabase gen types typescript --local > lib/supabase/types.ts
