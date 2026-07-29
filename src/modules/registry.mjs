import {
  loadGantt, loadMaterials, loadMetrics, loadOverview,
  loadRisks, loadRoadmap, loadTaskNetwork, loadUnits
} from "./loaders.mjs";

const definitions = [
  ["overview", "Overview", ["mission-status"], loadOverview],
  ["roadmap", "Roadmap", ["campaign-network", "linear-roadmap"], loadRoadmap],
  ["units", "Units", ["campaign-cards", "team-cards"], loadUnits],
  ["task-network", "Task Network", ["branching-network", "dependency-list"], loadTaskNetwork],
  ["gantt", "Gantt", ["branching", "lanes"], loadGantt],
  ["risks", "Risks", ["risk-register"], loadRisks],
  ["metrics", "Metrics", ["metric-cards"], loadMetrics],
  ["materials", "Materials", ["materials-empty"], loadMaterials]
].map(([type, name, allowedViews, loader]) => Object.freeze({
  type,
  name,
  schemaVersion: "1.0.0",
  allowedViews: Object.freeze(allowedViews),
  loader
}));

export const moduleRegistry = Object.freeze(Object.fromEntries(definitions.map(definition => [definition.type, definition])));
export const moduleTypes = Object.freeze(definitions.map(definition => definition.type));

export function getModuleDefinition(type) {
  return moduleRegistry[type];
}

export function listModuleDefinitions() {
  return definitions.slice();
}

