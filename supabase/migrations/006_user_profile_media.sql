-- Organizer logo + profile media on registration

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_logo_url TEXT;
