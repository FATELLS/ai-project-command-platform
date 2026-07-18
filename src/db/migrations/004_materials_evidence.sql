CREATE TABLE project_materials (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128 AND instr(id, '/') = 0 AND instr(id, '\\') = 0),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL DEFAULT 'upload' CHECK (source_kind IN ('upload', 'manual')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 240),
  canonical_extension TEXT NOT NULL,
  canonical_mime TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'dependency_missing', 'failed', 'deleting')),
  active_extraction_version INTEGER,
  original_removed_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, sha256)
) STRICT;

CREATE TABLE material_artifacts (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128 AND instr(id, '/') = 0 AND instr(id, '\\') = 0),
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('original', 'extracted_text', 'ocr_tsv', 'thumbnail')),
  storage_key TEXT NOT NULL UNIQUE CHECK (length(storage_key) BETWEEN 1 AND 512),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'removed', 'quarantined')),
  created_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY (project_id, id),
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, material_id, kind, id)
) STRICT;

CREATE TABLE material_jobs (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('extract', 'delete')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'leased', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_owner TEXT,
  lease_expires_at TEXT,
  timeout_ms INTEGER NOT NULL DEFAULT 120000 CHECK (timeout_ms BETWEEN 1000 AND 3600000),
  error_code TEXT,
  stats_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(stats_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id),
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CHECK ((state = 'leased') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
) STRICT;

CREATE TABLE evidence_blocks (
  id INTEGER PRIMARY KEY,
  external_id TEXT NOT NULL CHECK (length(external_id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  extraction_version INTEGER NOT NULL CHECK (extraction_version > 0),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'paragraph', 'page', 'table', 'slide', 'sheet', 'image')),
  location_json TEXT NOT NULL CHECK (json_valid(location_json)),
  text TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  UNIQUE (project_id, external_id),
  UNIQUE (project_id, material_id, extraction_version, ordinal)
) STRICT;

CREATE VIRTUAL TABLE evidence_fts USING fts5(
  text,
  summary,
  project_id UNINDEXED,
  material_id UNINDEXED,
  content='evidence_blocks',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER evidence_blocks_fts_insert AFTER INSERT ON evidence_blocks BEGIN
  INSERT INTO evidence_fts(rowid, text, summary, project_id, material_id)
  VALUES (new.id, new.text, new.summary, new.project_id, new.material_id);
END;
CREATE TRIGGER evidence_blocks_fts_delete AFTER DELETE ON evidence_blocks BEGIN
  INSERT INTO evidence_fts(evidence_fts, rowid, text, summary, project_id, material_id)
  VALUES ('delete', old.id, old.text, old.summary, old.project_id, old.material_id);
END;
CREATE TRIGGER evidence_blocks_fts_update AFTER UPDATE ON evidence_blocks BEGIN
  INSERT INTO evidence_fts(evidence_fts, rowid, text, summary, project_id, material_id)
  VALUES ('delete', old.id, old.text, old.summary, old.project_id, old.material_id);
  INSERT INTO evidence_fts(rowid, text, summary, project_id, material_id)
  VALUES (new.id, new.text, new.summary, new.project_id, new.material_id);
END;

CREATE TABLE material_qa_grants (
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'disabled' CHECK (audience IN ('disabled', 'project_members', 'editors')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT,
  PRIMARY KEY (project_id, material_id),
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CHECK (enabled = 0 OR (audience <> 'disabled' AND granted_by IS NOT NULL AND granted_at IS NOT NULL))
) STRICT;

CREATE TABLE material_update_selections (
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  selected_by TEXT NOT NULL REFERENCES users(id),
  selected_at TEXT NOT NULL,
  PRIMARY KEY (project_id, material_id),
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version)
) STRICT;

CREATE TABLE material_upload_attempts (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL DEFAULT 'started' CHECK (outcome IN ('started', 'accepted', 'rejected', 'aborted')),
  error_code TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
) STRICT;

CREATE TABLE material_upload_locks (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES material_upload_attempts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
) STRICT;

CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK (capability IN ('chat', 'generation')),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed', 'rejected')),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_materials_project_status ON project_materials(project_id, status, created_at DESC);
CREATE INDEX idx_material_artifacts_usage ON material_artifacts(project_id, status, byte_size);
CREATE INDEX idx_material_jobs_queue ON material_jobs(state, lease_expires_at, created_at);
CREATE INDEX idx_evidence_material ON evidence_blocks(project_id, material_id, extraction_version, ordinal);
CREATE INDEX idx_upload_attempts_rate ON material_upload_attempts(project_id, user_id, created_at DESC);
CREATE INDEX idx_ai_usage_quota ON ai_usage_events(capability, project_id, user_id, created_at DESC);
