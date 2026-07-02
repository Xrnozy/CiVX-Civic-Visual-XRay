-- Demo sessions for mobile web QR flow
CREATE TABLE IF NOT EXISTS demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  label TEXT
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS demo_session_id UUID REFERENCES demo_sessions(id);
CREATE INDEX IF NOT EXISTS reports_demo_session_idx ON reports (demo_session_id);

-- Field checker role for dispatch dashboard
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'field_checker';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Dispatch workflow
DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM (
    'assigned', 'on_the_way', 'checking_site',
    'verified', 'needs_action', 'resolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dispatch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),
  checker_user_id UUID REFERENCES users(id),
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  dispatch_status dispatch_status NOT NULL DEFAULT 'assigned',
  priority INT DEFAULT 0,
  checker_notes TEXT,
  before_photo_url TEXT,
  after_photo_url TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS dispatch_assignments_checker_idx ON dispatch_assignments (checker_user_id);
CREATE INDEX IF NOT EXISTS dispatch_assignments_incident_idx ON dispatch_assignments (incident_id);

CREATE TABLE IF NOT EXISTS dispatch_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_assignment_id UUID NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  dispatch_status dispatch_status,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_activity_log_assignment_idx ON dispatch_activity_log (dispatch_assignment_id);

-- Optional: link checkers to primary department for routing hints
ALTER TABLE users ADD COLUMN IF NOT EXISTS checker_department_id UUID REFERENCES departments(id);
