import { createHash } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { validateLegacyFixture } from "../domain/project-validator.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const entityArrays = new Set(["groups", "stages", "closures", "tasks", "companyWorkstreams"]);
const moduleTypes = ["overview", "units", "roadmap", "task-network", "gantt", "outcomes", "risks", "metrics", "materials"];

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function semanticallyEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function without(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}

function insertVersionGraph(database, projectId, layer, snapshot, sourceChecksum, now) {
  const metadata = without(snapshot, entityArrays);
  const versionResult = database.prepare(`
    INSERT INTO project_versions (project_id, layer, version_label, source_checksum, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, layer, snapshot.version, sourceChecksum, JSON.stringify(metadata), now);
  const versionId = Number(versionResult.lastInsertRowid);

  const insertModule = database.prepare(`
    INSERT INTO project_modules (version_id, external_id, module_type, position, enabled, data_json)
    VALUES (?, ?, ?, ?, 1, '{}')
  `);
  moduleTypes.forEach((moduleType, position) => insertModule.run(versionId, moduleType, moduleType, position));

  const insertUnit = database.prepare(`
    INSERT INTO project_units (version_id, external_id, position, name, data_json) VALUES (?, ?, ?, ?, ?)
  `);
  snapshot.groups.forEach((unit, position) => {
    insertUnit.run(versionId, unit.id, position, unit.name, JSON.stringify(without(unit, new Set(["id", "name"]))));
  });

  const insertStage = database.prepare(`
    INSERT INTO project_stages (version_id, external_id, position, title, date_label, data_json) VALUES (?, ?, ?, ?, ?, ?)
  `);
  snapshot.stages.forEach((stage, position) => {
    insertStage.run(versionId, stage.id, position, stage.title, stage.date ?? "", JSON.stringify(without(stage, new Set(["id", "title", "date"]))));
  });

  const insertClosure = database.prepare(`
    INSERT INTO project_closures (version_id, external_id, position, title, date_label, data_json) VALUES (?, ?, ?, ?, ?, ?)
  `);
  (snapshot.closures ?? []).forEach((closure, position) => {
    insertClosure.run(versionId, closure.id, position, closure.title, closure.date ?? "", JSON.stringify(without(closure, new Set(["id", "title", "date"]))));
  });

  const insertTask = database.prepare(`
    INSERT INTO project_tasks (
      version_id, external_id, unit_external_id, parent_external_id, position, title,
      start_date, end_date, progress, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  snapshot.tasks.forEach((task, position) => {
    const data = without(task, new Set(["id", "groupId", "parentId", "dependsOn", "title", "startDate", "endDate", "progress"]));
    insertTask.run(
      versionId, task.id, task.groupId, task.parentId || null, position, task.title,
      task.startDate ?? "", task.endDate ?? "", task.progress ?? null, JSON.stringify(data)
    );
  });

  const insertTaskLink = database.prepare(`
    INSERT INTO task_links (version_id, task_external_id, depends_on_external_id, position) VALUES (?, ?, ?, ?)
  `);
  snapshot.tasks.forEach(task => (task.dependsOn ?? []).forEach((dependency, position) => {
    insertTaskLink.run(versionId, task.id, dependency, position);
  }));

  const insertWorkstream = database.prepare(`
    INSERT INTO project_workstreams (version_id, external_id, position, title, data_json) VALUES (?, ?, ?, ?, ?)
  `);
  const insertWorkstreamTask = database.prepare(`
    INSERT INTO workstream_tasks (version_id, workstream_external_id, task_external_id, position) VALUES (?, ?, ?, ?)
  `);
  (snapshot.companyWorkstreams ?? []).forEach((workstream, position) => {
    insertWorkstream.run(
      versionId, workstream.id, position, workstream.title,
      JSON.stringify(without(workstream, new Set(["id", "title", "taskIds"])))
    );
    (workstream.taskIds ?? []).forEach((taskId, taskPosition) => {
      insertWorkstreamTask.run(versionId, workstream.id, taskId, taskPosition);
    });
  });
  return versionId;
}

export function importLegacyProject(database, fixture, options = {}) {
  const projectId = options.projectId ?? "xugu-agentic-group";
  if (!projectIdPattern.test(projectId)) throw new Error("Project ID must be a stable lowercase ID");
  const validation = validateLegacyFixture(fixture);
  const repository = createProjectRepository(database);
  const existing = repository.getProject(projectId);
  if (existing) {
    const exported = repository.getLegacyFixture(projectId);
    if (exported && semanticallyEqual(exported, fixture)) {
      return { imported: false, projectId, validation };
    }
    throw new Error(`Project ${projectId} already exists with different content`);
  }

  return withTransaction(database, () => {
    const now = options.now ?? new Date().toISOString();
    const templateId = options.templateId ?? "campaign-map-v1";
    const templateVersion = options.templateVersion ?? "1.0.0";
    const projectName = options.name ?? fixture.published.title;
    database.prepare(`
      INSERT OR IGNORE INTO templates (id, version, name, config_json, created_at) VALUES (?, ?, ?, ?, ?)
    `).run(templateId, templateVersion, "Campaign Map", JSON.stringify({ modules: moduleTypes }), now);
    database.prepare(`
      INSERT INTO projects (
        id, name, template_id, template_version, status, theme_json, terminology_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(
      projectId, projectName, templateId, templateVersion,
      JSON.stringify({ palette: ["xugu-blue", "white", "warm-orange"] }),
      JSON.stringify({ unit: "作战单元", task: "行动任务", stage: "战役节点", outcome: "战果闭环" }),
      now, now
    );
    const publishedVersionId = insertVersionGraph(database, projectId, "published", fixture.published, sha256(fixture.published), now);
    const draftVersionId = insertVersionGraph(database, projectId, "draft", fixture.draft, sha256(fixture.draft), now);
    database.prepare(`
      UPDATE projects SET published_version_id = ?, draft_version_id = ?, updated_at = ? WHERE id = ?
    `).run(publishedVersionId, draftVersionId, now, projectId);
    return {
      imported: true,
      projectId,
      publishedVersionId,
      draftVersionId,
      validation
    };
  });
}

export function exportLegacyProject(database, projectId) {
  const fixture = createProjectRepository(database).getLegacyFixture(projectId);
  if (!fixture) throw new Error(`Project ${projectId} was not found or has incomplete version pointers`);
  return fixture;
}
