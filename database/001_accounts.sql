BEGIN;
CREATE TABLE IF NOT EXISTS users (
  firebase_uid text PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS interviews (
  id text PRIMARY KEY,
  firebase_uid text NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('voice', 'coding')),
  target text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted')),
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS interviews_user_date ON interviews(firebase_uid, started_at DESC);
COMMIT;
