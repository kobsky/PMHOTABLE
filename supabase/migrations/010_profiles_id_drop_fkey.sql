-- Migration 010: Drop FK constraint profiles.id → auth.users
-- Reason: placeholder profiles have no auth account, so profiles.id
--         cannot reference auth.users.id for those rows.
--         For active users the identity link is maintained via linked_user_id instead.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
