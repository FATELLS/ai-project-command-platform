import { withTransaction } from "../db/database.mjs";
import { importLegacyProject } from "../migration/legacy-project.mjs";
import { createAuthRepository } from "../repositories/auth-repository.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { listTemplates, resolveTemplate } from "../templates/catalog.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const templates = Object.freeze(Object.fromEntries(listTemplates().map(template => [template.id, template])));
const themes = Object.freeze({
  ...Object.fromEntries(listTemplates().map(template => [template.theme.preset, template.theme])),
  "deep-navy": { preset: "deep-navy", accent: "#0b2c68" },
});
const terminologies = Object.freeze(Object.fromEntries(
  listTemplates().map(template => [template.terminology.preset, template.terminology])
));

export class ProjectServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requirePlatformAdmin(principal) {
  if (!principal?.isPlatformAdmin) throw new ProjectServiceError(403, "FORBIDDEN", "无权执行平台管理操作");
}

function validateName(name) {
  const value = String(name ?? "").trim();
  if ([...value].length < 2 || [...value].length > 80) {
    throw new ProjectServiceError(400, "INVALID_PROJECT_NAME", "项目名称长度必须为 2 至 80 个字符");
  }
  return value;
}

function emptySnapshot(name, now, template) {
  return {
    title: name,
    goal: "",
    summary: template.copy.emptyProjectSummary,
    projectStatus: "active",
    statusLabel: "刚刚创建",
    version: "v0.1",
    updatedAt: now,
    overallProgress: null,
    currentStage: "待配置",
    committeeLead: "",
    memberCount: 0,
    members: [],
    meeting: {},
    groups: [],
    stages: [],
    closures: [],
    tasks: [],
    companyWorkstreams: []
  };
}

export function createProjectService(database, options = {}) {
  const projects = createProjectRepository(database);
  const auth = createAuthRepository(database);
  const now = options.now ?? (() => Date.now());
  const timestamp = () => new Date(now()).toISOString();

  function audit(principal, action, projectId, metadata = {}) {
    auth.insertAudit({
      userId: principal.id,
      projectId,
      action,
      targetType: "project",
      targetId: projectId,
      metadata,
      createdAt: timestamp()
    });
  }

  function createProject(principal, input) {
    requirePlatformAdmin(principal);
    const projectId = String(input.id ?? "").trim();
    if (!projectIdPattern.test(projectId)) {
      throw new ProjectServiceError(400, "INVALID_PROJECT_ID", "项目 ID 必须是小写字母、数字、点、下划线或连字符");
    }
    const name = validateName(input.name);
    let template;
    try {
      template = resolveTemplate(input.templateId);
    } catch {
      throw new ProjectServiceError(400, "INVALID_TEMPLATE", "项目模板无效");
    }
    if (projects.getProject(projectId)) throw new ProjectServiceError(409, "PROJECT_EXISTS", "项目 ID 已存在");
    return withTransaction(database, () => {
      const createdAt = timestamp();
      const snapshot = emptySnapshot(name, createdAt, template);
      importLegacyProject(database, { published: snapshot, materials: [], draft: structuredClone(snapshot) }, {
        projectId,
        name,
        templateId: input.templateId,
        templateVersion: template.version,
        templateName: template.name,
        theme: template.theme,
        terminology: template.terminology,
        now: createdAt
      });
      projects.addProjectMember(projectId, principal.id, "project_admin", createdAt);
      audit(principal, "project.created", projectId, { templateId: input.templateId });
      return projects.getProject(projectId);
    });
  }

  function editProject(principal, projectId, input) {
    requirePlatformAdmin(principal);
    const existing = projects.getProject(projectId);
    if (!existing) throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    const name = validateName(input.name ?? existing.name);
    const currentTheme = JSON.parse(existing.themeJson);
    const currentTerminology = JSON.parse(existing.terminologyJson);
    const theme = input.themePreset ? themes[input.themePreset] : themes[currentTheme.preset] ?? currentTheme;
    const terminology = input.terminologyPreset
      ? terminologies[input.terminologyPreset]
      : terminologies[currentTerminology.preset] ?? currentTerminology;
    if (!theme) throw new ProjectServiceError(400, "INVALID_THEME", "主题预设无效");
    if (!terminology) throw new ProjectServiceError(400, "INVALID_TERMINOLOGY", "术语预设无效");
    return withTransaction(database, () => {
      const changedAt = timestamp();
      projects.updateProjectMetadata(projectId, { name, theme, terminology, updatedAt: changedAt });
      audit(principal, "project.edited", projectId, { themePreset: theme.preset, terminologyPreset: terminology.preset });
      return projects.getProject(projectId);
    });
  }

  function changeStatus(principal, projectId, status) {
    requirePlatformAdmin(principal);
    const existing = projects.getProject(projectId);
    if (!existing) throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    if (existing.status === status) return existing;
    return withTransaction(database, () => {
      const changedAt = timestamp();
      projects.setProjectStatus(projectId, status, changedAt);
      audit(principal, status === "archived" ? "project.archived" : "project.restored", projectId);
      return projects.getProject(projectId);
    });
  }

  return {
    createProject,
    editProject,
    archiveProject: (principal, projectId) => changeStatus(principal, projectId, "archived"),
    restoreProject: (principal, projectId) => changeStatus(principal, projectId, "active"),
    templates,
    themes,
    terminologies
  };
}
