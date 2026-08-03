-- 虚谷版本 — Structured Change Proposals
-- Structured change proposal schema.

CREATE UNIQUE INDEX idx_project_versions_project_id ON project_versions(project_id, id);
CREATE unique index idx_change_proposals_project_id ON change_proposals(project_id, id);

-- 插入 material-update 模板
MERGE INTO templates t
USING (SELECT 'meeting-notes' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='meeting-notes' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('meeting-notes', '1.0.0', '会议纪要', '{"kind":"material-update-template","label":"会议纪要"}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'project-plan' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='project-plan' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('project-plan', '1.0.0', '项目计划', '{"kind":"material-update-template","label":"项目计划"}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'progress-report' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='progress-report' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('progress-report', '1.0.0', '进度汇报', '{"kind":"material-update-template","label":"进度汇报"}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'metrics-data' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='metrics-data' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('metrics-data', '1.0.0', '指标数据', '{"kind":"material-update-template","label":"指标数据"}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'outcome-archive' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='outcome-archive' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('outcome-archive', '1.0.0', '成果归档', '{"kind":"material-update-template","label":"成果归档"}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'new-project-material' AS id, '1.0.0' AS version FROM dual WHERE NOT EXISTS (SELECT 1 FROM templates WHERE id='new-project-material' AND version='1.0.0')) src
ON (t.id = src.id AND t.version = src.version AND src.id IS NOT NULL)
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('new-project-material', '1.0.0', '新项目材料', '{"kind":"material-update-template","label":"新项目材料"}', '2026-07-18T00:00:00.000Z');

CREATE TABLE material_generation_grants (
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  granted_by VARCHAR(128),
  granted_at VARCHAR(40),
  CONSTRAINT pk_material_gen_grants PRIMARY KEY (project_id, material_id),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_mgg_enabled CHECK (enabled IN (0, 1)),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_mgg_logic CHECK (enabled = 0 OR (granted_by IS NOT NULL AND granted_at IS NOT NULL)),
  CONSTRAINT fk_mgg_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mgg_user FOREIGN KEY (granted_by) REFERENCES users(id)
);

INSERT INTO material_generation_grants (project_id, material_id, enabled)
SELECT project_id, id, 0 FROM project_materials;

CREATE TABLE generation_jobs (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  base_version_id INTEGER NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  template_version VARCHAR(64) NOT NULL,
  schema_version VARCHAR(64) NOT NULL,
  state VARCHAR(30) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_owner VARCHAR(128),
  lease_expires_at VARCHAR(40),
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  error_code VARCHAR(128),
  validation_json CLOB NOT NULL DEFAULT '{}',
  proposal_id VARCHAR(128),
  retry_of_job_id VARCHAR(128),
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_generation_jobs PRIMARY KEY (project_id, id),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_id CHECK (LENGTH(id) >= 16 AND LENGTH(id) <= 128),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_schema CHECK (schema_version = 'change-proposal-v1@1.0.0'),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_state CHECK (state IN ('queued','retrieving_evidence','generating','repairing','validating','succeeded','failed_retryable','failed_terminal','stale')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_attempts CHECK (attempts >= 0 AND attempts <= 8),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_idem CHECK (LENGTH(idempotency_key) >= 8 AND LENGTH(idempotency_key) <= 128),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gj_hash CHECK (LENGTH(request_hash) = 64),
  -- [SKIPPED: 虚谷不支持布尔等值比较 CHECK]
  -- CONSTRAINT chk_gj_lease CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)),
  CONSTRAINT uq_gj_idem UNIQUE (project_id, created_by, idempotency_key),
  CONSTRAINT uq_gj_proposal UNIQUE (project_id, proposal_id),
  CONSTRAINT fk_gj_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_gj_base FOREIGN KEY (project_id, base_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_gj_template FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version),
  CONSTRAINT fk_gj_proposal FOREIGN KEY (project_id, proposal_id) REFERENCES change_proposals(project_id, id),
  CONSTRAINT fk_gj_retry FOREIGN KEY (project_id, retry_of_job_id) REFERENCES generation_jobs(project_id, id)
);

CREATE TABLE generation_job_materials (
  project_id VARCHAR(128) NOT NULL,
  job_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  extraction_version INTEGER NOT NULL,
  position INTEGER NOT NULL,
  readiness_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_generation_job_mat PRIMARY KEY (project_id, job_id, material_id),
  CONSTRAINT uq_gjm_pos UNIQUE (project_id, job_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gjm_ver CHECK (extraction_version > 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gjm_pos CHECK (position >= 0 AND position <= 7),
  CONSTRAINT fk_gjm_job FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_gjm_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id)
);

CREATE TABLE generation_job_evidence (
  project_id VARCHAR(128) NOT NULL,
  job_id VARCHAR(128) NOT NULL,
  evidence_external_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  extraction_version INTEGER NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  position INTEGER NOT NULL,
  CONSTRAINT pk_generation_job_evi PRIMARY KEY (project_id, job_id, evidence_external_id),
  CONSTRAINT uq_gje_pos UNIQUE (project_id, job_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gje_ver CHECK (extraction_version > 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gje_hash CHECK (LENGTH(content_hash) = 64),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_gje_pos CHECK (position >= 0 AND position <= 47),
  CONSTRAINT fk_gje_job FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_gje_mat FOREIGN KEY (project_id, job_id, material_id) REFERENCES generation_job_materials(project_id, job_id, material_id),
  CONSTRAINT fk_gje_evi FOREIGN KEY (project_id, evidence_external_id) REFERENCES evidence_blocks(project_id, external_id)
);

CREATE TABLE generation_attempts (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  job_id VARCHAR(128) NOT NULL,
  attempt_number INTEGER NOT NULL,
  kind VARCHAR(30) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  provider_label VARCHAR(80) NOT NULL DEFAULT 'disabled',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(10),
  price_version VARCHAR(40),
  cost_micros INTEGER,
  cost_status VARCHAR(20) NOT NULL DEFAULT 'unpriced',
  result_code VARCHAR(128),
  created_at VARCHAR(40) NOT NULL,
  finished_at VARCHAR(40),
  CONSTRAINT pk_generation_attempts PRIMARY KEY (id),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_id CHECK (LENGTH(id) >= 16 AND LENGTH(id) <= 128),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_num CHECK (attempt_number >= 1 AND attempt_number <= 8),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_kind CHECK (kind IN ('initial','transient_retry','structure_repair','manual_retry')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_outcome CHECK (outcome IN ('started','succeeded','failed')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_plabel CHECK (LENGTH(provider_label) >= 1 AND LENGTH(provider_label) <= 80),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_itok CHECK (input_tokens >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_otok CHECK (output_tokens >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_lat CHECK (latency_ms >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_cost CHECK (cost_micros IS NULL OR cost_micros >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_ga_cstatus CHECK (cost_status IN ('priced','estimated','unpriced')),
  CONSTRAINT uq_ga_job UNIQUE (project_id, job_id, attempt_number),
  CONSTRAINT fk_ga_job FOREIGN KEY (project_id, job_id) REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE
);

CREATE TABLE change_proposal_items (
  project_id VARCHAR(128) NOT NULL,
  proposal_id VARCHAR(128) NOT NULL,
  change_id VARCHAR(64) NOT NULL,
  module_type VARCHAR(40) NOT NULL,
  operation VARCHAR(20) NOT NULL,
  target_external_id VARCHAR(128) NOT NULL,
  semantic_type VARCHAR(20) NOT NULL,
  patch_json CLOB NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  warnings_json CLOB NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL,
  CONSTRAINT pk_change_proposal_items PRIMARY KEY (project_id, proposal_id, change_id),
  CONSTRAINT uq_cpi_pos UNIQUE (project_id, proposal_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_cid CHECK (LENGTH(change_id) >= 3 AND LENGTH(change_id) <= 64),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_module CHECK (module_type IN ('overview','units','roadmap','task-network','gantt','outcomes','risks','metrics')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_op CHECK (operation IN ('create','update','delete')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_tid CHECK (LENGTH(target_external_id) >= 1 AND LENGTH(target_external_id) <= 128),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_stype CHECK (semantic_type IN ('fact','plan','suggestion','unknown')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_conf CHECK (confidence BETWEEN 0.0 AND 1.0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpi_pos CHECK (position >= 0 AND position <= 99),
  CONSTRAINT fk_cpi_proposal FOREIGN KEY (project_id, proposal_id) REFERENCES change_proposals(project_id, id) ON DELETE CASCADE
);

CREATE TABLE change_proposal_evidence (
  project_id VARCHAR(128) NOT NULL,
  proposal_id VARCHAR(128) NOT NULL,
  change_id VARCHAR(64) NOT NULL,
  evidence_external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  CONSTRAINT pk_change_proposal_evi PRIMARY KEY (project_id, proposal_id, change_id, evidence_external_id),
  CONSTRAINT uq_cpe_pos UNIQUE (project_id, proposal_id, change_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cpe_pos CHECK (position >= 0 AND position <= 47),
  CONSTRAINT fk_cpe_item FOREIGN KEY (project_id, proposal_id, change_id) REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
  CONSTRAINT fk_cpe_evi FOREIGN KEY (project_id, evidence_external_id) REFERENCES evidence_blocks(project_id, external_id)
);

CREATE INDEX idx_generation_jobs_queue ON generation_jobs(state, lease_expires_at, created_at);
CREATE INDEX idx_generation_jobs_project ON generation_jobs(project_id, created_at DESC);
CREATE INDEX idx_generation_attempts_job ON generation_attempts(project_id, job_id, attempt_number);
CREATE INDEX idx_proposal_items_module ON change_proposal_items(project_id, proposal_id, module_type, position);

-- 触发器 (使用 SIGNAL SQLSTATE 替代 RAISE)
-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER generation_job_base_must_be_current_published
-- BEFORE INSERT ON generation_jobs
-- REFERENCING NEW AS NEW
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count
--   FROM projects p
--   JOIN project_versions v ON v.id = NEW.base_version_id AND v.project_id = p.id AND v.layer = 'published'
--   WHERE p.id = NEW.project_id AND p.published_version_id = NEW.base_version_id;
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'generation base must be current published version';
--   END IF;
-- END;  [orphaned from trigger commenting]

-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER generation_material_must_be_ready_current
-- BEFORE INSERT ON generation_job_materials
-- REFERENCING NEW AS NEW
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count
--   FROM project_materials m
--   JOIN material_generation_grants g ON g.project_id=m.project_id AND g.material_id=m.id AND g.enabled=1
--   WHERE m.project_id=NEW.project_id AND m.id=NEW.material_id AND m.status='ready'
--     AND m.active_extraction_version=NEW.extraction_version;
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'generation material must be ready and current';
--   END IF;
-- END;  [orphaned from trigger commenting]

-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER generation_evidence_must_match_locked_material
-- BEFORE INSERT ON generation_job_evidence
-- REFERENCING NEW AS NEW
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count
--   FROM evidence_blocks e
--   WHERE e.project_id=NEW.project_id AND e.external_id=NEW.evidence_external_id
--     AND e.material_id=NEW.material_id AND e.extraction_version=NEW.extraction_version
--     AND e.content_hash=NEW.content_hash;
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'generation evidence must match locked material generation';
--   END IF;
-- END;  [orphaned from trigger commenting]

-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER generation_job_proposal_must_match_base
-- BEFORE UPDATE OF proposal_id ON generation_jobs
-- REFERENCING NEW AS NEW
-- WHEN NEW.proposal_id IS NOT NULL
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count
--   FROM change_proposals p
--   WHERE p.project_id=NEW.project_id AND p.id=NEW.proposal_id
--     AND p.base_version_id=NEW.base_version_id AND p.schema_version=NEW.schema_version;
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'proposal must match generation job base';
--   END IF;
-- END;  [orphaned from trigger commenting]
