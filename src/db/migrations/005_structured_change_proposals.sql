CREATE UNIQUE INDEX idx_project_versions_project_id ON project_versions(project_id, id);
CREATE UNIQUE INDEX idx_change_proposals_project_id ON change_proposals(project_id, id);

INSERT OR IGNORE INTO templates (id, version, name, config_json, created_at) VALUES
  ('meeting-notes','1.0.0','会议纪要','{"kind":"material-update-template","label":"会议纪要"}','2026-07-18T00:00:00.000Z'),
  ('project-plan','1.0.0','项目计划','{"kind":"material-update-template","label":"项目计划"}','2026-07-18T00:00:00.000Z'),
  ('progress-report','1.0.0','进度汇报','{"kind":"material-update-template","label":"进度汇报"}','2026-07-18T00:00:00.000Z'),
  ('metrics-data','1.0.0','指标数据','{"kind":"material-update-template","label":"指标数据"}','2026-07-18T00:00:00.000Z'),
  ('outcome-archive','1.0.0','成果归档','{"kind":"material-update-template","label":"成果归档"}','2026-07-18T00:00:00.000Z'),
  ('new-project-material','1.0.0','新项目材料','{"kind":"material-update-template","label":"新项目材料"}','2026-07-18T00:00:00.000Z');

CREATE TABLE material_generation_grants (
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT,
  PRIMARY KEY (project_id, material_id),
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CHECK (enabled = 0 OR (granted_by IS NOT NULL AND granted_at IS NOT NULL))
) STRICT;

INSERT INTO material_generation_grants (project_id, material_id, enabled)
SELECT project_id, id, 0 FROM project_materials;

CREATE TABLE generation_jobs (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_version_id INTEGER NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  schema_version TEXT NOT NULL CHECK (schema_version = 'change-proposal-v1@1.0.0'),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','retrieving_evidence','generating','repairing','validating','succeeded','failed_retryable','failed_terminal','stale')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  lease_owner TEXT,
  lease_expires_at TEXT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  created_by TEXT NOT NULL REFERENCES users(id),
  error_code TEXT,
  validation_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(validation_json)),
  proposal_id TEXT,
  retry_of_job_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, created_by, idempotency_key),
  UNIQUE (project_id, proposal_id),
  FOREIGN KEY (project_id, base_version_id) REFERENCES project_versions(project_id, id),
  FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version),
  FOREIGN KEY (project_id, proposal_id) REFERENCES change_proposals(project_id, id),
  FOREIGN KEY (project_id, retry_of_job_id) REFERENCES generation_jobs(project_id, id),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
) STRICT;

CREATE TABLE generation_job_materials (
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  extraction_version INTEGER NOT NULL CHECK (extraction_version > 0),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 7),
  PRIMARY KEY (project_id, job_id, material_id),
  UNIQUE (project_id, job_id, position),
  FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id)
) STRICT;

CREATE TABLE generation_job_evidence (
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  evidence_external_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  extraction_version INTEGER NOT NULL CHECK (extraction_version > 0),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 47),
  PRIMARY KEY (project_id, job_id, evidence_external_id),
  UNIQUE (project_id, job_id, position),
  FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, job_id, material_id) REFERENCES generation_job_materials(project_id, job_id, material_id),
  FOREIGN KEY (project_id, evidence_external_id) REFERENCES evidence_blocks(project_id, external_id)
) STRICT;

