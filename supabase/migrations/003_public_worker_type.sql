-- Public worker job type (street sweeper, driver, etc.) collected at registration

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_worker_type TEXT;
