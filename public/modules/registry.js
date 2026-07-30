import {
  renderGantt,
  renderMaterials,
  renderMetrics,
  renderOverview,
  renderOutcomes,
  renderRisks,
  renderRoadmap,
  renderUnits
} from "./renderers.js";

const definitions = [
  ["overview", ["mission-status"], renderOverview],
  ["roadmap", ["campaign-network", "linear-roadmap"], renderRoadmap],
  ["units", ["campaign-cards", "team-cards"], renderUnits],
  ["gantt", ["branching", "lanes"], renderGantt],
  ["outcomes", ["closure-detail", "archive-grid"], renderOutcomes],
  ["risks", ["risk-register"], renderRisks],
  ["metrics", ["metric-cards"], renderMetrics],
  ["materials", ["materials-empty"], renderMaterials]
].map(([type, allowedViews, render]) => Object.freeze({
  type,
  schemaVersion: "1.0.0",
  allowedViews: Object.freeze(allowedViews),
  render
}));

export const moduleRegistry = Object.freeze(Object.fromEntries(definitions.map(definition => [definition.type, definition])));
export const moduleTypes = Object.freeze(definitions.map(definition => definition.type));

export function getClientModule(type) {
  return moduleRegistry[type];
}

export function canonicalModulePath(projectId, type) {
  const encodedProjectId = encodeURIComponent(projectId);
  if (type === "overview") return `/projects/${encodedProjectId}`;
  if (!moduleRegistry[type]) return null;
  return `/projects/${encodedProjectId}/modules/${type}`;
}
