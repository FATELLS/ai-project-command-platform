CREATE TABLE project_risks (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'monitoring', 'mitigated', 'closed')),
  owner TEXT NOT NULL DEFAULT '',
  mitigation TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE project_metrics (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  name TEXT NOT NULL,
  value_json TEXT CHECK (value_json IS NULL OR json_valid(value_json)),
  unit TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'on-track', 'at-risk', 'off-track')),
  as_of TEXT NOT NULL DEFAULT '',
  target_json TEXT CHECK (target_json IS NULL OR json_valid(target_json)),
  source TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

UPDATE project_modules
SET position = CASE module_type
  WHEN 'overview' THEN 0 WHEN 'roadmap' THEN 1 WHEN 'units' THEN 2
  WHEN 'task-network' THEN 3 WHEN 'gantt' THEN 4 WHEN 'outcomes' THEN 5
  WHEN 'risks' THEN 6 WHEN 'metrics' THEN 7 WHEN 'materials' THEN 8
  ELSE position + 1000 END;

UPDATE project_modules
SET data_json = json_object(
  'schemaVersion', '1.0.0',
  'viewVariant', CASE module_type
    WHEN 'overview' THEN 'mission-status'
    WHEN 'units' THEN CASE
      WHEN (SELECT template_id FROM projects WHERE projects.id = (SELECT project_id FROM project_versions WHERE project_versions.id = project_modules.version_id)) = 'standard-project-v1'
      THEN 'team-cards' ELSE 'campaign-cards' END
    WHEN 'roadmap' THEN CASE
      WHEN (SELECT template_id FROM projects WHERE projects.id = (SELECT project_id FROM project_versions WHERE project_versions.id = project_modules.version_id)) = 'standard-project-v1'
      THEN 'linear-roadmap' ELSE 'campaign-network' END
    WHEN 'task-network' THEN CASE
      WHEN (SELECT template_id FROM projects WHERE projects.id = (SELECT project_id FROM project_versions WHERE project_versions.id = project_modules.version_id)) = 'standard-project-v1'
      THEN 'dependency-list' ELSE 'branching-network' END
    WHEN 'gantt' THEN CASE
      WHEN (SELECT template_id FROM projects WHERE projects.id = (SELECT project_id FROM project_versions WHERE project_versions.id = project_modules.version_id)) = 'standard-project-v1'
      THEN 'lanes' ELSE 'branching' END
    WHEN 'outcomes' THEN CASE
      WHEN (SELECT template_id FROM projects WHERE projects.id = (SELECT project_id FROM project_versions WHERE project_versions.id = project_modules.version_id)) = 'standard-project-v1'
      THEN 'archive-grid' ELSE 'closure-detail' END
    WHEN 'risks' THEN 'risk-register'
    WHEN 'metrics' THEN 'metric-cards'
    WHEN 'materials' THEN 'materials-empty'
    ELSE NULL END
)
WHERE module_type IN ('overview', 'units', 'roadmap', 'task-network', 'gantt', 'outcomes', 'risks', 'metrics', 'materials');

CREATE UNIQUE INDEX idx_project_modules_position ON project_modules(version_id, position);

INSERT INTO templates (id, version, name, config_json, created_at)
VALUES (
  'campaign-map-v1', '1.0.0', 'Campaign Map',
  '{"id":"campaign-map-v1","version":"1.0.0","name":"Campaign Map","theme":{"preset":"xugu-blue","accent":"#1265f2","palette":["xugu-blue","white","warm-orange"],"canvas":"warm-command"},"terminology":{"preset":"campaign","overview":"作战总览","unit":"作战单元","task":"行动任务","stage":"战役节点","outcome":"战果档案","workstream":"公司级战线","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"作战目标","type":"long-text","required":false},{"id":"summary","label":"当前战况","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"作战中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"XUGU AGENTIC GROUP SCHEDULE","status":"当前战况","emptyProjectSummary":"项目已创建，待配置作战单元和战役路线。"},"modules":[{"type":"overview","schemaVersion":"1.0.0","position":0,"required":true,"enabled":true,"title":"作战总览","viewVariant":"mission-status","emptyState":"项目概览尚待补充"},{"type":"roadmap","schemaVersion":"1.0.0","position":1,"required":false,"enabled":true,"title":"战役路线","viewVariant":"campaign-network","emptyState":"尚未建立战役路线"},{"type":"units","schemaVersion":"1.0.0","position":2,"required":false,"enabled":true,"title":"作战单元","viewVariant":"campaign-cards","emptyState":"尚未建立作战单元"},{"type":"task-network","schemaVersion":"1.0.0","position":3,"required":false,"enabled":true,"title":"任务网络","viewVariant":"branching-network","emptyState":"暂无行动任务"},{"type":"gantt","schemaVersion":"1.0.0","position":4,"required":false,"enabled":true,"title":"甘特协同","viewVariant":"branching","emptyState":"暂无可展示的甘特任务"},{"type":"outcomes","schemaVersion":"1.0.0","position":5,"required":false,"enabled":true,"title":"战果档案","viewVariant":"closure-detail","emptyState":"暂无已归档战果"},{"type":"risks","schemaVersion":"1.0.0","position":6,"required":false,"enabled":true,"title":"风险台账","viewVariant":"risk-register","emptyState":"暂无已登记风险"},{"type":"metrics","schemaVersion":"1.0.0","position":7,"required":false,"enabled":true,"title":"效果指标","viewVariant":"metric-cards","emptyState":"暂无已登记指标"},{"type":"materials","schemaVersion":"1.0.0","position":8,"required":false,"enabled":true,"title":"项目材料","viewVariant":"materials-empty","emptyState":"项目材料功能将在下一阶段开放"}]}',
  '2026-07-18T00:00:00.000Z'
)
ON CONFLICT (id, version) DO UPDATE SET name = excluded.name, config_json = excluded.config_json;

