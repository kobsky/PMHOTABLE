-- Invite tokens table
-- Used to invite new team members via a shareable link (7-day expiry)

CREATE TABLE invite_tokens (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT now()
);

-- Index for fast token lookups (accept flow)
CREATE INDEX ON invite_tokens (token);
-- Index for listing pending invites by creator
CREATE INDEX ON invite_tokens (created_by, accepted_at);

-- RLS
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage invites
CREATE POLICY "authenticated_invite_tokens" ON invite_tokens
  FOR ALL
  USING (auth.uid() IS NOT NULL);
