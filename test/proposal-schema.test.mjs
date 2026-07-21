import assert from "node:assert/strict";
import test from "node:test";
import { getProposalTemplate, proposalTemplates } from "../src/proposals/catalog.mjs";
import { parseProposal, PROPOSAL_SCHEMA_VERSION } from "../src/proposals/schema.mjs";

function valid() {
  return { schemaVersion: PROPOSAL_SCHEMA_VERSION, projectId: "project-a", baseVersionId: 1,
    template: { id: "meeting-notes", version: "1.0.0" }, materialIds: ["material-00000001"], summary: "形成一项行动任务。",
    changes: [{ changeId: "change-001", module: "task-network", operation: "create", targetId: "task-new-001", semanticType: "plan", patch: { title: "整理数据", unitId: "unit-a" }, evidenceIds: ["evidence-00000001"], confidence: 0.8, warnings: [] }], warnings: [] };
}

test("six immutable proposal templates expose bounded module and field policies", () => {
  assert.equal(proposalTemplates.length, 7); assert.deepEqual(proposalTemplates.map(item => item.id), ["meeting-notes", "project-plan", "progress-report", "metrics-data", "outcome-archive", "new-project-material", "interaction"]);
  assert.equal(getProposalTemplate("meeting-notes", "1.0.0").operations["task-network"].includes("delete"), false);
  assert.equal(getProposalTemplate("new-project-material", "1.0.0").operations.units.includes("create"), true);
  assert.equal(getProposalTemplate("missing", "1.0.0"), undefined);
  assert.throws(() => proposalTemplates.push({}), TypeError);
});

test("exact versioned proposal schema accepts one bounded delta", () => {
  const parsed = parseProposal(JSON.stringify(valid())); assert.equal(parsed.schemaVersion, PROPOSAL_SCHEMA_VERSION); assert.equal(parsed.changes[0].targetId, "task-new-001");
});

test("schema rejects extra fields, executable content, whole snapshots and oversized output", () => {
  const extra=valid();extra.publish=true;assert.throws(()=>parseProposal(extra),error=>error.code==="PROPOSAL_SCHEMA_INVALID");
  const code=valid();code.changes[0].patch={title:"<script>alert(1)</script>"};assert.throws(()=>parseProposal(code),error=>error.code==="PROPOSAL_SCHEMA_INVALID");
  const snapshot=valid();snapshot.changes[0].patch={componentPath:"./evil.js"};assert.throws(()=>parseProposal(snapshot),error=>error.code==="PROPOSAL_SCHEMA_INVALID");
  assert.throws(()=>parseProposal("x".repeat(129*1024)),error=>error.code==="PROPOSAL_SCHEMA_INVALID");
});

test("schema rejects unknown enums, duplicate evidence and invalid confidence", () => {
  for (const mutate of [value=>value.changes[0].module="materials",value=>value.changes[0].semanticType="confirmed",value=>value.changes[0].confidence=1.1,value=>value.changes[0].evidenceIds.push("evidence-00000001")]) {
    const value=valid();mutate(value);assert.throws(()=>parseProposal(value),error=>error.code==="PROPOSAL_SCHEMA_INVALID");
  }
});
