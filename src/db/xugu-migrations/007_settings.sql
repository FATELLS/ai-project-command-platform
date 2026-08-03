-- 虚谷版本 — Password Reset & Platform Settings
-- Platform settings schema.

ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD CONSTRAINT chk_users_mrp CHECK (must_reset_password IN (0, 1));

CREATE TABLE platform_settings (
  key VARCHAR(128) NOT NULL,
  value_json CLOB NOT NULL DEFAULT '{}',
  updated_at VARCHAR(40) NOT NULL,
  updated_by VARCHAR(128),
  CONSTRAINT pk_platform_settings PRIMARY KEY (key),
  CONSTRAINT fk_ps_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
