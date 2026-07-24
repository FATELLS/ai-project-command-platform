import assert from "node:assert/strict";
import test from "node:test";
import { getProposalTemplate } from "../src/proposals/catalog.mjs";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT_V1 } from "../src/proposals/prompt-builder.mjs";

test("real provider prompt includes the exact proposal shape and bounded template rules", () => {
  const context = {
    projectId: "project-a",
    baseVersionId: 1,
    baseVersionLabel: "v1",
    templateId: "project-plan",
    templateVersion: "1.0.0",
    materials: [{ id: "material-00000001", readiness: { status: "ready" } }],
    evidence: [{ evidenceId: "evidence-00000001", materialId: "material-00000001", materialName: "plan.txt", kind: "text", location: { line: 1 }, text: "建立项目路线。" }],
    published: { projectId: "project-a", units: [], stages: [], tasks: [], risks: [], metrics: [], outcomes: [] }
  };
  const request = buildGenerationPrompt(context, getProposalTemplate("project-plan"));
  const payload = JSON.parse(request.messages[1].content);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /不要 Markdown、代码围栏、解释或额外字段/);
  assert.deepEqual(payload.output_contract.root.exactKeys, ["schemaVersion", "projectId", "baseVersionId", "template", "materialIds", "summary", "changes", "warnings"]);
  assert.deepEqual(payload.output_contract.change.exactKeys, ["changeId", "module", "operation", "targetId", "semanticType", "patch", "evidenceIds", "confidence", "warnings"]);
  assert.deepEqual(payload.template_constraints.operations.roadmap, ["create", "update"]);
  assert.equal(payload.validation_feedback.length, 0);
  assert.equal(request.responseFormat.type, "json_object");
});
