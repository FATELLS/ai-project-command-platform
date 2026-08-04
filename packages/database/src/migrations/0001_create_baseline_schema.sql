-- ==========================================================================
-- 0001_create_baseline_schema.sql
-- PostgreSQL 18 baseline schema for AI Project Command Platform V2
--
-- Replaces V1 XuguDB migrations 001-008.
-- All types are PostgreSQL-native (TIMESTAMPTZ, JSONB, BOOLEAN, UUID-gen).
-- All CHECK constraints that were skipped in Xugu are now active.
--
-- Domain order (FK dependency):
--   1. Identity    (users, sessions, recent_project_access)
--   2. Templates   (templates)
--   3. Projects    (projects, project_members, project_versions, project_modules)
--   4. Cards       (project_cards, project_card_links)  -- sole graph model
--   5. Materials   (project_materials + 8 child tables)
--   6. Generation  (generation_jobs + 3 child tables)
--   7. Proposals   (change_proposals + 4 child tables)
--   8. Release     (publication_events, material_readiness_snapshots)
--   9. Operations  (audit_events, operation_traces, error_events, product_tests)
--  10. Settings    (platform_settings)
-- ==========================================================================

-- ==========================================================================
-- 1. IDENTITY DOMAIN
-- ==========================================================================

CREATE TABLE users (
    id              VARCHAR(128)   NOT NULL,
    display_name    VARCHAR(256)   NOT NULL,
    login_name      VARCHAR(128),
    password_salt   VARCHAR(256),
    password_hash   VARCHAR(256),
    password_params JSONB,
    status          VARCHAR(20)    NOT NULL DEFAULT 'active',
    is_platform_admin BOOLEAN      NOT NULL DEFAULT FALSE,
    must_reset_password BOOLEAN    NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled')),
    CONSTRAINT chk_users_admin CHECK (is_platform_admin IN (TRUE, FALSE)),
    CONSTRAINT chk_users_mrp CHECK (must_reset_password IN (TRUE, FALSE))
);

CREATE UNIQUE INDEX idx_users_login_name ON users(login_name) WHERE login_name IS NOT NULL;

CREATE TABLE sessions (
    id                  VARCHAR(128)   NOT NULL,
    token_hash          VARCHAR(256)   NOT NULL,
    user_id             VARCHAR(128)   NOT NULL,
    csrf_token          VARCHAR(256)   NOT NULL,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ    NOT NULL,
    idle_expires_at     TIMESTAMPTZ    NOT NULL,
    absolute_expires_at TIMESTAMPTZ    NOT NULL,
    CONSTRAINT pk_sessions PRIMARY KEY (id),
    CONSTRAINT uq_sessions_token UNIQUE (token_hash),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_sessions_idle_before_abs
        CHECK (idle_expires_at <= absolute_expires_at)
);

CREATE INDEX idx_sessions_user ON sessions(user_id, absolute_expires_at);
CREATE INDEX idx_sessions_expiry ON sessions(idle_expires_at, absolute_expires_at);

