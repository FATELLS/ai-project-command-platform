import { withTransaction } from "../db/database.mjs";
import { upsert } from "../db/sql-dialect.mjs";

const layers = new Set(["published", "draft"]);

function parseJson(value) {
  return JSON.parse(value || "{}");
}

function parseNullableJson(value) {
  return value === null || value === undefined ? null : JSON.parse(value);
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
    const cardRows = database.prepare(`
      SELECT external_id AS id, element_type AS elementType, title, start_date AS startDate,
             end_date AS endDate, progress, unit_id AS unitId, parent_id AS parentId,
             card_attrs AS cardAttrs
      FROM project_cards WHERE version_id = ? ORDER BY element_type, position
    `).all(version.id);
    const dependencyRows = database.prepare(`
      SELECT card_external_id AS cardId, depends_on_external_id AS dependencyId
      FROM project_card_links WHERE version_id = ? ORDER BY card_external_id, position
    `).all(version.id);
    const dependencies = new Map();
    for (const row of dependencyRows) {
      const values = dependencies.get(row.cardId) ?? [];
      values.push(row.dependencyId);
      dependencies.set(row.cardId, values);
    }
    const cards = type => cardRows.filter(row => row.elementType === type);
    const groups = cards("unit").map(row => ({ id: row.id, name: row.title, ...parseJson(row.cardAttrs) }));
    const stages = cards("stage").map(row => ({ id: row.id, title: row.title, date: row.startDate, ...parseJson(row.cardAttrs) }));
    const closures = cards("outcome").map(row => ({ id: row.id, title: row.title, date: row.startDate, ...parseJson(row.cardAttrs) }));
    const tasks = cards("task").map(row => ({
      id: row.id, groupId: row.unitId, title: row.title, ...parseJson(row.cardAttrs),
      startDate: row.startDate, endDate: row.endDate, progress: row.progress,
      parentId: row.parentId ?? "", dependsOn: dependencies.get(row.id) ?? []
    }));
    const companyWorkstreams = cards("workstream").map(row => {
      const attributes = parseJson(row.cardAttrs);
      const taskIds = attributes.members ?? [];
      delete attributes.members;
      return { id: row.id, title: row.title, ...attributes, taskIds };
    });
    return {
      ...parseJson(version.metadataJson),
      groups, stages, closures, tasks, companyWorkstreams
    };
  }

  function loadCardsFromUnifiedTable(versionId) {
    const cardRows = database.prepare(`
      SELECT external_id AS id, element_type AS elementType, position,
             title, owner, state, objective, start_date AS startDate, end_date AS endDate,
             progress, health, unit_id AS unitId, parent_id AS parentId,
             depends_on AS dependsOnJson, card_attrs AS cardAttrs
      FROM project_cards WHERE version_id = ? ORDER BY position
    `).all(versionId);

    const linkRows = database.prepare(`
      SELECT card_external_id AS cardId, depends_on_external_id AS dependencyId
      FROM project_card_links WHERE version_id = ? ORDER BY card_external_id, position
    `).all(versionId);
    const links = new Map();
    for (const row of linkRows) {
      const values = links.get(row.cardId) ?? [];
      values.push(row.dependencyId);
      links.set(row.cardId, values);
    }

    const units = [];
    const stages = [];
    const closures = [];
    const tasks = [];
    const workstreams = [];
    const risks = [];
    const metrics = [];

    for (const row of cardRows) {
      const attrs = parseJson(row.cardAttrs);
      const dependsOn = row.dependsOnJson ? parseJson(row.dependsOnJson) : (links.get(row.id) ?? []);
      const owner = row.owner || attrs.owner || "";
      const stateVal = row.state || attrs.state || "";
      const healthVal = row.health || attrs.health || "";
      switch (row.elementType) {
        case "unit":
          units.push({ ...attrs, id: row.id, name: row.title, owner,
                       status: attrs.status ?? "active", objective: row.objective || attrs.objective || "" });
          break;
        case "stage":
          stages.push({ ...attrs, id: row.id, title: row.title, state: stateVal,
                        dateLabel: attrs.dateLabel ?? attrs.date ?? row.startDate ?? "", startDate: row.startDate, endDate: row.endDate });
          break;
        case "outcome":
          closures.push({ ...attrs, id: row.id, title: row.title, state: stateVal,
                          dateLabel: attrs.dateLabel ?? attrs.date ?? row.startDate ?? "", description: attrs.description ?? "",
                          result: attrs.result ?? "", source: attrs.source ?? "",
                          between: attrs.between ?? [], previewAssets: attrs.previewImages ?? [] });
          break;
        case "task":
          tasks.push({ ...attrs, id: row.id, title: row.title, owner, state: stateVal,
                       objective: row.objective, unitId: row.unitId || attrs.unitId || "default-unit",
                       parentId: row.parentId ?? "", startDate: row.startDate, endDate: row.endDate,
                       progress: row.progress, health: healthVal,
                       dependsOn: Array.isArray(dependsOn) ? dependsOn : [],
                       expectedOutput: attrs.expectedOutput ?? "" });
          break;
        case "workstream":
          workstreams.push({ ...attrs, id: row.id, title: row.title,
                             description: attrs.description ?? "", taskIds: attrs.members ?? [] });
          break;
        case "risk":
          risks.push({ ...attrs, id: row.id, title: row.title, owner,
                       status: stateVal || attrs.status || "open", severity: attrs.severity ?? "medium",
                       mitigation: attrs.mitigation ?? "", dueDate: row.endDate || attrs.dueDate || "",
                       source: attrs.source ?? "" });
          break;
        case "metric":
          metrics.push({ ...attrs, id: row.id, name: row.title, status: stateVal || attrs.status || "pending",
                         value: attrs.value ?? null, unit: attrs.unit ?? "",
                         asOf: row.startDate || attrs.asOf || "", target: attrs.target ?? null,
                         source: attrs.source ?? "" });
          break;
      }
    }
    return { units, stages, closures, tasks, workstreams, risks, metrics };
  }

  function getModuleVersionGraph(projectId, layer) {
    if (!layers.has(layer)) throw new Error(`Unsupported project layer: ${layer}`);
    const pointer = layer === "published" ? "published_version_id" : "draft_version_id";
    const context = database.prepare(`
      SELECT p.id AS projectId, p.template_id AS templateId, p.template_version AS templateVersion,
             v.id AS versionId, v.version_label AS versionLabel, v.metadata_json AS metadataJson,
             template.config_json AS templateConfigJson
      FROM projects p
      JOIN project_versions v ON v.id = p.${pointer} AND v.project_id = p.id AND v.layer = ?
      JOIN templates template ON template.id = p.template_id AND template.version = p.template_version
      WHERE p.id = ?
    `).get(layer, projectId);
    if (!context) return undefined;
    const versionId = context.versionId;
    const modules = database.prepare(`
      SELECT external_id AS externalId, module_type AS type, position, enabled, data_json AS dataJson
      FROM project_modules WHERE version_id = ? ORDER BY position, external_id
    `).all(versionId).map(row => ({
      externalId: row.externalId,
      type: row.type,
      position: row.position,
      enabled: Boolean(row.enabled),
      configuration: parseJson(row.dataJson)
    }));

    let units, stages, closures, tasks, workstreams, risks, metrics;

    const unified = loadCardsFromUnifiedTable(versionId);
    units = unified.units; stages = unified.stages; closures = unified.closures;
    tasks = unified.tasks; workstreams = unified.workstreams;
    risks = unified.risks; metrics = unified.metrics;

    return {
      projectId: context.projectId,
      layer,
      versionId,
      versionLabel: context.versionLabel,
      metadata: parseJson(context.metadataJson),
      template: {
        id: context.templateId,
        version: context.templateVersion,
        config: parseJson(context.templateConfigJson)
      },
      modules,
      units,
      stages,
      closures,
      tasks,
      workstreams,
      risks,
      metrics
    };
  }

  function replaceDraftModuleConfigurations(projectId, modules) {
    return withTransaction(database, () => {
      const version = resolveVersion(projectId, "draft");
      if (!version) return undefined;
      const existingCount = database.prepare(
        "SELECT count(*) AS count FROM project_modules WHERE version_id = ?"
      ).get(version.id).count;
      if (existingCount !== modules.length) throw new Error("Draft module set is incomplete");
      database.prepare("UPDATE project_modules SET position = position + 1000 WHERE version_id = ?").run(version.id);
      const update = database.prepare(`
        UPDATE project_modules
        SET position = ?, enabled = ?, data_json = ?
        WHERE version_id = ? AND external_id = ? AND module_type = ?
      `);
      for (const module of modules) {
        const exists = database.prepare(`
          SELECT 1 FROM project_modules
          WHERE version_id = ? AND external_id = ? AND module_type = ?
        `).get(version.id, module.type, module.type);
        if (!exists) throw new Error(`Draft module ${module.type} was not found`);
        update.run(
          module.position,
          module.enabled ? 1 : 0,
          JSON.stringify({ schemaVersion: module.schemaVersion, viewVariant: module.viewVariant }),
          version.id,
          module.type,
          module.type
        );
      }
      return getModuleVersionGraph(projectId, "draft");
    });
  }

  function getLegacyFixture(projectId) {
    const published = getSnapshot(projectId, "published");
    const draft = getSnapshot(projectId, "draft");
    if (!published || !draft) return undefined;
    return { published, materials: [], draft };
  }

  function countVersion(versionId) {
    const countType = type => database.prepare(
      `SELECT count(*) AS count FROM project_cards WHERE version_id = ? AND element_type = ?`
    ).get(versionId, type).count;
    return {
      units: countType("unit"),
      tasks: countType("task"),
      stages: countType("stage"),
      closures: countType("outcome"),
      workstreams: countType("workstream")
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
      ? "p.name ASC, p.id ASC"
      : filters.sort === "updated"
        ? "p.updated_at DESC, p.name ASC"
        : "CASE WHEN recent.last_accessed_at IS NULL THEN 1 ELSE 0 END, recent.last_accessed_at DESC, p.updated_at DESC";
    const unitCountExpr =
      "(SELECT count(*) FROM project_cards c WHERE c.version_id = p.published_version_id AND c.element_type = 'unit')";
    const taskCountExpr =
      "(SELECT count(*) FROM project_cards c WHERE c.version_id = p.published_version_id AND c.element_type = 'task')";
    const stageCountExpr =
      "(SELECT count(*) FROM project_cards c WHERE c.version_id = p.published_version_id AND c.element_type = 'stage')";
    const rows = database.prepare(`
      SELECT p.id, p.name, p.template_id AS templateId, p.template_version AS templateVersion,
             p.status, p.updated_at AS updatedAt, p.terminology_json AS terminologyJson,
             published.metadata_json AS metadataJson,
             published.version_label AS publishedVersion, membership.role,
             ${unitCountExpr} AS unitCount,
             ${taskCountExpr} AS taskCount,
             ${stageCountExpr} AS stageCount,
             recent.last_accessed_at AS lastAccessedAt
      FROM projects p
      JOIN project_versions published ON published.id = p.published_version_id AND published.project_id = p.id AND published.layer = 'published'
      LEFT JOIN project_members membership ON membership.project_id = p.id AND membership.user_id = ?
      LEFT JOIN recent_project_access recent ON recent.project_id = p.id AND recent.user_id = ?
      WHERE ${principal.isPlatformAdmin ? "1 = 1" : "membership.user_id IS NOT NULL"}
        AND (? = 'all' OR p.status = ?)
        AND (? = '' OR lower(p.name) LIKE ? ESCAPE '\\' OR lower(p.id) LIKE ? ESCAPE '\\')
      ORDER BY ${orderBy}
    `).all(
      principal.id,
      principal.id,
      status,
      status,
      query,
      pattern,
      pattern
    ).map(row => {
      const { terminologyJson, metadataJson, ...project } = row;
      return {
        ...project,
        role: roleExpression(principal.isPlatformAdmin) ?? row.role,
        terminology: parseJson(terminologyJson),
        summary: parseJson(metadataJson).summary ?? "",
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
             published.version_label AS publishedVersion, membership.role
      FROM projects p
      JOIN project_versions published ON published.id = p.published_version_id AND published.project_id = p.id
      LEFT JOIN project_members membership ON membership.project_id = p.id AND membership.user_id = ?
      WHERE p.id = ? AND p.status = 'active'
        AND ${principal.isPlatformAdmin ? "1 = 1" : "membership.user_id IS NOT NULL"}
    `).get(principal.id, projectId);
    if (!row) return undefined;
    const role = roleExpression(principal.isPlatformAdmin) ?? row.role;
    if (capability === "draft" && !["platform_admin", "project_admin", "project_editor"].includes(role)) return undefined;
    const { themeJson, terminologyJson, ...project } = row;
    return { ...project, role, theme: parseJson(themeJson), terminology: parseJson(terminologyJson) };
  }

  function recordRecentAccess(userId, projectId, accessedAt) {
    upsert(database, "recent_project_access",
      ["user_id", "project_id", "last_accessed_at"],
      [userId, projectId, accessedAt],
      ["user_id", "project_id"],
      ["last_accessed_at"]
    );
  }

  function addProjectMember(projectId, userId, role, createdAt) {
    upsert(database, "project_members",
      ["project_id", "user_id", "role", "created_at"],
      [projectId, userId, role, createdAt],
      ["project_id", "user_id"],
      ["role"]
    );
  }

  function updateProjectMetadata(projectId, values) {
    if (!getProject(projectId)) return 0;
    database.prepare(`
      UPDATE projects SET name = ?, theme_json = ?, terminology_json = ?, updated_at = ?
      WHERE id = ?
    `).run(values.name, JSON.stringify(values.theme), JSON.stringify(values.terminology), values.updatedAt, projectId);
    return 1;
  }

  function setProjectStatus(projectId, status, changedAt) {
    if (!getProject(projectId)) return 0;
    database.prepare(`
      UPDATE projects SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?
    `).run(status, status === "archived" ? changedAt : null, changedAt, projectId);
    return 1;
  }

  return {
    listProjects,
    getProject,
    resolveVersion,
    getSnapshot,
    getModuleVersionGraph,
    replaceDraftModuleConfigurations,
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
