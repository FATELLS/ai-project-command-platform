import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MATERIAL_TEMPLATE_OPTIONS } from "../public/material-template-downloads.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const renderers = readFileSync(new URL("../public/modules/renderers.js", import.meta.url), "utf8");

test("material template catalog covers every supported update and creation purpose", () => {
  assert.deepEqual(MATERIAL_TEMPLATE_OPTIONS.map(item => item.id), [
    "meeting-notes",
    "project-plan",
    "progress-report",
    "metrics-data",
    "outcome-archive",
    "new-project-material"
  ]);
});

test("project creation and every material update surface reuse the template download contract", () => {
  assert.match(app, /downloadMaterialTemplate\("new-project-material"\)/);
  assert.ok((app.match(/下载项目创建模板/g) ?? []).length >= 2);
  assert.match(renderers, /templateDownloadDisclosure\("材料模板"\)/);
  for (const surface of [
    "sheet-template-download",
    "generation-template-download",
    "batch-template-download",
    "empty-template-download"
  ]) assert.match(renderers, new RegExp(surface));
});
