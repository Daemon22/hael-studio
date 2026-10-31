CREATE TABLE IF NOT EXISTS hael_auth_sessions (
  id uuid PRIMARY KEY,
  subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hael_auth_sessions_expires_at_idx
  ON hael_auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS hael_auth_sessions_subject_idx
  ON hael_auth_sessions (subject, expires_at);
