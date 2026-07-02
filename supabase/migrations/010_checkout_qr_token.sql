-- Checkout QR token is issued when the organizer ends an approved event.
ALTER TABLE cleanup_events
  ADD COLUMN IF NOT EXISTS checkout_qr_code_token TEXT UNIQUE;
