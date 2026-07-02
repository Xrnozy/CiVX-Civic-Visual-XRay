-- Store scanned QR token on EcoQuest submissions for verification.
ALTER TABLE ecoquest_submissions
  ADD COLUMN IF NOT EXISTS qr_code_id TEXT;
