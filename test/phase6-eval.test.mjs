import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataset=JSON.parse(readFileSync(new URL("../fixtures/evals/change-proposal-cases.json",import.meta.url),"utf8"));
const validationTests=readFileSync(new URL("./proposal-validator.test.mjs",import.meta.url),"utf8");
const reviewTests=readFileSync(new URL("./review-release-service.test.mjs",import.meta.url),"utf8");
const apiTests=readFileSync(new URL("./review-release-api.test.mjs",import.meta.url),"utf8");

test("Phase 6 reference eval dataset is versioned, unique and covers critical dimensions",()=>{
  assert.equal(dataset.schemaVersion,"phase6-eval-v1");assert.equal(dataset.projectId,"xugu-agentic-group");assert.equal(dataset.cases.length,10);
  assert.equal(new Set(dataset.cases.map(item=>item.id)).size,dataset.cases.length);
  for(const item of dataset.cases){assert.match(item.id,/^[a-z0-9-]+$/);assert.ok(["accept","reject"].includes(item.expected));assert.ok(item.description.length>=10);if(item.expected==="reject")assert.ok(item.expectedCode);}
  const dimensions=new Set(dataset.cases.map(item=>item.dimension));for(const dimension of ["grounding","isolation","versioning","graph","dates","duplicates","review","transactions","release"])assert.ok(dimensions.has(dimension));
});

test("reference eval failure modes are tied to deterministic validator, review and API coverage",()=>{
  const corpus=`${validationTests}\n${reviewTests}\n${apiTests}`;
  for(const phrase of ["evidence","cross-project","stale","cycle","date","duplicate","atomic","rollback","CSRF"])assert.match(corpus,new RegExp(phrase,"i"));
});