CREATE TABLE generation_attempts (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 8),
  kind TEXT NOT NULL CHECK (kind IN ('initial','transient_retry','structure_repair','manual_retry')),
  outcome TEXT NOT NULL CHECK (outcome IN ('started','succeeded','failed')),
  provider_label TEXT NOT NULL DEFAULT 'disabled' CHECK (length(provider_label) BETWEEN 1 AND 80),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  currency TEXT,
  price_version TEXT,
  cost_micros INTEGER CHECK (cost_micros >= 0),
  cost_status TEXT NOT NULL DEFAULT 'unpriced' CHECK (cost_status IN ('priced','estimated','unpriced')),
  result_code TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  UNIQUE (project_id, job_id, attempt_number),
  FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE change_proposal_items (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  change_id TEXT NOT NULL CHECK (length(change_id) BETWEEN 3 AND 64),
  module_type TEXT NOT NULL CHECK (module_type IN ('overview','units','roadmap','task-network','gantt','outcomes','risks','metrics')),
  operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
  target_external_id TEXT NOT NULL CHECK (length(target_external_id) BETWEEN 1 AND 128),
  semantic_type TEXT NOT NULL CHECK (semantic_type IN ('fact','plan','suggestion','unknown')),
  patch_json TEXT NOT NULL CHECK (json_valid(patch_json) AND json_type(patch_json) = 'object'),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json) AND json_type(warnings_json) = 'array'),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
  PRIMARY KEY (project_id, proposal_id, change_id),
  UNIQUE (project_id, proposal_id, position),
  FOREIGN KEY (project_id, proposal_id) REFERENCES change_proposals(project_id, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE change_proposal_evidence (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  evidence_external_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 47),
  PRIMARY KEY (project_id, proposal_id, change_id, evidence_external_id),
  UNIQUE (project_id, proposal_id, change_id, position),
  FOREIGN KEY (project_id, proposal_id, change_id) REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, evidence_external_id) REFERENCES evidence_blocks(project_id, external_id)
) STRICT;

CREATE INDEX idx_generation_jobs_queue ON generation_jobs(state, lease_expires_at, created_at);
CREATE INDEX idx_generation_jobs_project ON generation_jobs(project_id, created_at DESC);
CREATE INDEX idx_generation_attempts_job ON generation_attempts(project_id, job_id, attempt_number);
CREATE INDEX idx_proposal_items_module ON change_proposal_items(project_id, proposal_id, module_type, position);

CREATE TRIGGER generation_job_base_must_be_current_published
BEFORE INSERT ON generation_jobs
BEGIN
  SELECT RAISE(ABORT, 'generation base must be current published version')
  WHERE NOT EXISTS (
    SELECT 1 FROM projects p
    JOIN project_versions v ON v.id = NEW.base_version_id AND v.project_id = p.id AND v.layer = 'published'
    WHERE p.id = NEW.project_id AND p.published_version_id = NEW.base_version_id
  );
END;

CREATE TRIGGER generation_material_must_be_ready_current
BEFORE INSERT ON generation_job_materials
BEGIN
  SELECT RAISE(ABORT, 'generation material must be ready and current')
  WHERE NOT EXISTS (
    SELECT 1 FROM project_materials m
    JOIN material_generation_grants g ON g.project_id=m.project_id AND g.material_id=m.id AND g.enabled=1
    WHERE m.project_id=NEW.project_id AND m.id=NEW.material_id AND m.status='ready'
      AND m.active_extraction_version=NEW.extraction_version
  );
END;

CREATE TRIGGER generation_evidence_must_match_locked_material
BEFORE INSERT ON generation_job_evidence
BEGIN
  SELECT RAISE(ABORT, 'generation evidence must match locked material generation')
  WHERE NOT EXISTS (
    SELECT 1 FROM evidence_blocks e
    WHERE e.project_id=NEW.project_id AND e.external_id=NEW.evidence_external_id
      AND e.material_id=NEW.material_id AND e.extraction_version=NEW.extraction_version
      AND e.content_hash=NEW.content_hash
  );
END;

CREATE TRIGGER generation_job_proposal_must_match_base
BEFORE UPDATE OF proposal_id ON generation_jobs
WHEN NEW.proposal_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'proposal must match generation job base')
  WHERE NOT EXISTS (
    SELECT 1 FROM change_proposals p
    WHERE p.project_id=NEW.project_id AND p.id=NEW.proposal_id
      AND p.base_version_id=NEW.base_version_id AND p.schema_version=NEW.schema_version
  );
END;
