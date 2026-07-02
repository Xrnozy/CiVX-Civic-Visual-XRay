-- LGU rejection notes for cleanup drive approval workflow

ALTER TABLE cleanup_events
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