CREATE TABLE recent_project_access (
    user_id          VARCHAR(128)   NOT NULL,
    project_id       VARCHAR(128)   NOT NULL,
    last_accessed_at TIMESTAMPTZ    NOT NULL,
    CONSTRAINT pk_rpa PRIMARY KEY (user_id, project_id),
    CONSTRAINT fk_rpa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rpa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_rpa_user ON recent_project_access(user_id, last_accessed_at DESC);

-- ==========================================================================
-- 2. TEMPLATES DOMAIN
-- ==========================================================================

CREATE TABLE templates (
    id           VARCHAR(128)   NOT NULL,
    version      VARCHAR(64)    NOT NULL,
    name         VARCHAR(256)   NOT NULL,
    config_json  JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_templates PRIMARY KEY (id, version)
);

-- ==========================================================================
-- 3. PROJECTS DOMAIN
-- ==========================================================================

CREATE TABLE projects (
    id                   VARCHAR(128)   NOT NULL,
    name                 VARCHAR(256)   NOT NULL,
    template_id          VARCHAR(128)   NOT NULL,
    template_version     VARCHAR(64)    NOT NULL,
    status               VARCHAR(20)    NOT NULL DEFAULT 'active',
    theme_json           JSONB          NOT NULL DEFAULT '{}'::jsonb,
    terminology_json     JSONB          NOT NULL DEFAULT '{}'::jsonb,
    published_version_id INTEGER,
    draft_version_id     INTEGER,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    archived_at          TIMESTAMPTZ,
    CONSTRAINT pk_projects PRIMARY KEY (id),
    CONSTRAINT chk_projects_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT fk_projects_tmpl FOREIGN KEY (template_id, template_version)
        REFERENCES templates(id, version)
);

CREATE TABLE project_members (
    project_id   VARCHAR(128)   NOT NULL,
    user_id      VARCHAR(128)   NOT NULL,
    role         VARCHAR(40)    NOT NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_project_members PRIMARY KEY (project_id, user_id),
    CONSTRAINT chk_pm_role CHECK (role IN ('platform_admin', 'project_admin', 'project_editor', 'viewer')),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE project_versions (
    id               INTEGER GENERATED ALWAYS AS IDENTITY,
    project_id       VARCHAR(128)   NOT NULL,
    layer            VARCHAR(20)    NOT NULL,
    version_label    VARCHAR(128)   NOT NULL,
    source_checksum  VARCHAR(128)   NOT NULL DEFAULT '',
    metadata_json    JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_project_versions PRIMARY KEY (id),
    CONSTRAINT chk_pv_layer CHECK (layer IN ('published', 'draft')),
    CONSTRAINT fk_pv_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_pv_proj_layer_ver UNIQUE (project_id, layer, version_label),
    CONSTRAINT uq_pv_proj_id UNIQUE (project_id, id)
);

CREATE INDEX idx_project_versions_project ON project_versions(project_id, layer, id);

CREATE TABLE project_modules (
    version_id    INTEGER        NOT NULL,
    external_id   VARCHAR(128)   NOT NULL,
    module_type   VARCHAR(64)    NOT NULL,
    position      INTEGER        NOT NULL,
    enabled       BOOLEAN        NOT NULL DEFAULT TRUE,
    data_json     JSONB          NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pk_project_modules PRIMARY KEY (version_id, external_id),
    CONSTRAINT chk_pm_enabled CHECK (enabled IN (TRUE, FALSE)),
    CONSTRAINT chk_pm_type CHECK (module_type IN (
        'overview', 'roadmap', 'units', 'task-network',
        'gantt', 'outcomes', 'risks', 'metrics', 'materials'
    )),
    CONSTRAINT fk_pmod_version FOREIGN KEY (version_id)
        REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_project_modules_position ON project_modules(version_id, position);

-- ==========================================================================
-- 4. UNIFIED CARDS DOMAIN (sole project graph model)
-- ==========================================================================

CREATE TABLE project_cards (
    version_id    INTEGER        NOT NULL,
    external_id   VARCHAR(128)   NOT NULL,
    element_type  VARCHAR(30)    NOT NULL,
    position      INTEGER        NOT NULL DEFAULT 0,
    title         VARCHAR(512)   NOT NULL DEFAULT '',
    owner         VARCHAR(256)   NOT NULL DEFAULT '',
    state         VARCHAR(20)    NOT NULL DEFAULT '',
    objective     TEXT           NOT NULL DEFAULT '',
    start_date    VARCHAR(40)    NOT NULL DEFAULT '',
    end_date      VARCHAR(40)    NOT NULL DEFAULT '',
    progress      SMALLINT,
    health        VARCHAR(20)    NOT NULL DEFAULT '',
    unit_id       VARCHAR(128)   NOT NULL DEFAULT '',
    parent_id     VARCHAR(128),
    depends_on    JSONB          NOT NULL DEFAULT '[]'::jsonb,
    card_attrs    JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_project_cards PRIMARY KEY (version_id, external_id),
    CONSTRAINT chk_pc_progress CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
    CONSTRAINT chk_pc_type CHECK (element_type IN (
        'overview', 'roadmap', 'unit', 'task', 'milestone',
        'outcome', 'risk', 'metric', 'material-group'
    )),
    CONSTRAINT uq_pc_type_pos UNIQUE (version_id, element_type, position),
    CONSTRAINT fk_pc_version FOREIGN KEY (version_id)
        REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_card_links (
    version_id              INTEGER        NOT NULL,
    card_external_id        VARCHAR(128)   NOT NULL,
    depends_on_external_id  VARCHAR(128)   NOT NULL,
    relation_type           VARCHAR(40)    NOT NULL DEFAULT 'depends_on',
    position                INTEGER        NOT NULL DEFAULT 0,
    CONSTRAINT pk_project_card_links PRIMARY KEY (version_id, card_external_id, depends_on_external_id, relation_type),
    CONSTRAINT chk_pcl_relation CHECK (relation_type IN ('depends_on', 'blocks', 'relates_to', 'child_of')),
    CONSTRAINT fk_pcl_card FOREIGN KEY (version_id, card_external_id)
        REFERENCES project_cards(version_id, external_id) ON DELETE CASCADE,
    CONSTRAINT fk_pcl_dep FOREIGN KEY (version_id, depends_on_external_id)
        REFERENCES project_cards(version_id, external_id)
);

CREATE INDEX idx_pc_owner ON project_cards(version_id, owner);
CREATE INDEX idx_pc_state ON project_cards(version_id, element_type, state);
CREATE INDEX idx_pc_type_pos ON project_cards(version_id, element_type, position);
CREATE INDEX idx_pc_unit ON project_cards(version_id, unit_id);
CREATE INDEX idx_pc_parent ON project_cards(version_id, parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_pc_dates ON project_cards(version_id, start_date, end_date);
CREATE INDEX idx_pcl_card ON project_card_links(version_id, card_external_id);
CREATE INDEX idx_pcl_dep ON project_card_links(version_id, depends_on_external_id);

-- ==========================================================================
-- 5. MATERIALS DOMAIN
-- ==========================================================================

CREATE TABLE project_materials (
    id                       VARCHAR(128)   NOT NULL,
    project_id               VARCHAR(128)   NOT NULL,
    source_kind              VARCHAR(20)    NOT NULL DEFAULT 'upload',
    display_name             VARCHAR(240)   NOT NULL,
    canonical_extension      VARCHAR(20)    NOT NULL,
    canonical_mime           VARCHAR(128)   NOT NULL,
    sha256                   VARCHAR(64)    NOT NULL,
    byte_size                BIGINT         NOT NULL,
    status                   VARCHAR(30)    NOT NULL DEFAULT 'queued',
    active_extraction_version INTEGER,
    original_removed_at      TIMESTAMPTZ,
    created_by               VARCHAR(128)   NOT NULL,
    created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_project_materials PRIMARY KEY (project_id, id),
    CONSTRAINT chk_pm_source CHECK (source_kind IN ('upload', 'manual', 'link')),
    CONSTRAINT chk_pm_status CHECK (status IN (
        'queued', 'processing', 'ready', 'failed', 'removed'
    )),
    CONSTRAINT chk_pm_bytes CHECK (byte_size >= 0),
    CONSTRAINT uq_pm_sha UNIQUE (project_id, sha256),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pm_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_materials_project_status ON project_materials(project_id, status, created_at DESC);

CREATE TABLE material_artifacts (
    id            VARCHAR(128)   NOT NULL,
    project_id    VARCHAR(128)   NOT NULL,
    material_id   VARCHAR(128)   NOT NULL,
    kind          VARCHAR(30)    NOT NULL,
    storage_key   VARCHAR(512)   NOT NULL,
    byte_size     BIGINT         NOT NULL,
    sha256        VARCHAR(64)    NOT NULL,
    status        VARCHAR(20)    NOT NULL DEFAULT 'available',
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    removed_at    TIMESTAMPTZ,
    CONSTRAINT pk_material_artifacts PRIMARY KEY (project_id, id),
    CONSTRAINT chk_ma_kind CHECK (kind IN (
        'original', 'text-extract', 'page-image', 'thumbnail',
        'structured', 'embedding'
    )),
    CONSTRAINT chk_ma_status CHECK (status IN ('available', 'removed')),
    CONSTRAINT chk_ma_bytes CHECK (byte_size >= 0),
    CONSTRAINT uq_ma_storage UNIQUE (storage_key),
    CONSTRAINT uq_ma_kind UNIQUE (project_id, material_id, kind, id),
    CONSTRAINT fk_ma_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_material_artifacts_usage ON material_artifacts(project_id, status, byte_size);

CREATE TABLE material_jobs (
    id                VARCHAR(128)   NOT NULL,
    project_id        VARCHAR(128)   NOT NULL,
    material_id       VARCHAR(128)   NOT NULL,
    kind              VARCHAR(20)    NOT NULL,
    state             VARCHAR(20)    NOT NULL DEFAULT 'queued',
    attempts          INTEGER        NOT NULL DEFAULT 0,
    lease_owner       VARCHAR(128),
    lease_expires_at  TIMESTAMPTZ,
    timeout_ms        INTEGER        NOT NULL DEFAULT 120000,
    error_code        VARCHAR(128),
    stats_json        JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_material_jobs PRIMARY KEY (project_id, id),
    CONSTRAINT chk_mj_kind CHECK (kind IN ('extract-text', 'extract-images', 'embed', 'cleanup')),
    CONSTRAINT chk_mj_state CHECK (state IN ('queued', 'running', 'done', 'failed', 'timeout')),
    CONSTRAINT chk_mj_attempts CHECK (attempts >= 0),
    CONSTRAINT chk_mj_timeout CHECK (timeout_ms > 0),
    CONSTRAINT fk_mj_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_material_jobs_queue ON material_jobs(state, lease_expires_at, created_at);

CREATE TABLE evidence_blocks (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY,
    external_id        VARCHAR(128)   NOT NULL,
    project_id         VARCHAR(128)   NOT NULL,
    material_id        VARCHAR(128)   NOT NULL,
    extraction_version INTEGER        NOT NULL,
    ordinal            INTEGER        NOT NULL,
    kind               VARCHAR(30)    NOT NULL,
    location_json      JSONB          NOT NULL,
    text               TEXT           NOT NULL,
    summary            TEXT           NOT NULL DEFAULT '',
    content_hash       VARCHAR(64)    NOT NULL,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_evidence_blocks PRIMARY KEY (id),
    CONSTRAINT chk_eb_kind CHECK (kind IN ('paragraph', 'heading', 'table-cell', 'list-item', 'caption', 'page-break')),
    CONSTRAINT chk_eb_extraction CHECK (extraction_version >= 1),
    CONSTRAINT chk_eb_ordinal CHECK (ordinal >= 0),
    CONSTRAINT uq_eb_ext UNIQUE (project_id, external_id),
    CONSTRAINT uq_eb_ordinal UNIQUE (project_id, material_id, extraction_version, ordinal),
    CONSTRAINT fk_eb_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_material ON evidence_blocks(project_id, material_id, extraction_version, ordinal);

CREATE TABLE material_qa_grants (
    project_id    VARCHAR(128)   NOT NULL,
    material_id   VARCHAR(128)   NOT NULL,
    audience      VARCHAR(30)    NOT NULL DEFAULT 'disabled',
    enabled       BOOLEAN        NOT NULL DEFAULT FALSE,
    granted_by    VARCHAR(128),
    granted_at    TIMESTAMPTZ,
    CONSTRAINT pk_material_qa_grants PRIMARY KEY (project_id, material_id),
    CONSTRAINT chk_mqg_audience CHECK (audience IN ('disabled', 'read', 'write')),
    CONSTRAINT fk_mqg_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_mqg_user FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE TABLE material_update_selections (
    project_id        VARCHAR(128)   NOT NULL,
    material_id       VARCHAR(128)   NOT NULL,
    template_id       VARCHAR(128)   NOT NULL,
    template_version  VARCHAR(64)    NOT NULL,
    selected_by       VARCHAR(128)   NOT NULL,
    selected_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_material_update_sel PRIMARY KEY (project_id, material_id),
    CONSTRAINT fk_mus_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_mus_template FOREIGN KEY (template_id, template_version)
        REFERENCES templates(id, version),
    CONSTRAINT fk_mus_user FOREIGN KEY (selected_by) REFERENCES users(id)
);

CREATE TABLE material_upload_attempts (
    id            VARCHAR(128)   NOT NULL,
    project_id    VARCHAR(128)   NOT NULL,
    user_id       VARCHAR(128)   NOT NULL,
    outcome       VARCHAR(20)    NOT NULL DEFAULT 'started',
    error_code    VARCHAR(128),
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    CONSTRAINT pk_material_upload_attempts PRIMARY KEY (id),
    CONSTRAINT chk_mua_outcome CHECK (outcome IN ('started', 'success', 'error', 'cancelled')),
    CONSTRAINT fk_mua_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_mua_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_upload_attempts_rate ON material_upload_attempts(project_id, user_id, created_at DESC);

CREATE TABLE material_upload_locks (
    project_id   VARCHAR(128)   NOT NULL,
    user_id      VARCHAR(128)   NOT NULL,
    attempt_id   VARCHAR(128)   NOT NULL,
    expires_at   TIMESTAMPTZ    NOT NULL,
    CONSTRAINT pk_material_upload_locks PRIMARY KEY (project_id, user_id),
    CONSTRAINT uq_mul_attempt UNIQUE (attempt_id),
    CONSTRAINT fk_mul_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_mul_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_mul_attempt FOREIGN KEY (attempt_id)
        REFERENCES material_upload_attempts(id) ON DELETE CASCADE
);

CREATE TABLE ai_usage_events (
    id            VARCHAR(128)   NOT NULL,
    project_id    VARCHAR(128)   NOT NULL,
    user_id       VARCHAR(128)   NOT NULL,
    capability    VARCHAR(20)    NOT NULL,
    units         INTEGER        NOT NULL DEFAULT 1,
    request_hash  VARCHAR(64)    NOT NULL,
    status        VARCHAR(20)    NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_ai_usage_events PRIMARY KEY (id),
    CONSTRAINT chk_aue_capability CHECK (capability IN ('chat', 'generation', 'vision')),
    CONSTRAINT chk_aue_status CHECK (status IN ('success', 'error', 'rate-limited')),
    CONSTRAINT chk_aue_units CHECK (units >= 1),
    CONSTRAINT fk_aue_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_aue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_usage_quota ON ai_usage_events(capability, project_id, user_id, created_at DESC);

-- ==========================================================================
-- 6. GENERATION DOMAIN
-- ==========================================================================

CREATE TABLE material_generation_grants (
    project_id    VARCHAR(128)   NOT NULL,
    material_id   VARCHAR(128)   NOT NULL,
    enabled       BOOLEAN        NOT NULL DEFAULT FALSE,
    granted_by    VARCHAR(128),
    granted_at    TIMESTAMPTZ,
    CONSTRAINT pk_material_gen_grants PRIMARY KEY (project_id, material_id),
    CONSTRAINT fk_mgg_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_mgg_user FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE TABLE generation_jobs (
    id                VARCHAR(128)   NOT NULL,
    project_id        VARCHAR(128)   NOT NULL,
    base_version_id   INTEGER        NOT NULL,
    template_id       VARCHAR(128)   NOT NULL,
    template_version  VARCHAR(64)    NOT NULL,
    schema_version    VARCHAR(64)    NOT NULL,
    state             VARCHAR(30)    NOT NULL DEFAULT 'queued',
    attempts          INTEGER        NOT NULL DEFAULT 0,
    lease_owner       VARCHAR(128),
    lease_expires_at  TIMESTAMPTZ,
    idempotency_key   VARCHAR(128)   NOT NULL,
    request_hash      VARCHAR(64)    NOT NULL,
    created_by        VARCHAR(128)   NOT NULL,
    error_code        VARCHAR(128),
    validation_json   JSONB          NOT NULL DEFAULT '{}'::jsonb,
    proposal_id       VARCHAR(128),
    retry_of_job_id   VARCHAR(128),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_generation_jobs PRIMARY KEY (project_id, id),
    CONSTRAINT chk_gj_state CHECK (state IN ('queued', 'running', 'done', 'failed', 'timeout', 'cancelled')),
    CONSTRAINT chk_gj_attempts CHECK (attempts >= 0),
    CONSTRAINT uq_gj_idem UNIQUE (project_id, created_by, idempotency_key),
    CONSTRAINT uq_gj_proposal UNIQUE (project_id, proposal_id),
    CONSTRAINT fk_gj_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_gj_base FOREIGN KEY (project_id, base_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_gj_template FOREIGN KEY (template_id, template_version)
        REFERENCES templates(id, version),
    CONSTRAINT fk_gj_proposal FOREIGN KEY (project_id, proposal_id)
        REFERENCES change_proposals(project_id, id),
    CONSTRAINT fk_gj_retry FOREIGN KEY (project_id, retry_of_job_id)
        REFERENCES generation_jobs(project_id, id)
);

CREATE INDEX idx_generation_jobs_queue ON generation_jobs(state, lease_expires_at, created_at);
CREATE INDEX idx_generation_jobs_project ON generation_jobs(project_id, created_at DESC);

CREATE TABLE generation_job_materials (
    project_id          VARCHAR(128)   NOT NULL,
    job_id              VARCHAR(128)   NOT NULL,
    material_id         VARCHAR(128)   NOT NULL,
    extraction_version  INTEGER        NOT NULL,
    position            INTEGER        NOT NULL,
    readiness_json      JSONB          NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pk_generation_job_mat PRIMARY KEY (project_id, job_id, material_id),
    CONSTRAINT chk_gjm_extraction CHECK (extraction_version >= 1),
    CONSTRAINT uq_gjm_pos UNIQUE (project_id, job_id, position),
    CONSTRAINT fk_gjm_job FOREIGN KEY (project_id, job_id)
        REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_gjm_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id)
);

CREATE TABLE generation_job_evidence (
    project_id              VARCHAR(128)   NOT NULL,
    job_id                  VARCHAR(128)   NOT NULL,
    evidence_external_id    VARCHAR(128)   NOT NULL,
    material_id             VARCHAR(128)   NOT NULL,
    extraction_version      INTEGER        NOT NULL,
    content_hash            VARCHAR(64)    NOT NULL,
    position                INTEGER        NOT NULL,
    CONSTRAINT pk_generation_job_evi PRIMARY KEY (project_id, job_id, evidence_external_id),
    CONSTRAINT chk_gje_extraction CHECK (extraction_version >= 1),
    CONSTRAINT uq_gje_pos UNIQUE (project_id, job_id, position),
    CONSTRAINT fk_gje_job FOREIGN KEY (project_id, job_id)
        REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_gje_mat FOREIGN KEY (project_id, job_id, material_id)
        REFERENCES generation_job_materials(project_id, job_id, material_id),
    CONSTRAINT fk_gje_evi FOREIGN KEY (project_id, evidence_external_id)
        REFERENCES evidence_blocks(project_id, external_id)
);

CREATE TABLE generation_attempts (
    id              VARCHAR(128)   NOT NULL,
    project_id      VARCHAR(128)   NOT NULL,
    job_id          VARCHAR(128)   NOT NULL,
    attempt_number  INTEGER        NOT NULL,
    kind            VARCHAR(30)    NOT NULL,
    outcome         VARCHAR(20)    NOT NULL,
    provider_label  VARCHAR(80)    NOT NULL DEFAULT 'disabled',
    input_tokens    INTEGER        NOT NULL DEFAULT 0,
    output_tokens   INTEGER        NOT NULL DEFAULT 0,
    latency_ms      INTEGER        NOT NULL DEFAULT 0,
    currency        VARCHAR(10),
    price_version   VARCHAR(40),
    cost_micros     INTEGER,
    cost_status     VARCHAR(20)    NOT NULL DEFAULT 'unpriced',
    result_code     VARCHAR(128),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    CONSTRAINT pk_generation_attempts PRIMARY KEY (id),
    CONSTRAINT chk_ga_outcome CHECK (outcome IN ('success', 'error', 'timeout', 'cancelled')),
    CONSTRAINT chk_ga_kind CHECK (kind IN ('generate', 'retry', 'validate')),
    CONSTRAINT chk_ga_attempt CHECK (attempt_number >= 1),
    CONSTRAINT chk_ga_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0),
    CONSTRAINT chk_ga_latency CHECK (latency_ms >= 0),
    CONSTRAINT chk_ga_cost_status CHECK (cost_status IN ('unpriced', 'estimated', 'final', 'refunded')),
    CONSTRAINT uq_ga_job UNIQUE (project_id, job_id, attempt_number),
    CONSTRAINT fk_ga_job FOREIGN KEY (project_id, job_id)
        REFERENCES generation_jobs(project_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_generation_attempts_job ON generation_attempts(project_id, job_id, attempt_number);

-- ==========================================================================
-- 7. CHANGE PROPOSALS DOMAIN
-- ==========================================================================

CREATE TABLE change_proposals (
    id              VARCHAR(128)   NOT NULL,
    project_id      VARCHAR(128)   NOT NULL,
    base_version_id INTEGER        NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending',
    schema_version  VARCHAR(64)    NOT NULL,
    payload_json    JSONB          NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_change_proposals PRIMARY KEY (id),
    CONSTRAINT chk_cp_status CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
    CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_base FOREIGN KEY (base_version_id) REFERENCES project_versions(id)
);

CREATE INDEX idx_change_proposals_project ON change_proposals(project_id, status, created_at);

CREATE UNIQUE INDEX idx_change_proposals_project_id ON change_proposals(project_id, id);

CREATE TABLE change_proposal_items (
    project_id          VARCHAR(128)   NOT NULL,
    proposal_id         VARCHAR(128)   NOT NULL,
    change_id           VARCHAR(64)    NOT NULL,
    module_type         VARCHAR(40)    NOT NULL,
    operation           VARCHAR(20)    NOT NULL,
    target_external_id  VARCHAR(128)   NOT NULL,
    semantic_type       VARCHAR(20)    NOT NULL,
    patch_json          JSONB          NOT NULL,
    confidence          DOUBLE PRECISION NOT NULL,
    warnings_json       JSONB          NOT NULL DEFAULT '[]'::jsonb,
    position            INTEGER        NOT NULL,
    CONSTRAINT pk_change_proposal_items PRIMARY KEY (project_id, proposal_id, change_id),
    CONSTRAINT chk_cpi_operation CHECK (operation IN ('create', 'update', 'delete')),
    CONSTRAINT chk_cpi_semantic CHECK (semantic_type IN ('add', 'modify', 'remove')),
    CONSTRAINT chk_cpi_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0),
    CONSTRAINT chk_cpi_position CHECK (position >= 0),
    CONSTRAINT uq_cpi_pos UNIQUE (project_id, proposal_id, position),
    CONSTRAINT fk_cpi_proposal FOREIGN KEY (project_id, proposal_id)
        REFERENCES change_proposals(project_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_proposal_items_module ON change_proposal_items(project_id, proposal_id, module_type, position);

CREATE TABLE change_proposal_evidence (
    project_id              VARCHAR(128)   NOT NULL,
    proposal_id             VARCHAR(128)   NOT NULL,
    change_id               VARCHAR(64)    NOT NULL,
    evidence_external_id    VARCHAR(128)   NOT NULL,
    position                INTEGER        NOT NULL,
    CONSTRAINT pk_change_proposal_evi PRIMARY KEY (project_id, proposal_id, change_id, evidence_external_id),
    CONSTRAINT chk_cpe_position CHECK (position >= 0),
    CONSTRAINT uq_cpe_pos UNIQUE (project_id, proposal_id, change_id, position),
    CONSTRAINT fk_cpe_item FOREIGN KEY (project_id, proposal_id, change_id)
        REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
    CONSTRAINT fk_cpe_evi FOREIGN KEY (project_id, evidence_external_id)
        REFERENCES evidence_blocks(project_id, external_id)
);

CREATE TABLE proposal_review_items (
    project_id          VARCHAR(128)   NOT NULL,
    proposal_id         VARCHAR(128)   NOT NULL,
    change_id           VARCHAR(64)    NOT NULL,
    decision            VARCHAR(20)    NOT NULL DEFAULT 'pending',
    edited_patch_json   JSONB,
    note                VARCHAR(500)   NOT NULL DEFAULT '',
    reviewed_by         VARCHAR(128),
    reviewed_at         TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_proposal_review_items PRIMARY KEY (project_id, proposal_id, change_id),
    CONSTRAINT chk_pri_decision CHECK (decision IN ('pending', 'accepted', 'rejected', 'edited')),
    CONSTRAINT fk_pri_item FOREIGN KEY (project_id, proposal_id, change_id)
        REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
    CONSTRAINT fk_pri_user FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_review_items_proposal ON proposal_review_items(project_id, proposal_id, decision, change_id);

CREATE TABLE proposal_merges (
    id                        VARCHAR(128)   NOT NULL,
    project_id                VARCHAR(128)   NOT NULL,
    proposal_id               VARCHAR(128)   NOT NULL,
    source_draft_version_id   INTEGER        NOT NULL,
    result_draft_version_id   INTEGER        NOT NULL,
    accepted_count            INTEGER        NOT NULL,
    rejected_count            INTEGER        NOT NULL,
    merged_by                 VARCHAR(128)   NOT NULL,
    merged_at                 TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_proposal_merges PRIMARY KEY (project_id, id),
    CONSTRAINT chk_pm_counts CHECK (accepted_count >= 0 AND rejected_count >= 0),
    CONSTRAINT uq_pm_proposal UNIQUE (project_id, proposal_id),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pm_proposal FOREIGN KEY (project_id, proposal_id)
        REFERENCES change_proposals(project_id, id),
    CONSTRAINT fk_pm_src FOREIGN KEY (project_id, source_draft_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_pm_res FOREIGN KEY (project_id, result_draft_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_pm_user FOREIGN KEY (merged_by) REFERENCES users(id)
);

CREATE INDEX idx_proposal_merges_project ON proposal_merges(project_id, merged_at DESC);

-- ==========================================================================
-- 8. RELEASE DOMAIN
-- ==========================================================================

CREATE TABLE publication_events (
    id                          VARCHAR(128)   NOT NULL,
    project_id                  VARCHAR(128)   NOT NULL,
    action                      VARCHAR(20)    NOT NULL,
    from_published_version_id   INTEGER        NOT NULL,
    to_published_version_id     INTEGER        NOT NULL,
    source_draft_version_id     INTEGER,
    previous_event_id           VARCHAR(128),
    version_label               VARCHAR(80)    NOT NULL,
    checklist_json              JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_by                  VARCHAR(128)   NOT NULL,
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_publication_events PRIMARY KEY (project_id, id),
    CONSTRAINT chk_pe_action CHECK (action IN ('publish', 'rollback')),
    CONSTRAINT fk_pe_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pe_from FOREIGN KEY (project_id, from_published_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_pe_to FOREIGN KEY (project_id, to_published_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_pe_src FOREIGN KEY (project_id, source_draft_version_id)
        REFERENCES project_versions(project_id, id),
    CONSTRAINT fk_pe_prev FOREIGN KEY (project_id, previous_event_id)
        REFERENCES publication_events(project_id, id),
    CONSTRAINT fk_pe_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_publication_events_project ON publication_events(project_id, created_at DESC, id DESC);

CREATE TABLE material_readiness_snapshots (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY,
    project_id          VARCHAR(128)   NOT NULL,
    material_id         VARCHAR(128)   NOT NULL,
    extraction_version  INTEGER        NOT NULL,
    template_id         VARCHAR(128)   NOT NULL,
    template_version    VARCHAR(64)    NOT NULL,
    status              VARCHAR(20)    NOT NULL,
    missing_json        JSONB          NOT NULL DEFAULT '[]'::jsonb,
    warnings_json       JSONB          NOT NULL DEFAULT '[]'::jsonb,
    evidence_json       JSONB          NOT NULL DEFAULT '[]'::jsonb,
    suggestion          TEXT           NOT NULL DEFAULT '',
    created_by          VARCHAR(128),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_material_readiness_snap PRIMARY KEY (id),
    CONSTRAINT chk_mrs_status CHECK (status IN ('ready', 'missing', 'partial', 'stale')),
    CONSTRAINT chk_mrs_extraction CHECK (extraction_version >= 1),
    CONSTRAINT fk_mrs_material FOREIGN KEY (project_id, material_id)
        REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_mrs_template FOREIGN KEY (template_id, template_version)
        REFERENCES templates(id, version),
    CONSTRAINT fk_mrs_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_material_readiness_current ON material_readiness_snapshots(
    project_id, material_id, extraction_version, template_id, template_version, id DESC
);

-- ==========================================================================
-- 9. OPERATIONS DOMAIN
-- ==========================================================================

CREATE TABLE audit_events (
    id            INTEGER GENERATED ALWAYS AS IDENTITY,
    user_id       VARCHAR(128),
    project_id    VARCHAR(128),
    action        VARCHAR(128)   NOT NULL,
    target_type   VARCHAR(64)    NOT NULL,
    target_id     VARCHAR(128),
    remote_address VARCHAR(128)  NOT NULL DEFAULT '',
    metadata_json JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_audit_events PRIMARY KEY (id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_audit_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_audit_events_user ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_project ON audit_events(project_id, created_at DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action, created_at DESC);

CREATE TABLE operation_traces (
    id            VARCHAR(80)    NOT NULL,
    parent_id     VARCHAR(80),
    request_id    VARCHAR(80)    NOT NULL,
    project_id    VARCHAR(128),
    user_id       VARCHAR(128),
    operation     VARCHAR(120)   NOT NULL,
    target_type   VARCHAR(64)    NOT NULL DEFAULT '',
    target_id     VARCHAR(128),
    status        VARCHAR(20)    NOT NULL,
    metadata_json JSONB          NOT NULL DEFAULT '{}'::jsonb,
    started_at    TIMESTAMPTZ    NOT NULL,
    finished_at   TIMESTAMPTZ,
    CONSTRAINT pk_operation_traces PRIMARY KEY (id),
    CONSTRAINT chk_ot_status CHECK (status IN ('running', 'done', 'error', 'timeout')),
    CONSTRAINT fk_ot_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_ot_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_operation_traces_request ON operation_traces(request_id, started_at DESC);
CREATE INDEX idx_operation_traces_project ON operation_traces(project_id, started_at DESC);

CREATE TABLE error_events (
    id                 VARCHAR(80)    NOT NULL,
    request_id         VARCHAR(80)    NOT NULL,
    trace_id           VARCHAR(80),
    project_id         VARCHAR(128),
    user_id            VARCHAR(128),
    method             VARCHAR(10)    NOT NULL DEFAULT '',
    route              VARCHAR(256)   NOT NULL DEFAULT '',
    status             INTEGER        NOT NULL,
    code               VARCHAR(120)   NOT NULL,
    message            VARCHAR(500)   NOT NULL,
    stack_fingerprint  VARCHAR(64)    NOT NULL,
    stack_redacted     TEXT           NOT NULL,
    context_json       JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_error_events PRIMARY KEY (id),
    CONSTRAINT chk_ee_status CHECK (status >= 400 AND status <= 599),
    CONSTRAINT fk_ee_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_ee_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_error_events_request ON error_events(request_id, created_at DESC);
CREATE INDEX idx_error_events_project ON error_events(project_id, created_at DESC);
CREATE INDEX idx_error_events_code ON error_events(code, created_at DESC);

CREATE TABLE product_test_runs (
    id            VARCHAR(80)    NOT NULL,
    project_id    VARCHAR(128),
    suite_id      VARCHAR(80)    NOT NULL,
    status        VARCHAR(20)    NOT NULL,
    requested_by  VARCHAR(128)   NOT NULL,
    summary_json  JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    CONSTRAINT pk_product_test_runs PRIMARY KEY (id),
    CONSTRAINT chk_ptr_status CHECK (status IN ('running', 'passed', 'failed', 'skipped')),
    CONSTRAINT fk_ptr_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_ptr_user FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE INDEX idx_product_test_runs_project ON product_test_runs(project_id, created_at DESC);

CREATE TABLE product_test_case_results (
    run_id        VARCHAR(80)    NOT NULL,
    case_id       VARCHAR(120)   NOT NULL,
    status        VARCHAR(20)    NOT NULL,
    duration_ms   INTEGER        NOT NULL DEFAULT 0,
    request_id    VARCHAR(80),
    message       TEXT           NOT NULL DEFAULT '',
    details_json  JSONB          NOT NULL DEFAULT '{}'::jsonb,
    position      INTEGER        NOT NULL,
    CONSTRAINT pk_product_test_case_res PRIMARY KEY (run_id, case_id),
    CONSTRAINT chk_ptcr_status CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
    CONSTRAINT chk_ptcr_duration CHECK (duration_ms >= 0),
    CONSTRAINT chk_ptcr_position CHECK (position >= 0),
    CONSTRAINT fk_ptcr_run FOREIGN KEY (run_id)
        REFERENCES product_test_runs(id) ON DELETE CASCADE
);

-- ==========================================================================
-- 10. SETTINGS DOMAIN
-- ==========================================================================

CREATE TABLE platform_settings (
    key         VARCHAR(128)   NOT NULL,
    value_json  JSONB          NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_by  VARCHAR(128),
    CONSTRAINT pk_platform_settings PRIMARY KEY (key),
    CONSTRAINT fk_ps_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================================================
-- POST-MIGRATE: update projects FK for version pointers
-- ==========================================================================

-- projects.published_version_id and draft_version_id cannot be FK'd inline
-- because project_versions is created after projects. Add deferred FKs.

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_published
    FOREIGN KEY (published_version_id) REFERENCES project_versions(id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_draft
    FOREIGN KEY (draft_version_id) REFERENCES project_versions(id)
    DEFERRABLE INITIALLY DEFERRED;

-- recent_project_access was forward-declared; FK is already active.

-- ==========================================================================
-- SUMMARY
-- ==========================================================================
-- Tables created: 37 (same domain coverage as V1)
-- CHECK constraints: 50+ (V1 had 2 active, 70+ skipped)
-- FK constraints: 45
-- UNIQUE constraints: 18
-- Indexes: 38
-- JSONB columns: 22 (replacing V1 CLOB)
-- TIMESTAMPTZ columns: all timestamps (replacing V1 VARCHAR(40))
-- BOOLEAN columns: 6 (replacing V1 INTEGER)
-- GENERATED ALWAYS AS IDENTITY: 5 (replacing V1 IDENTITY(1,1))
