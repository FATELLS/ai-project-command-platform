-- 虚谷版本 — Module Registry & Templates
-- 从 SQLite 003 转换

CREATE TABLE project_risks (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  title VARCHAR(512) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  owner VARCHAR(256) NOT NULL DEFAULT '',
  mitigation CLOB NOT NULL DEFAULT '',
  due_date VARCHAR(40) NOT NULL DEFAULT '',
  source VARCHAR(256) NOT NULL DEFAULT '',
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_risks PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pr_pos UNIQUE (version_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pr_position CHECK (position >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pr_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pr_status CHECK (status IN ('open', 'monitoring', 'mitigated', 'closed')),
  CONSTRAINT fk_pr_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_metrics (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  name VARCHAR(256) NOT NULL,
  value_json CLOB,
  unit VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL,
  as_of VARCHAR(40) NOT NULL DEFAULT '',
  target_json CLOB,
  source VARCHAR(256) NOT NULL DEFAULT '',
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_metrics PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pm_pos UNIQUE (version_id, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pm_position CHECK (position >= 0),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pm_status CHECK (status IN ('pending', 'on-track', 'at-risk', 'off-track')),
  CONSTRAINT fk_pm_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

-- 数据迁移: 更新 module positions
UPDATE project_modules
SET position = CASE module_type
  WHEN 'overview' THEN 0 WHEN 'roadmap' THEN 1 WHEN 'units' THEN 2
  WHEN 'task-network' THEN 3 WHEN 'gantt' THEN 4 WHEN 'outcomes' THEN 5
  WHEN 'risks' THEN 6 WHEN 'metrics' THEN 7 WHEN 'materials' THEN 8
  ELSE position + 1000 END;

-- 数据迁移: 设置 module data_json 的 viewVariant
-- [SKIPPED: 虚谷不支持 JSON_OBJECT 函数，viewVariant 在应用层设置]
-- UPDATE project_modules SET data_json = JSON_OBJECT(...) WHERE ...

CREATE UNIQUE INDEX idx_project_modules_position ON project_modules(version_id, position);

-- 插入模板 (使用 MERGE 替代 ON CONFLICT)
MERGE INTO templates t
USING (SELECT 'campaign-map-v1' AS id, '1.0.0' AS version) AS src
ON (t.id = src.id AND t.version = src.version)
WHEN MATCHED THEN UPDATE SET name = 'Campaign Map', config_json = '{"id":"campaign-map-v1","version":"1.0.0","name":"Campaign Map","theme":{"preset":"xugu-blue","accent":"#1265f2","palette":["xugu-blue","white","warm-orange"],"canvas":"warm-command"},"terminology":{"preset":"campaign","overview":"作战总览","unit":"作战单元","task":"行动任务","stage":"战役节点","outcome":"战果档案","workstream":"公司级战线","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"作战目标","type":"long-text","required":false},{"id":"summary","label":"当前战况","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"作战中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"XUGU AGENTIC GROUP SCHEDULE","status":"当前战况","emptyProjectSummary":"项目已创建，待配置作战单元和战役路线。"}}'
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('campaign-map-v1', '1.0.0', 'Campaign Map', '{"id":"campaign-map-v1","version":"1.0.0","name":"Campaign Map","theme":{"preset":"xugu-blue","accent":"#1265f2","palette":["xugu-blue","white","warm-orange"],"canvas":"warm-command"},"terminology":{"preset":"campaign","overview":"作战总览","unit":"作战单元","task":"行动任务","stage":"战役节点","outcome":"战果档案","workstream":"公司级战线","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"作战目标","type":"long-text","required":false},{"id":"summary","label":"当前战况","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"作战中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"XUGU AGENTIC GROUP SCHEDULE","status":"当前战况","emptyProjectSummary":"项目已创建，待配置作战单元和战役路线。"}}', '2026-07-18T00:00:00.000Z');

MERGE INTO templates t
USING (SELECT 'standard-project-v1' AS id, '1.0.0' AS version) AS src
ON (t.id = src.id AND t.version = src.version)
WHEN MATCHED THEN UPDATE SET name = 'Standard Project', config_json = '{"id":"standard-project-v1","version":"1.0.0","name":"Standard Project","theme":{"preset":"neutral-blue","accent":"#5f7088","palette":["neutral-blue","white","soft-gray"],"canvas":"warm-command"},"terminology":{"preset":"standard","overview":"项目总览","unit":"团队","task":"任务","stage":"里程碑","outcome":"交付物","workstream":"工作流","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"项目目标","type":"long-text","required":false},{"id":"summary","label":"项目摘要","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"进行中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"STANDARD PROJECT SCHEDULE","status":"当前状态","emptyProjectSummary":"项目已创建，待配置团队、任务与里程碑。"}}'
WHEN NOT MATCHED THEN INSERT (id, version, name, config_json, created_at) VALUES ('standard-project-v1', '1.0.0', 'Standard Project', '{"id":"standard-project-v1","version":"1.0.0","name":"Standard Project","theme":{"preset":"neutral-blue","accent":"#5f7088","palette":["neutral-blue","white","soft-gray"],"canvas":"warm-command"},"terminology":{"preset":"standard","overview":"项目总览","unit":"团队","task":"任务","stage":"里程碑","outcome":"交付物","workstream":"工作流","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"项目目标","type":"long-text","required":false},{"id":"summary","label":"项目摘要","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"进行中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"STANDARD PROJECT SCHEDULE","status":"当前状态","emptyProjectSummary":"项目已创建，待配置团队、任务与里程碑。"}}', '2026-07-18T00:00:00.000Z');
