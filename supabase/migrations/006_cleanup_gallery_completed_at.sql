-- Track when a cleanup drive was marked complete (both proof images uploaded).
-- before_photo_url / after_photo_url already exist on cleanup_events for gallery proof.
ALTER TABLE cleanup_events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
