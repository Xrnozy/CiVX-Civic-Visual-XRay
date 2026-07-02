-- Community banner image for cleanup drives

ALTER TABLE cleanup_events
  ADD COLUMN IF NOT EXISTS banner_url TEXT;
