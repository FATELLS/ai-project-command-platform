-- 虚谷版本 — Materials & Evidence
-- 从 SQLite 004 转换
-- FTS5 -> 虚谷全文索引（CONTAINS）

CREATE TABLE project_materials (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  source_kind VARCHAR(20) NOT NULL DEFAULT 'upload',
  display_name VARCHAR(240) NOT NULL,
  canonical_extension VARCHAR(20) NOT NULL,
  canonical_mime VARCHAR(128) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  byte_size BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  active_extraction_version INTEGER,
  original_removed_at VARCHAR(40),
  created_by VARCHAR(128) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_project_materials PRIMARY KEY (project_id, id),
  CONSTRAINT uq_pm_sha UNIQUE (project_id, sha256),
  CONSTRAINT chk_pmid_len CHECK (LENGTH(id) BETWEEN 16 AND 128 AND INSTR(id, '/') = 0 AND INSTR(id, '\') = 0),
  CONSTRAINT chk_pm_source CHECK (source_kind IN ('upload', 'manual')),
  CONSTRAINT chk_pm_name CHECK (LENGTH(display_name) BETWEEN 1 AND 240),
  CONSTRAINT chk_pm_sha CHECK (LENGTH(sha256) = 64),
  CONSTRAINT chk_pm_size CHECK (byte_size >= 0),
  CONSTRAINT chk_pm_status CHECK (status IN ('queued', 'processing', 'ready', 'dependency_missing', 'failed', 'deleting')),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE material_artifacts (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  created_at VARCHAR(40) NOT NULL,
  removed_at VARCHAR(40),
  CONSTRAINT pk_material_artifacts PRIMARY KEY (project_id, id),
  CONSTRAINT uq_ma_storage UNIQUE (storage_key),
  CONSTRAINT uq_ma_kind UNIQUE (project_id, material_id, kind, id),
  CONSTRAINT chk_ma_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_ma_kind CHECK (kind IN ('original', 'extracted_text', 'ocr_tsv', 'thumbnail')),
  CONSTRAINT chk_ma_storage CHECK (LENGTH(storage_key) BETWEEN 1 AND 512),
  CONSTRAINT chk_ma_size CHECK (byte_size >= 0),
  CONSTRAINT chk_ma_sha CHECK (LENGTH(sha256) = 64),
  CONSTRAINT chk_ma_status CHECK (status IN ('available', 'removed', 'quarantined')),
  CONSTRAINT fk_ma_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

CREATE TABLE material_jobs (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_owner VARCHAR(128),
  lease_expires_at VARCHAR(40),
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  error_code VARCHAR(128),
  stats_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_material_jobs PRIMARY KEY (project_id, id),
  CONSTRAINT chk_mj_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_mj_kind CHECK (kind IN ('extract', 'delete')),
  CONSTRAINT chk_mj_state CHECK (state IN ('queued', 'leased', 'succeeded', 'failed')),
  CONSTRAINT chk_mj_attempts CHECK (attempts >= 0),
  CONSTRAINT chk_mj_timeout CHECK (timeout_ms BETWEEN 1000 AND 3600000),
  CONSTRAINT chk_mj_stats CHECK (JSON_VALID(stats_json) = 1),
  CONSTRAINT chk_mj_lease CHECK ((state = 'leased') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CONSTRAINT fk_mj_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

CREATE TABLE evidence_blocks (
  id INTEGER IDENTITY(1,1),
  external_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  extraction_version INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  kind VARCHAR(30) NOT NULL,
  location_json CLOB NOT NULL,
  text CLOB NOT NULL,
  summary CLOB NOT NULL DEFAULT '',
  content_hash VARCHAR(64) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_evidence_blocks PRIMARY KEY (id),
  CONSTRAINT uq_eb_ext UNIQUE (project_id, external_id),
  CONSTRAINT uq_eb_ordinal UNIQUE (project_id, material_id, extraction_version, ordinal),
  CONSTRAINT chk_eb_eid CHECK (LENGTH(external_id) BETWEEN 16 AND 128),
  CONSTRAINT chk_eb_ver CHECK (extraction_version > 0),
  CONSTRAINT chk_eb_ord CHECK (ordinal >= 0),
  CONSTRAINT chk_eb_kind CHECK (kind IN ('text', 'paragraph', 'page', 'table', 'slide', 'sheet', 'image')),
  CONSTRAINT chk_eb_loc CHECK (JSON_VALID(location_json) = 1),
  CONSTRAINT chk_eb_hash CHECK (LENGTH(content_hash) = 64),
  CONSTRAINT fk_eb_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

-- 全文索引: 用虚谷全文索引替代 FTS5
CREATE INDEX idx_evidence_fts ON evidence_blocks(text, summary) INDEXTYPE IS CTXSYS.CONTEXT;

CREATE TABLE material_qa_grants (
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  audience VARCHAR(30) NOT NULL DEFAULT 'disabled',
  enabled INTEGER NOT NULL DEFAULT 0,
  granted_by VARCHAR(128),
  granted_at VARCHAR(40),
  CONSTRAINT pk_material_qa_grants PRIMARY KEY (project_id, material_id),
  CONSTRAINT chk_mqg_audience CHECK (audience IN ('disabled', 'project_members', 'editors')),
  CONSTRAINT chk_mqg_enabled CHECK (enabled IN (0, 1)),
  CONSTRAINT chk_mqg_logic CHECK (enabled = 0 OR (audience <> 'disabled' AND granted_by IS NOT NULL AND granted_at IS NOT NULL)),
  CONSTRAINT fk_mqg_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mqg_user FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE TABLE material_update_selections (
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  template_version VARCHAR(64) NOT NULL,
  selected_by VARCHAR(128) NOT NULL,
  selected_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_material_update_sel PRIMARY KEY (project_id, material_id),
  CONSTRAINT fk_mus_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mus_template FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version),
  CONSTRAINT fk_mus_user FOREIGN KEY (selected_by) REFERENCES users(id)
);

CREATE TABLE material_upload_attempts (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  outcome VARCHAR(20) NOT NULL DEFAULT 'started',
  error_code VARCHAR(128),
  created_at VARCHAR(40) NOT NULL,
  finished_at VARCHAR(40),
  CONSTRAINT pk_material_upload_attempts PRIMARY KEY (id),
  CONSTRAINT chk_mua_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_mua_outcome CHECK (outcome IN ('started', 'accepted', 'rejected', 'aborted')),
  CONSTRAINT fk_mua_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_mua_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE material_upload_locks (
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  attempt_id VARCHAR(128) NOT NULL,
  expires_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_material_upload_locks PRIMARY KEY (project_id, user_id),
  CONSTRAINT uq_mul_attempt UNIQUE (attempt_id),
  CONSTRAINT fk_mul_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_mul_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mul_attempt FOREIGN KEY (attempt_id) REFERENCES material_upload_attempts(id) ON DELETE CASCADE
);

CREATE TABLE ai_usage_events (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  capability VARCHAR(20) NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  request_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_ai_usage_events PRIMARY KEY (id),
  CONSTRAINT chk_aue_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_aue_cap CHECK (capability IN ('chat', 'generation')),
  CONSTRAINT chk_aue_units CHECK (units > 0),
  CONSTRAINT chk_aue_status CHECK (status IN ('reserved', 'succeeded', 'failed', 'rejected')),
  CONSTRAINT fk_aue_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_aue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_materials_project_status ON project_materials(project_id, status, created_at DESC);
CREATE INDEX idx_material_artifacts_usage ON material_artifacts(project_id, status, byte_size);
CREATE INDEX idx_material_jobs_queue ON material_jobs(state, lease_expires_at, created_at);
CREATE INDEX idx_evidence_material ON evidence_blocks(project_id, material_id, extraction_version, ordinal);
CREATE INDEX idx_upload_attempts_rate ON material_upload_attempts(project_id, user_id, created_at DESC);
CREATE INDEX idx_ai_usage_quota ON ai_usage_events(capability, project_id, user_id, created_at DESC);
