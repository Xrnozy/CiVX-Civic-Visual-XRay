-- Registration invites for LGU-issued street sweeper onboarding

CREATE TYPE registration_invite_status AS ENUM ('active', 'used', 'expired', 'revoked');

CREATE TABLE registration_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  target_role user_role NOT NULL DEFAULT 'street_sweeper',
  created_by UUID NOT NULL REFERENCES users(id),
  barangay TEXT,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  status registration_invite_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_registration_invites_token ON registration_invites(token);
CREATE INDEX idx_registration_invites_status ON registration_invites(status);
CREATE INDEX idx_registration_invites_created_by ON registration_invites(created_by);

ALTER TABLE users
  ADD COLUMN organization_name TEXT,
  ADD COLUMN invite_id UUID REFERENCES registration_invites(id),
  ADD COLUMN registration_completed_at TIMESTAMPTZ;
