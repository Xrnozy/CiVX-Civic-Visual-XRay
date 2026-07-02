-- Backfill dispatch schema expected by the LGU dispatch and field checker APIs.
-- Safe to run even if 008_demo_sessions_and_dispatch.sql was already applied.

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'field_checker';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM (
    'assigned',
    'on_the_way',
    'checking_site',
    'verified',
    'needs_action',
    'resolved'
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

CREATE INDEX IF NOT EXISTS dispatch_assignments_checker_idx
  ON dispatch_assignments (checker_user_id);

CREATE INDEX IF NOT EXISTS dispatch_assignments_incident_idx
  ON dispatch_assignments (incident_id);

CREATE TABLE IF NOT EXISTS dispatch_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_assignment_id UUID NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  dispatch_status dispatch_status,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_activity_log_assignment_idx
  ON dispatch_activity_log (dispatch_assignment_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS checker_department_id UUID REFERENCES departments(id);

NOTIFY pgrst, 'reload schema';
