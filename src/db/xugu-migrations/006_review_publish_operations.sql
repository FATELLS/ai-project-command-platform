-- 虚谷版本 — Review, Publish & Operations
-- 从 SQLite 006 + 007 转换

CREATE TABLE proposal_review_items (
  project_id VARCHAR(128) NOT NULL,
  proposal_id VARCHAR(128) NOT NULL,
  change_id VARCHAR(64) NOT NULL,
  decision VARCHAR(20) NOT NULL DEFAULT 'pending',
  edited_patch_json CLOB,
  note VARCHAR(500) NOT NULL DEFAULT '',
  reviewed_by VARCHAR(128),
  reviewed_at VARCHAR(40),
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_proposal_review_items PRIMARY KEY (project_id, proposal_id, change_id),
  CONSTRAINT chk_pri_decision CHECK (decision IN ('pending','accepted','rejected')),
  CONSTRAINT chk_pri_edited CHECK (edited_patch_json IS NULL OR (JSON_VALID(edited_patch_json)=1 AND JSON_TYPE(edited_patch_json)='object')),
  CONSTRAINT chk_pri_note CHECK (LENGTH(note) <= 500),
  CONSTRAINT chk_pri_logic1 CHECK ((decision='pending') = (reviewed_by IS NULL AND reviewed_at IS NULL)),
  CONSTRAINT chk_pri_logic2 CHECK (decision!='rejected' OR edited_patch_json IS NULL),
  CONSTRAINT fk_pri_item FOREIGN KEY (project_id, proposal_id, change_id) REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
  CONSTRAINT fk_pri_user FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- 迁移已有 proposal items 的 review items
INSERT INTO proposal_review_items (project_id,proposal_id,change_id,updated_at)
SELECT project_id,proposal_id,change_id,'2026-07-18T00:00:00.000Z'
FROM change_proposal_items;

CREATE TRIGGER create_pending_review_item
AFTER INSERT ON change_proposal_items
REFERENCING NEW AS NEW
BEGIN
  INSERT INTO proposal_review_items (project_id,proposal_id,change_id,updated_at)
  VALUES (NEW.project_id,NEW.proposal_id,NEW.change_id, TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DDTHH24:MI:SS.FF3') || 'Z');
END;

CREATE TABLE proposal_merges (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  proposal_id VARCHAR(128) NOT NULL,
  source_draft_version_id INTEGER NOT NULL,
  result_draft_version_id INTEGER NOT NULL,
  accepted_count INTEGER NOT NULL,
  rejected_count INTEGER NOT NULL,
  merged_by VARCHAR(128) NOT NULL,
  merged_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_proposal_merges PRIMARY KEY (project_id, id),
  CONSTRAINT chk_pm_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_pm_acc CHECK (accepted_count BETWEEN 1 AND 100),
  CONSTRAINT chk_pm_rej CHECK (rejected_count BETWEEN 0 AND 100),
  CONSTRAINT uq_pm_proposal UNIQUE (project_id, proposal_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_proposal FOREIGN KEY (project_id, proposal_id) REFERENCES change_proposals(project_id, id),
  CONSTRAINT fk_pm_src FOREIGN KEY (project_id, source_draft_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_pm_res FOREIGN KEY (project_id, result_draft_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_pm_user FOREIGN KEY (merged_by) REFERENCES users(id)
);

CREATE TABLE publication_events (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  action VARCHAR(20) NOT NULL,
  from_published_version_id INTEGER NOT NULL,
  to_published_version_id INTEGER NOT NULL,
  source_draft_version_id INTEGER,
  previous_event_id VARCHAR(128),
  version_label VARCHAR(80) NOT NULL,
  checklist_json CLOB NOT NULL DEFAULT '{}',
  created_by VARCHAR(128) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_publication_events PRIMARY KEY (project_id, id),
  CONSTRAINT chk_pe_id CHECK (LENGTH(id) BETWEEN 16 AND 128),
  CONSTRAINT chk_pe_action CHECK (action IN ('publish','rollback')),
  CONSTRAINT chk_pe_label CHECK (LENGTH(version_label) BETWEEN 1 AND 80),
  CONSTRAINT chk_pe_checklist CHECK (JSON_VALID(checklist_json) = 1),
  CONSTRAINT fk_pe_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pe_from FOREIGN KEY (project_id, from_published_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_pe_to FOREIGN KEY (project_id, to_published_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_pe_src FOREIGN KEY (project_id, source_draft_version_id) REFERENCES project_versions(project_id, id),
  CONSTRAINT fk_pe_prev FOREIGN KEY (project_id, previous_event_id) REFERENCES publication_events(project_id, id),
  CONSTRAINT fk_pe_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_review_items_proposal ON proposal_review_items(project_id,proposal_id,decision,change_id);
CREATE INDEX idx_proposal_merges_project ON proposal_merges(project_id,merged_at DESC);
CREATE INDEX idx_publication_events_project ON publication_events(project_id,created_at DESC,id DESC);

CREATE TRIGGER review_item_proposal_must_be_pending
BEFORE UPDATE OF decision,edited_patch_json ON proposal_review_items
REFERENCING NEW AS NEW
BEGIN
  DECLARE v_count INTEGER;
  SELECT COUNT(*) INTO v_count FROM change_proposals p
  WHERE p.project_id=NEW.project_id AND p.id=NEW.proposal_id AND p.status='pending';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only pending proposals can be reviewed';
  END IF;
END;

CREATE TRIGGER proposal_merge_versions_must_be_drafts
BEFORE INSERT ON proposal_merges
REFERENCING NEW AS NEW
BEGIN
  DECLARE v_count1 INTEGER;
  DECLARE v_count2 INTEGER;
  SELECT COUNT(*) INTO v_count1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.source_draft_version_id AND layer='draft';
  SELECT COUNT(*) INTO v_count2 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.result_draft_version_id AND layer='draft';
  IF v_count1 = 0 OR v_count2 = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'proposal merge versions must be project drafts';
  END IF;
END;

CREATE TRIGGER publication_event_versions_must_match_layers
BEFORE INSERT ON publication_events
REFERENCING NEW AS NEW
BEGIN
  DECLARE v_from INTEGER;
  DECLARE v_to INTEGER;
  DECLARE v_src INTEGER;
  SELECT COUNT(*) INTO v_from FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.from_published_version_id AND layer='published';
  SELECT COUNT(*) INTO v_to FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.to_published_version_id AND layer='published';
  IF NEW.source_draft_version_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_src FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.source_draft_version_id AND layer='draft';
  ELSE
    SET v_src = 1;
  END IF;
  IF v_from = 0 OR v_to = 0 OR v_src = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'publication event versions must match project layers';
  END IF;
END;

-- ===== 007: Release, Hardening, Readiness, Observability =====

CREATE TABLE material_readiness_snapshots (
  id INTEGER IDENTITY(1,1),
  project_id VARCHAR(128) NOT NULL,
  material_id VARCHAR(128) NOT NULL,
  extraction_version INTEGER NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  template_version VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  missing_json CLOB NOT NULL DEFAULT '[]',
  warnings_json CLOB NOT NULL DEFAULT '[]',
  evidence_json CLOB NOT NULL DEFAULT '[]',
  suggestion CLOB NOT NULL DEFAULT '',
  created_by VARCHAR(128),
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_material_readiness_snap PRIMARY KEY (id),
  CONSTRAINT chk_mrs_ver CHECK (extraction_version > 0),
  CONSTRAINT chk_mrs_status CHECK (status IN ('ready','warning','blocked')),
  CONSTRAINT chk_mrs_missing CHECK (JSON_VALID(missing_json)=1 AND JSON_TYPE(missing_json)='array'),
  CONSTRAINT chk_mrs_warn CHECK (JSON_VALID(warnings_json)=1 AND JSON_TYPE(warnings_json)='array'),
  CONSTRAINT chk_mrs_evi CHECK (JSON_VALID(evidence_json)=1 AND JSON_TYPE(evidence_json)='array'),
  CONSTRAINT fk_mrs_material FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mrs_template FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version),
  CONSTRAINT fk_mrs_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_material_readiness_current ON material_readiness_snapshots(project_id, material_id, extraction_version, template_id, template_version, id DESC);

CREATE TABLE operation_traces (
  id VARCHAR(80) NOT NULL,
  parent_id VARCHAR(80),
  request_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(128),
  user_id VARCHAR(128),
  operation VARCHAR(120) NOT NULL,
  target_type VARCHAR(64) NOT NULL DEFAULT '',
  target_id VARCHAR(128),
  status VARCHAR(20) NOT NULL,
  metadata_json CLOB NOT NULL DEFAULT '{}',
  started_at VARCHAR(40) NOT NULL,
  finished_at VARCHAR(40),
  CONSTRAINT pk_operation_traces PRIMARY KEY (id),
  CONSTRAINT chk_ot_id CHECK (LENGTH(id) BETWEEN 16 AND 80),
  CONSTRAINT chk_ot_req CHECK (LENGTH(request_id) BETWEEN 16 AND 80),
  CONSTRAINT chk_ot_op CHECK (LENGTH(operation) BETWEEN 1 AND 120),
  CONSTRAINT chk_ot_status CHECK (status IN ('started','succeeded','failed')),
  CONSTRAINT chk_ot_meta CHECK (JSON_VALID(metadata_json) = 1),
  CONSTRAINT fk_ot_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_ot_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_operation_traces_request ON operation_traces(request_id, started_at DESC);
CREATE INDEX idx_operation_traces_project ON operation_traces(project_id, started_at DESC);

CREATE TABLE error_events (
  id VARCHAR(80) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  trace_id VARCHAR(80),
  project_id VARCHAR(128),
  user_id VARCHAR(128),
  method VARCHAR(10) NOT NULL DEFAULT '',
  route VARCHAR(256) NOT NULL DEFAULT '',
  status INTEGER NOT NULL,
  code VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  stack_fingerprint VARCHAR(64) NOT NULL,
  stack_redacted CLOB NOT NULL,
  context_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_error_events PRIMARY KEY (id),
  CONSTRAINT chk_ee_id CHECK (LENGTH(id) BETWEEN 16 AND 80),
  CONSTRAINT chk_ee_req CHECK (LENGTH(request_id) BETWEEN 16 AND 80),
  CONSTRAINT chk_ee_status CHECK (status BETWEEN 400 AND 599),
  CONSTRAINT chk_ee_code CHECK (LENGTH(code) BETWEEN 1 AND 120),
  CONSTRAINT chk_ee_msg CHECK (LENGTH(message) BETWEEN 1 AND 500),
  CONSTRAINT chk_ee_fp CHECK (LENGTH(stack_fingerprint) = 64),
  CONSTRAINT chk_ee_stack CHECK (LENGTH(stack_redacted) <= 12000),
  CONSTRAINT chk_ee_ctx CHECK (JSON_VALID(context_json) = 1),
  CONSTRAINT fk_ee_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_ee_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_error_events_request ON error_events(request_id, created_at DESC);
CREATE INDEX idx_error_events_project ON error_events(project_id, created_at DESC);
CREATE INDEX idx_error_events_code ON error_events(code, created_at DESC);

CREATE TABLE product_test_runs (
  id VARCHAR(80) NOT NULL,
  project_id VARCHAR(128),
  suite_id VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  requested_by VARCHAR(128) NOT NULL,
  summary_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  finished_at VARCHAR(40),
  CONSTRAINT pk_product_test_runs PRIMARY KEY (id),
  CONSTRAINT chk_ptr_id CHECK (LENGTH(id) BETWEEN 16 AND 80),
  CONSTRAINT chk_ptr_suite CHECK (LENGTH(suite_id) BETWEEN 1 AND 80),
  CONSTRAINT chk_ptr_status CHECK (status IN ('running','passed','failed')),
  CONSTRAINT chk_ptr_summary CHECK (JSON_VALID(summary_json) = 1),
  CONSTRAINT fk_ptr_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_ptr_user FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE TABLE product_test_case_results (
  run_id VARCHAR(80) NOT NULL,
  case_id VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  request_id VARCHAR(80),
  message CLOB NOT NULL DEFAULT '',
  details_json CLOB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL,
  CONSTRAINT pk_product_test_case_res PRIMARY KEY (run_id, case_id),
  CONSTRAINT chk_ptcr_id CHECK (LENGTH(case_id) BETWEEN 1 AND 120),
  CONSTRAINT chk_ptcr_status CHECK (status IN ('passed','failed','skipped')),
  CONSTRAINT chk_ptcr_dur CHECK (duration_ms >= 0),
  CONSTRAINT chk_ptcr_pos CHECK (position BETWEEN 0 AND 999),
  CONSTRAINT chk_ptcr_det CHECK (JSON_VALID(details_json) = 1),
  CONSTRAINT fk_ptcr_run FOREIGN KEY (run_id) REFERENCES product_test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_test_runs_project ON product_test_runs(project_id, created_at DESC);
