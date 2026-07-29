import { createProjectRepository } from "../repositories/project-repository.mjs";
import { validateTemplateManifest } from "../templates/template-validator.mjs";
import { getModuleDefinition, moduleTypes } from "./registry.mjs";
import {
  ModuleValidationError,
  validateModuleConfiguration,
  validateStoredModuleConfiguration,
  validateVersionGraph
} from "./schemas.mjs";

export class ModuleServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ModuleServiceError";
    this.status = status;
    this.code = code;
  }
}

function notFound() {
  throw new ModuleServiceError(404, "MODULE_NOT_FOUND", "模块不存在或你无权访问");
}

function invalid(message) {
  throw new ModuleServiceError(400, "INVALID_MODULE_CONFIGURATION", message);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function sameMembers(values, expected) {
  return values.length === expected.length && expected.every(value => values.includes(value));
}

export function createModuleService(database) {
  const projects = createProjectRepository(database);

  function authorizedGraph(principal, projectId, layer) {
    const project = projects.getAuthorizedProject(principal, projectId, layer);
    if (!project) notFound();
    const graph = projects.getModuleVersionGraph(projectId, layer === "draft" ? "draft" : "published");
    if (!graph) notFound();
    try {
      validateTemplateManifest(graph.template.config);
      validateVersionGraph(graph);
    } catch (error) {
      if (error instanceof ModuleValidationError) throw error;
      throw new ModuleValidationError(`template: ${error.message}`);
    }
    return { project, graph };
  }

  function resolvedModules(graph) {
    const registeredTypes = new Set(moduleTypes);
    const filteredModules = graph.modules.filter(module => registeredTypes.has(module.type));
    const types = filteredModules.map(module => module.type);
    if (new Set(types).size !== types.length || !sameMembers(types, moduleTypes)) {
      throw new ModuleValidationError("modules: must contain exactly the registered module types");
    }
    return filteredModules.map((stored, position) => {
      const definition = getModuleDefinition(stored.type);
      if (!definition) throw new ModuleValidationError(`modules[${position}]: unknown type ${stored.type}`);
      validateStoredModuleConfiguration(stored.configuration, definition, position);
      const templateModule = graph.template.config.modules.find(module => module.type === stored.type);
      if (!templateModule) throw new ModuleValidationError(`modules[${position}]: missing template definition`);
      return {
        type: stored.type,
        schemaVersion: stored.configuration.schemaVersion,
        position,
        enabled: stored.enabled,
        required: graph.template.config.requiredModules.includes(stored.type),
        title: templateModule.title,
        viewVariant: stored.configuration.viewVariant,
        emptyState: templateModule.emptyState
      };
    });
  }

  function manifest(graph, modules) {
    return {
      projectId: graph.projectId,
      layer: graph.layer,
      version: graph.versionLabel,
      template: { id: graph.template.id, version: graph.template.version },
      modules
    };
  }

  function listModules(principal, projectId, layer) {
    const { graph } = authorizedGraph(principal, projectId, layer);
    const modules = resolvedModules(graph);
    return manifest(graph, layer === "draft" ? modules : modules.filter(module => module.enabled));
  }

  function getModule(principal, projectId, layer, moduleType) {
    const { graph } = authorizedGraph(principal, projectId, layer);
    const modules = resolvedModules(graph);
    const module = modules.find(candidate => candidate.type === moduleType);
    if (!module?.enabled) notFound();
    const definition = getModuleDefinition(module.type);
    return {
      projectId: graph.projectId,
      layer: graph.layer,
      version: graph.versionLabel,
      template: { id: graph.template.id, version: graph.template.version },
      module,
      data: definition.loader(graph)
    };
  }

  function validateDraftInput(graph, input) {
    if (!plainObject(input) || Object.keys(input).some(key => key !== "modules") || !Array.isArray(input.modules)) {
      invalid("模块配置必须包含完整的 modules 数组");
    }
    if (input.modules.length !== moduleTypes.length) invalid("模块配置必须包含全部九类模块");
    const types = input.modules.map(module => module?.type);
    if (new Set(types).size !== types.length || !sameMembers(types, moduleTypes)) invalid("模块类型必须完整且不得重复");
    const normalized = input.modules.map((module, position) => {
      const definition = getModuleDefinition(module.type);
      try {
        validateModuleConfiguration(module, definition, position);
      } catch (error) {
        if (error instanceof ModuleValidationError) invalid(error.message.slice(0, 240));
        throw error;
      }
      return { ...module };
    });
    const required = new Set(graph.template.config.requiredModules);
    for (const module of normalized) if (required.has(module.type) && !module.enabled) invalid(`必填模块 ${module.type} 不可禁用`);
    return normalized;
  }

  function updateDraftModules(principal, projectId, input) {
    const { graph } = authorizedGraph(principal, projectId, "draft");
    const normalized = validateDraftInput(graph, input);
    const updated = projects.replaceDraftModuleConfigurations(projectId, normalized);
    if (!updated) notFound();
    validateVersionGraph(updated);
    return manifest(updated, resolvedModules(updated));
  }

  return { listModules, getModule, updateDraftModules };
}

