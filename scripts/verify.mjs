import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = [
  "AGENTS.md",
  "AI-SPEC.md",
  "README.md",
  "docs/RESULT.md",
  "docs/ARCHITECTURE.md",
  "docs/MIGRATION.md",
  ".planning/PROJECT.md",
  ".planning/REQUIREMENTS.md",
  ".planning/ROADMAP.md",
  ".planning/STATE.md",
  ".planning/DECISIONS.md",
  ".planning/PROCESS.md",
  ".planning/HANDOFF.md",
  "fixtures/projects/xugu-agentic-group.json"
];

for (const file of required) await access(join(root, file));

const fixture = JSON.parse(await readFile(join(root, "fixtures/projects/xugu-agentic-group.json"), "utf8"));
const project = fixture.published || fixture;
if (!Array.isArray(project.groups) || project.groups.length !== 7) throw new Error("xugu migration fixture must contain 7 operation units");
if (!Array.isArray(project.tasks) || project.tasks.length !== 29) throw new Error("xugu migration fixture must contain 29 tasks");
if (!Array.isArray(project.stages) || !project.stages.length) throw new Error("xugu migration fixture must contain roadmap stages");
if (fixture.materials && fixture.materials.length) throw new Error("migration fixture must not contain runtime materials");

const ids = new Set();
for (const task of project.tasks) {
  if (!task.id || ids.has(task.id)) throw new Error("fixture task ids must be unique");
  ids.add(task.id);
}
for (const task of project.tasks) {
  for (const dependency of [...(task.dependsOn || []), ...(task.parentId ? [task.parentId] : [])]) {
    if (!ids.has(dependency)) throw new Error(`missing dependency: ${dependency}`);
  }
}

const config = JSON.parse(await readFile(join(root, ".planning/config.json"), "utf8"));
if (config.projectId !== "ai-project-command-platform") throw new Error("planning config project id mismatch");

console.log(`Project scaffold verified: ${project.version}, ${project.groups.length} units, ${project.tasks.length} tasks.`);
