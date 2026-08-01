import { createHash } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { insertOrIgnore } from "../db/sql-dialect.mjs";
import { validateLegacyFixture } from "../domain/project-validator.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { resolveTemplate, templateConfigJson } from "../templates/catalog.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const entityArrays = new Set(["groups", "stages", "closures", "tasks", "companyWorkstreams"]);

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

function insertVersionGraph(database, projectId, layer, snapshot, sourceChecksum, now, template) {
  const metadata = without(snapshot, entityArrays);
  const versionResult = database.prepare(`
    INSERT INTO project_versions (project_id, layer, version_label, source_checksum, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, layer, snapshot.version, sourceChecksum, JSON.stringify(metadata), now);
  const versionId = Number(versionResult.lastInsertRowid);

  const insertModule = database.prepare(`
    INSERT INTO project_modules (version_id, external_id, module_type, position, enabled, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  template.modules.forEach(module => insertModule.run(
    versionId,
    module.type,
    module.type,
    module.position,
    module.enabled ? 1 : 0,
    JSON.stringify({ schemaVersion: module.schemaVersion, viewVariant: module.viewVariant })
  ));

  // 双写模式：同时写入旧表和 project_cards 统一表
  // 旧表兼容部分迁移测试场景（migration 010 之前）；统一表是正式存储
  const hasCardsTable = (() => { try { database.prepare("SELECT 1 FROM project_cards LIMIT 1").get(); return true; } catch { return false; } })();

  const insertUnit = database.prepare(`
    INSERT INTO project_units (version_id, external_id, position, name, data_json) VALUES (?, ?, ?, ?, ?)
  `);
  const insertUnitCard = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_cards (
      version_id, external_id, element_type, position, title, owner, state, objective, card_attrs, created_at, updated_at
    ) VALUES (?, ?, 'unit', ?, ?, ?, ?, ?, ?, ?, ?)
  `) : null;
  snapshot.groups.forEach((unit, position) => {
    const data = without(unit, new Set(["id", "name"]));
    insertUnit.run(versionId, unit.id, position, unit.name, JSON.stringify(data));
    if (insertUnitCard) {
      insertUnitCard.run(
        versionId, unit.id, position, unit.name,
        data.owner ?? "", data.status ?? "", data.objective ?? "",
        JSON.stringify(data), now, now
      );
    }
  });

  const insertStage = database.prepare(`
    INSERT INTO project_stages (version_id, external_id, position, title, date_label, data_json) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertStageCard = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_cards (
      version_id, external_id, element_type, position, title, state, start_date, end_date, card_attrs, created_at, updated_at
    ) VALUES (?, ?, 'stage', ?, ?, ?, ?, ?, ?, ?, ?)
  `) : null;
  snapshot.stages.forEach((stage, position) => {
    const data = without(stage, new Set(["id", "title", "date"]));
    insertStage.run(versionId, stage.id, position, stage.title, stage.date ?? "", JSON.stringify(data));
    if (insertStageCard) {
      insertStageCard.run(
        versionId, stage.id, position, stage.title,
        data.state ?? "", data.startDate ?? "", data.endDate ?? "",
        JSON.stringify(data), now, now
      );
    }
  });

  const insertClosure = database.prepare(`
    INSERT INTO project_closures (version_id, external_id, position, title, date_label, data_json) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOutcomeCard = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_cards (
      version_id, external_id, element_type, position, title, state, start_date, card_attrs, created_at, updated_at
    ) VALUES (?, ?, 'outcome', ?, ?, ?, ?, ?, ?, ?)
  `) : null;
  (snapshot.closures ?? []).forEach((closure, position) => {
    const data = without(closure, new Set(["id", "title", "date"]));
    insertClosure.run(versionId, closure.id, position, closure.title, closure.date ?? "", JSON.stringify(data));
    if (insertOutcomeCard) {
      insertOutcomeCard.run(
        versionId, closure.id, position, closure.title,
        data.state ?? "", closure.date ?? "",
        JSON.stringify(data), now, now
      );
    }
  });

  const insertTask = database.prepare(`
    INSERT INTO project_tasks (
      version_id, external_id, unit_external_id, parent_external_id, position, title,
      start_date, end_date, progress, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTaskCard = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_cards (
      version_id, external_id, element_type, position, title, owner, state, objective,
      start_date, end_date, progress, health, unit_id, parent_id, depends_on, card_attrs, created_at, updated_at
    ) VALUES (?, ?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `) : null;
  snapshot.tasks.forEach((task, position) => {
    const data = without(task, new Set(["id", "groupId", "parentId", "dependsOn", "title", "startDate", "endDate", "progress"]));
    insertTask.run(
      versionId, task.id, task.groupId, task.parentId || null, position, task.title,
      task.startDate ?? "", task.endDate ?? "", task.progress ?? null, JSON.stringify(data)
    );
    if (insertTaskCard) {
      insertTaskCard.run(
        versionId, task.id, position, task.title,
        data.owner ?? "", data.state ?? "", data.objective ?? "",
        task.startDate ?? "", task.endDate ?? "", task.progress ?? null, data.health ?? "",
        task.groupId ?? "", task.parentId ?? null,
        JSON.stringify(task.dependsOn ?? []),
        JSON.stringify(data), now, now
      );
    }
  });

  const insertTaskLink = database.prepare(`
    INSERT INTO task_links (version_id, task_external_id, depends_on_external_id, position) VALUES (?, ?, ?, ?)
  `);
  const insertCardLink = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_card_links (version_id, card_external_id, depends_on_external_id, position) VALUES (?, ?, ?, ?)
  `) : null;
  snapshot.tasks.forEach(task => (task.dependsOn ?? []).forEach((dependency, position) => {
    insertTaskLink.run(versionId, task.id, dependency, position);
    if (insertCardLink) insertCardLink.run(versionId, task.id, dependency, position);
  }));

  const insertWorkstream = database.prepare(`
    INSERT INTO project_workstreams (version_id, external_id, position, title, data_json) VALUES (?, ?, ?, ?, ?)
  `);
  const insertWorkstreamTask = database.prepare(`
    INSERT INTO workstream_tasks (version_id, workstream_external_id, task_external_id, position) VALUES (?, ?, ?, ?)
  `);
  const insertWorkstreamCard = hasCardsTable ? database.prepare(`
    INSERT OR IGNORE INTO project_cards (
      version_id, external_id, element_type, position, title, card_attrs, created_at, updated_at
    ) VALUES (?, ?, 'workstream', ?, ?, ?, ?, ?)
  `) : null;
  (snapshot.companyWorkstreams ?? []).forEach((workstream, position) => {
    const data = without(workstream, new Set(["id", "title", "taskIds"]));
    insertWorkstream.run(versionId, workstream.id, position, workstream.title, JSON.stringify(data));
    if (insertWorkstreamCard) {
      const cardData = { ...data, members: workstream.taskIds ?? [] };
      insertWorkstreamCard.run(
        versionId, workstream.id, position, workstream.title,
        JSON.stringify(cardData), now, now
      );
    }
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
    const template = resolveTemplate(templateId, templateVersion);
    const projectName = options.name ?? fixture.published.title;
    insertOrIgnore(database, "templates",
      ["id", "version", "name", "config_json", "created_at"],
      [template.id, template.version, template.name, templateConfigJson(template), now],
      ["id", "version"]
    );
    const storedTemplate = database.prepare(
      "SELECT name, config_json AS configJson FROM templates WHERE id = ? AND version = ?"
    ).get(template.id, template.version);
    if (storedTemplate.name !== template.name || !semanticallyEqual(JSON.parse(storedTemplate.configJson), template)) {
      throw new Error(`Template ${template.id}@${template.version} differs from the immutable catalog`);
    }
    database.prepare(`
      INSERT INTO projects (
        id, name, template_id, template_version, status, theme_json, terminology_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(
      projectId, projectName, templateId, templateVersion,
      JSON.stringify(options.theme ?? template.theme),
      JSON.stringify(options.terminology ?? template.terminology),
      now, now
    );
    const publishedVersionId = insertVersionGraph(database, projectId, "published", fixture.published, sha256(fixture.published), now, template);
    const draftVersionId = insertVersionGraph(database, projectId, "draft", fixture.draft, sha256(fixture.draft), now, template);
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
