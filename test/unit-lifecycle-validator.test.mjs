import assert from "node:assert/strict";
import test from "node:test";
import { validateProposal } from "../src/proposals/validator.mjs";

const baseContext = Object.freeze({
  projectId: "project-a",
  baseVersionId: 1,
  templateId: "project-plan",
  templateVersion: "1.0.0",
  materials: [{ id: "material-00000001" }],
  evidence: [{ evidenceId: "evidence-00000001" }],
  published: {
    units: [{ id: "unit-a", name: "Team A" }],
    stages: [],
    tasks: [{ id: "task-a", unitId: "unit-a", parentId: "", title: "Open Task", progress: 20, dependsOn: [], owner: "Owner", state: "进行中" }],
    risks: [],
    metrics: [],
    outcomes: []
  }
});

function proposal(changes) {
  return {
    schemaVersion: "change-proposal-v1@1.0.0",
    projectId: "project-a",
    baseVersionId: 1,
    template: { id: "project-plan", version: "1.0.0" },
    materialIds: ["material-00000001"],
    summary: "单位生命周期调整。",
    changes,
    warnings: []
  };
}

test("unit lifecycle update requires date reason and evidence", () => {
  assert.throws(() => validateProposal(proposal([{ changeId: "unit-001", module: "units", operation: "update", targetId: "unit-a", semanticType: "fact", patch: { status: "exited" }, evidenceIds: ["evidence-00000001"], confidence: 0.9, warnings: [] }]), baseContext), error => error.code === "UNIT_LIFECYCLE_REQUIRED");
  assert.throws(() => validateProposal(proposal([{ changeId: "unit-001", module: "units", operation: "update", targetId: "unit-a", semanticType: "fact", patch: { status: "exited", effectiveDate: "2026-07-20", lifecycleReason: "团队退出项目" }, evidenceIds: [], confidence: 0.9, warnings: [] }]), baseContext), error => error.code === "EVIDENCE_REQUIRED");
});

test("inactive units cannot keep open tasks unless companion changes close them", () => {
  const inactive = { changeId: "unit-001", module: "units", operation: "update", targetId: "unit-a", semanticType: "fact", patch: { status: "archived", effectiveDate: "2026-07-20", lifecycleReason: "阶段结束" }, evidenceIds: ["evidence-00000001"], confidence: 0.9, warnings: [] };
  assert.throws(() => validateProposal(proposal([inactive]), baseContext), error => error.code === "UNIT_HAS_ACTIVE_TASKS");
  const closeTask = { changeId: "task-001", module: "task-network", operation: "update", targetId: "task-a", semanticType: "fact", patch: { progress: 100, state: "已完成" }, evidenceIds: ["evidence-00000001"], confidence: 0.9, warnings: [] };
  const result = validateProposal(proposal([inactive, closeTask]), baseContext);
  assert.equal(result.validation.taskGraph, true);
  assert.ok(result.warnings.includes("HIGH_IMPACT_FIELD"));
});
