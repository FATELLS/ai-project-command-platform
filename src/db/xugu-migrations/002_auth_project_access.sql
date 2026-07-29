-- 虚谷版本 — Auth & Project Access
-- 从 SQLite 002 转换

ALTER TABLE users ADD COLUMN login_name VARCHAR(128);
ALTER TABLE users ADD COLUMN password_salt VARCHAR(256);
ALTER TABLE users ADD COLUMN password_hash VARCHAR(256);
ALTER TABLE users ADD COLUMN password_params_json CLOB;
ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD CONSTRAINT chk_users_ppjson CHECK (password_params_json IS NULL OR JSON_VALID(password_params_json) = 1);
ALTER TABLE users ADD CONSTRAINT chk_users_admin CHECK (is_platform_admin IN (0, 1));

CREATE UNIQUE INDEX idx_users_login_name ON users(login_name) WHERE login_name IS NOT NULL;

CREATE TABLE sessions (
  id VARCHAR(128) NOT NULL,
  token_hash VARCHAR(256) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  csrf_token VARCHAR(256) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  last_seen_at VARCHAR(40) NOT NULL,
  idle_expires_at VARCHAR(40) NOT NULL,
  absolute_expires_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_sessions PRIMARY KEY (id),
  CONSTRAINT uq_sessions_token UNIQUE (token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id, absolute_expires_at);
CREATE INDEX idx_sessions_expiry ON sessions(idle_expires_at, absolute_expires_at);

CREATE TABLE recent_project_access (
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  last_accessed_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_rpa PRIMARY KEY (user_id, project_id),
  CONSTRAINT fk_rpa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rpa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_recent_project_access_user ON recent_project_access(user_id, last_accessed_at DESC);

CREATE TABLE audit_events (
  id INTEGER IDENTITY(1,1),
  user_id VARCHAR(128),
  project_id VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128),
  remote_address VARCHAR(128) NOT NULL DEFAULT '',
  metadata_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_audit_events PRIMARY KEY (id),
  CONSTRAINT chk_audit_meta CHECK (JSON_VALID(metadata_json) = 1),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_audit_events_user ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_project ON audit_events(project_id, created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action, created_at DESC);

-- 审计事件只追加触发器
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only';
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only';
END;
