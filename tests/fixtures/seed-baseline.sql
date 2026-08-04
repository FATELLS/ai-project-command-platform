-- ==========================================================================
-- seed-baseline.sql
-- Sanitized fixture data for integration tests.
--
-- Contains NO real names, emails, company names, or project identifiers.
-- The stable external ID "xugu-agentic-group" is retained as a business
-- project identifier (per REFACTOR-PLAN §4.1 product invariants).
-- ==========================================================================

-- Identity
INSERT INTO users (id, display_name, login_name, password_salt, password_hash, status, is_platform_admin, must_reset_password)
VALUES
    ('user-admin-01', 'Platform Admin', 'admin', '$2b$10$mocksalt000000000000000000000000000000000000000000', '$2b$10$mockhash000000000000000000000000000000000000000000', 'active', TRUE, FALSE),
    ('user-editor-01', 'Project Editor Alpha', 'editor_a', '$2b$10$mocksalt000000000000000000000000000000000000000001', '$2b$10$mockhash000000000000000000000000000000000000000001', 'active', FALSE, FALSE),
    ('user-viewer-01', 'Project Viewer Beta', 'viewer_b', '$2b$10$mocksalt000000000000000000000000000000000000000002', '$2b$10$mockhash000000000000000000000000000000000000000002', 'active', FALSE, FALSE);

-- Templates
INSERT INTO templates (id, version, name, config_json)
VALUES
    ('standard-project', '1.0.0', 'Standard Project Template', '{"modules":["overview","roadmap","units","task-network","gantt","outcomes","risks","metrics","materials"]}'::jsonb),
    ('meeting-notes', '1.0.0', 'Meeting Notes Material Update', '{"type":"material-update"}'::jsonb),
    ('progress-report', '1.0.0', 'Progress Report Material Update', '{"type":"material-update"}'::jsonb);

-- Projects (stable external ID: xugu-agentic-group)
INSERT INTO projects (id, name, template_id, template_version, status)
VALUES ('xugu-agentic-group', 'Agentic Group Schedule', 'standard-project', '1.0.0', 'active');

-- Project versions (IDs will be auto-generated; use RETURNING in real code)
INSERT INTO project_versions (project_id, layer, version_label)
VALUES ('xugu-agentic-group', 'published', 'v1.0.0'),
       ('xugu-agentic-group', 'draft', 'draft-001')
RETURNING id;
-- Expected: published_version_id = 1, draft_version_id = 2

-- Link project version pointers
UPDATE projects SET published_version_id = 1, draft_version_id = 2 WHERE id = 'xugu-agentic-group';

-- Project members
INSERT INTO project_members (project_id, user_id, role)
VALUES
    ('xugu-agentic-group', 'user-admin-01', 'platform_admin'),
    ('xugu-agentic-group', 'user-editor-01', 'project_editor'),
    ('xugu-agentic-group', 'user-viewer-01', 'viewer');

-- Project modules for published version
INSERT INTO project_modules (version_id, external_id, module_type, position, enabled, data_json)
VALUES
    (1, 'mod-overview', 'overview', 0, TRUE, '{}'::jsonb),
    (1, 'mod-roadmap', 'roadmap', 1, TRUE, '{}'::jsonb),
    (1, 'mod-units', 'units', 2, TRUE, '{}'::jsonb),
    (1, 'mod-tasks', 'task-network', 3, TRUE, '{}'::jsonb),
    (1, 'mod-gantt', 'gantt', 4, TRUE, '{}'::jsonb),
    (1, 'mod-outcomes', 'outcomes', 5, TRUE, '{}'::jsonb),
    (1, 'mod-risks', 'risks', 6, TRUE, '{}'::jsonb),
    (1, 'mod-metrics', 'metrics', 7, TRUE, '{}'::jsonb),
    (1, 'mod-materials', 'materials', 8, TRUE, '{}'::jsonb);

-- Project cards (unified graph model)
INSERT INTO project_cards (version_id, external_id, element_type, position, title, owner, state, progress, health)
VALUES
    (1, 'card-overview', 'overview', 0, 'Project Overview', 'user-admin-01', 'active', NULL, 'green'),
    (1, 'card-unit-01', 'unit', 0, 'Unit Alpha', 'user-editor-01', 'in-progress', 60, 'green'),
    (1, 'card-unit-02', 'unit', 1, 'Unit Beta', 'user-editor-01', 'planned', 0, 'green'),
    (1, 'card-task-01', 'task', 0, 'Task 001', 'user-editor-01', 'done', 100, 'green'),
    (1, 'card-task-02', 'task', 1, 'Task 002', 'user-editor-01', 'in-progress', 50, 'yellow'),
    (1, 'card-milestone-01', 'milestone', 0, 'Milestone M1', 'user-admin-01', 'reached', 100, 'green'),
    (1, 'card-outcome-01', 'outcome', 0, 'Deliverable A', 'user-admin-01', 'targeted', 30, 'green'),
    (1, 'card-risk-01', 'risk', 0, 'Schedule Risk', 'user-admin-01', 'open', 0, 'red');

-- Project card links
INSERT INTO project_card_links (version_id, card_external_id, depends_on_external_id, relation_type, position)
VALUES
    (1, 'card-unit-02', 'card-unit-01', 'depends_on', 0),
    (1, 'card-task-02', 'card-task-01', 'depends_on', 0),
    (1, 'card-milestone-01', 'card-task-01', 'depends_on', 0);

-- Platform settings
INSERT INTO platform_settings (key, value_json, updated_by)
VALUES
    ('ai.chat', '{"provider":"disabled","baseUrl":"","apiKey":"","model":""}'::jsonb, 'user-admin-01'),
    ('ai.generation', '{"provider":"disabled","baseUrl":"","apiKey":"","model":""}'::jsonb, 'user-admin-01'),
    ('ai.vision', '{"provider":"disabled","baseUrl":"","apiKey":"","model":""}'::jsonb, 'user-admin-01');

-- ==========================================================================
-- NOTE: This fixture is intentionally minimal. It covers:
-- - 3 users (1 admin, 1 editor, 1 viewer)
-- - 1 project with published + draft versions
-- - 9 project modules (full set)
-- - 8 project cards across 6 element types
-- - 3 card links
-- - 3 platform settings (all disabled)
-- ==========================================================================
