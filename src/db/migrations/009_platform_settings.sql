CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
) STRICT;
