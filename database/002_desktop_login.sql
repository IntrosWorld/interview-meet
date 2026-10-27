CREATE TABLE IF NOT EXISTS desktop_login_codes (
  code_hash text PRIMARY KEY,
  challenge text NOT NULL,
  firebase_uid text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes'
);
CREATE INDEX IF NOT EXISTS desktop_login_expiry ON desktop_login_codes(expires_at);
