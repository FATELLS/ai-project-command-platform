ALTER TABLE users ADD COLUMN login_name TEXT COLLATE NOCASE;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_params_json TEXT CHECK (password_params_json IS NULL OR json_valid(password_params_json));
ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_platform_admin IN (0, 1));

CREATE UNIQUE INDEX idx_users_login_name
ON users(login_name)
WHERE login_name IS NOT NULL;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_sessions_user ON sessions(user_id, absolute_expires_at);
CREATE INDEX idx_sessions_expiry ON sessions(idle_expires_at, absolute_expires_at);

CREATE TABLE recent_project_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_accessed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, project_id)
) STRICT;

CREATE INDEX idx_recent_project_access_user
ON recent_project_access(user_id, last_accessed_at DESC);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  remote_address TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  CHECK (json_valid(metadata_json))
) STRICT;

CREATE INDEX idx_audit_events_user ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_project ON audit_events(project_id, created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action, created_at DESC);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
