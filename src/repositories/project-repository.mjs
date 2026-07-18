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

  function roleExpression(isPlatformAdmin) {
    return isPlatformAdmin ? "platform_admin" : undefined;
  }

  function listAuthorizedProjects(principal, filters = {}) {
    const requestedStatus = ["active", "archived", "all"].includes(filters.status) ? filters.status : "active";
    const status = principal.isPlatformAdmin ? requestedStatus : "active";
    const query = String(filters.q ?? "").trim().toLowerCase();
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const orderBy = filters.sort === "name"
      ? "p.name COLLATE NOCASE ASC, p.id ASC"
      : filters.sort === "updated"
        ? "p.updated_at DESC, p.name COLLATE NOCASE ASC"
        : "CASE WHEN recent.last_accessed_at IS NULL THEN 1 ELSE 0 END, recent.last_accessed_at DESC, p.updated_at DESC";
    const rows = database.prepare(`
      SELECT p.id, p.name, p.template_id AS templateId, p.template_version AS templateVersion,
             p.status, p.updated_at AS updatedAt, p.terminology_json AS terminologyJson,
             published.version_label AS publishedVersion,
             CASE WHEN ? = 1 THEN 'platform_admin' ELSE membership.role END AS role,
             json_extract(published.metadata_json, '$.summary') AS summary,
             (SELECT count(*) FROM project_units u WHERE u.version_id = p.published_version_id) AS unitCount,
             (SELECT count(*) FROM project_tasks t WHERE t.version_id = p.published_version_id) AS taskCount,
             (SELECT count(*) FROM project_stages s WHERE s.version_id = p.published_version_id) AS stageCount,
             recent.last_accessed_at AS lastAccessedAt
      FROM projects p
      JOIN project_versions published ON published.id = p.published_version_id AND published.project_id = p.id AND published.layer = 'published'
      LEFT JOIN project_members membership ON membership.project_id = p.id AND membership.user_id = ?
      LEFT JOIN recent_project_access recent ON recent.project_id = p.id AND recent.user_id = ?
      WHERE (? = 1 OR membership.user_id IS NOT NULL)
        AND (? = 'all' OR p.status = ?)
        AND (? = '' OR lower(p.name) LIKE ? ESCAPE '\\' OR lower(p.id) LIKE ? ESCAPE '\\')
      ORDER BY ${orderBy}
    `).all(
      principal.isPlatformAdmin ? 1 : 0,
      principal.id,
      principal.id,
      principal.isPlatformAdmin ? 1 : 0,
      status,
      status,
      query,
      pattern,
      pattern
    ).map(row => {
      const { terminologyJson, ...project } = row;
      return {
        ...project,
        role: roleExpression(principal.isPlatformAdmin) ?? row.role,
        terminology: parseJson(terminologyJson),
        summary: row.summary ?? "",
        isRecent: Boolean(row.lastAccessedAt)
      };
    });
    const recent = rows
      .filter(project => project.status === "active" && project.lastAccessedAt)
      .sort((left, right) => right.lastAccessedAt.localeCompare(left.lastAccessedAt))
      .slice(0, 4);
    const activeCount = database.prepare(`
      SELECT count(DISTINCT p.id) AS count
      FROM projects p
      LEFT JOIN project_members membership ON membership.project_id = p.id AND membership.user_id = ?
      WHERE p.status = 'active' AND (? = 1 OR membership.user_id IS NOT NULL)
    `).get(principal.id, principal.isPlatformAdmin ? 1 : 0).count;
    return { projects: rows, recent, activeCount };
  }

  function getAuthorizedProject(principal, projectId, capability = "public") {
    const row = database.prepare(`
      SELECT p.id, p.name, p.template_id AS templateId, p.template_version AS templateVersion,
             p.status, p.updated_at AS updatedAt, p.theme_json AS themeJson,
             p.terminology_json AS terminologyJson,
             published.version_label AS publishedVersion,
             CASE WHEN ? = 1 THEN 'platform_admin' ELSE membership.role END AS role
      FROM projects p
      JOIN project_versions published ON published.id = p.published_version_id AND published.project_id = p.id
      LEFT JOIN project_members membership ON membership.project_id = p.id AND membership.user_id = ?
      WHERE p.id = ? AND p.status = 'active' AND (? = 1 OR membership.user_id IS NOT NULL)
    `).get(principal.isPlatformAdmin ? 1 : 0, principal.id, projectId, principal.isPlatformAdmin ? 1 : 0);
    if (!row) return undefined;
    const role = roleExpression(principal.isPlatformAdmin) ?? row.role;
    if (capability === "draft" && !["platform_admin", "project_admin", "project_editor"].includes(role)) return undefined;
    const { themeJson, terminologyJson, ...project } = row;
    return { ...project, role, theme: parseJson(themeJson), terminology: parseJson(terminologyJson) };
  }

  function recordRecentAccess(userId, projectId, accessedAt) {
    database.prepare(`
      INSERT INTO recent_project_access (user_id, project_id, last_accessed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, project_id) DO UPDATE SET last_accessed_at = excluded.last_accessed_at
    `).run(userId, projectId, accessedAt);
  }

  function addProjectMember(projectId, userId, role, createdAt) {
    database.prepare(`
      INSERT INTO project_members (project_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
    `).run(projectId, userId, role, createdAt);
  }

  function updateProjectMetadata(projectId, values) {
    return database.prepare(`
      UPDATE projects SET name = ?, theme_json = ?, terminology_json = ?, updated_at = ?
      WHERE id = ?
    `).run(values.name, JSON.stringify(values.theme), JSON.stringify(values.terminology), values.updatedAt, projectId).changes;
  }

  function setProjectStatus(projectId, status, changedAt) {
    return database.prepare(`
      UPDATE projects SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?
    `).run(status, status === "archived" ? changedAt : null, changedAt, projectId).changes;
  }

  return {
    listProjects,
    getProject,
    resolveVersion,
    getSnapshot,
    getLegacyFixture,
    countVersion,
    listAuthorizedProjects,
    getAuthorizedProject,
    recordRecentAccess,
    addProjectMember,
    updateProjectMetadata,
    setProjectStatus
  };
}