INSERT INTO templates (id, version, name, config_json, created_at)
VALUES (
  'standard-project-v1', '1.0.0', 'Standard Project',
  '{"id":"standard-project-v1","version":"1.0.0","name":"Standard Project","theme":{"preset":"neutral-blue","accent":"#5f7088","palette":["neutral-blue","white","soft-gray"],"canvas":"warm-command"},"terminology":{"preset":"standard","overview":"项目总览","unit":"团队","task":"任务","stage":"里程碑","outcome":"交付物","workstream":"工作流","risk":"风险","metric":"指标","material":"项目材料"},"fields":[{"id":"name","label":"项目名称","type":"text","required":true},{"id":"goal","label":"项目目标","type":"long-text","required":false},{"id":"summary","label":"项目摘要","type":"long-text","required":false},{"id":"projectStatus","label":"项目状态","type":"status","required":true}],"statuses":[{"id":"planning","label":"规划中"},{"id":"active","label":"进行中"},{"id":"completed","label":"已完成"}],"validation":{"projectNameMinLength":2,"projectNameMaxLength":80},"defaultView":"overview","requiredModules":["overview"],"copy":{"banner":"STANDARD PROJECT SCHEDULE","status":"当前状态","emptyProjectSummary":"项目已创建，待配置团队、任务与里程碑。"},"modules":[{"type":"overview","schemaVersion":"1.0.0","position":0,"required":true,"enabled":true,"title":"项目总览","viewVariant":"mission-status","emptyState":"项目概览尚待补充"},{"type":"roadmap","schemaVersion":"1.0.0","position":1,"required":false,"enabled":true,"title":"项目路线","viewVariant":"linear-roadmap","emptyState":"尚未建立项目路线"},{"type":"units","schemaVersion":"1.0.0","position":2,"required":false,"enabled":true,"title":"团队","viewVariant":"team-cards","emptyState":"尚未建立团队"},{"type":"task-network","schemaVersion":"1.0.0","position":3,"required":false,"enabled":true,"title":"任务依赖","viewVariant":"dependency-list","emptyState":"暂无任务"},{"type":"gantt","schemaVersion":"1.0.0","position":4,"required":false,"enabled":true,"title":"项目甘特","viewVariant":"lanes","emptyState":"暂无可展示的甘特任务"},{"type":"outcomes","schemaVersion":"1.0.0","position":5,"required":false,"enabled":true,"title":"交付物","viewVariant":"archive-grid","emptyState":"暂无已登记交付物"},{"type":"risks","schemaVersion":"1.0.0","position":6,"required":false,"enabled":true,"title":"风险台账","viewVariant":"risk-register","emptyState":"暂无已登记风险"},{"type":"metrics","schemaVersion":"1.0.0","position":7,"required":false,"enabled":true,"title":"项目指标","viewVariant":"metric-cards","emptyState":"暂无已登记指标"},{"type":"materials","schemaVersion":"1.0.0","position":8,"required":false,"enabled":true,"title":"项目材料","viewVariant":"materials-empty","emptyState":"项目材料功能将在下一阶段开放"}]}',
  '2026-07-18T00:00:00.000Z'
)
ON CONFLICT (id, version) DO UPDATE SET name = excluded.name, config_json = excluded.config_json;
