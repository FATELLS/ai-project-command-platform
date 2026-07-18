const layers = new Set(["published", "draft"]);

function parseJson(value) {
  return JSON.parse(value || "{}");
}

function rows(database, table, versionId) {
  return database.prepare(`SELECT * FROM ${table} WHERE version_id = ? ORDER BY position`).all(versionId);
}

export function createProjectRepository(database) {
  function listProjects() {
    return database.prepare(`
      SELECT p.id, p.name, p.template_id AS templateId, p.template_version AS templateVersion,
             p.status, p.created_at AS createdAt, p.updated_at AS updatedAt,
             published.version_label AS publishedVersion,
             draft.version_label AS draftVersion
      FROM projects p
      LEFT JOIN project_versions published ON published.id = p.published_version_id
      LEFT JOIN project_versions draft ON draft.id = p.draft_version_id
      ORDER BY p.name, p.id
    `).all();
  }

  function getProject(projectId) {
    return database.prepare(`
      SELECT id, name, template_id AS templateId, template_version AS templateVersion,
             status, theme_json AS themeJson, terminology_json AS terminologyJson,
             published_version_id AS publishedVersionId, draft_version_id AS draftVersionId,
             created_at AS createdAt, updated_at AS updatedAt, archived_at AS archivedAt
      FROM projects WHERE id = ?
    `).get(projectId);
  }

  function resolveVersion(projectId, layer) {
    if (!layers.has(layer)) throw new Error(`Unsupported project layer: ${layer}`);
    const pointer = layer === "published" ? "published_version_id" : "draft_version_id";
    return database.prepare(`
      SELECT v.id, v.version_label AS versionLabel, v.metadata_json AS metadataJson
      FROM projects p
      JOIN project_versions v ON v.id = p.${pointer}
      WHERE p.id = ? AND v.project_id = p.id AND v.layer = ?
    `).get(projectId, layer);
  }

  function getSnapshot(projectId, layer) {
    const version = resolveVersion(projectId, layer);
    if (!version) return undefined;
    const groups = rows(database, "project_units", version.id).map(row => ({
      id: row.external_id,
      name: row.name,
      ...parseJson(row.data_json)
    }));
    const stages = rows(database, "project_stages", version.id).map(row => ({
      id: row.external_id,
      title: row.title,
      date: row.date_label,
      ...parseJson(row.data_json)
    }));
    const closures = rows(database, "project_closures", version.id).map(row => ({
      id: row.external_id,
      title: row.title,
      date: row.date_label,
      ...parseJson(row.data_json)
    }));
    const dependencyRows = database.prepare(`
      SELECT task_external_id, depends_on_external_id
      FROM task_links WHERE version_id = ? ORDER BY task_external_id, position
    `).all(version.id);
    const dependencies = new Map();
    for (const row of dependencyRows) {
      const values = dependencies.get(row.task_external_id) ?? [];
      values.push(row.depends_on_external_id);
      dependencies.set(row.task_external_id, values);
    }
    const tasks = rows(database, "project_tasks", version.id).map(row => ({
      id: row.external_id,
      groupId: row.unit_external_id,
      title: row.title,
      ...parseJson(row.data_json),
      startDate: row.start_date,
      endDate: row.end_date,
      progress: row.progress,
      parentId: row.parent_external_id ?? "",
      dependsOn: dependencies.get(row.external_id) ?? []
    }));
    const workstreamTaskRows = database.prepare(`
      SELECT workstream_external_id, task_external_id
      FROM workstream_tasks WHERE version_id = ? ORDER BY workstream_external_id, position
    `).all(version.id);
    const workstreamTasks = new Map();
    for (const row of workstreamTaskRows) {
      const values = workstreamTasks.get(row.workstream_external_id) ?? [];
      values.push(row.task_external_id);
      workstreamTasks.set(row.workstream_external_id, values);
    }
    const companyWorkstreams = rows(database, "project_workstreams", version.id).map(row => ({
      id: row.external_id,
      title: row.title,
      ...parseJson(row.data_json),
      taskIds: workstreamTasks.get(row.external_id) ?? []
    }));
    return {
      ...parseJson(version.metadataJson),
      groups,
      stages,
      closures,
      tasks,
      companyWorkstreams
    };
  }

  function getLegacyFixture(projectId) {
    const published = getSnapshot(projectId, "published");
    const draft = getSnapshot(projectId, "draft");
    if (!published || !draft) return undefined;
    return { published, materials: [], draft };
  }

  function countVersion(versionId) {
    const count = table => database.prepare(`SELECT count(*) AS count FROM ${table} WHERE version_id = ?`).get(versionId).count;
    return {
      units: count("project_units"),
      tasks: count("project_tasks"),
      stages: count("project_stages"),
      closures: count("project_closures"),
      workstreams: count("project_workstreams")
    };
  }

  return { listProjects, getProject, resolveVersion, getSnapshot, getLegacyFixture, countVersion };
}
