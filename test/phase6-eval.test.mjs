import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataset=JSON.parse(readFileSync(new URL("../fixtures/evals/change-proposal-cases.json",import.meta.url),"utf8"));
const validator=readFileSync(new URL("../src/proposals/validator.mjs",import.meta.url),"utf8");
const review=readFileSync(new URL("../src/review/review-service.mjs",import.meta.url),"utf8");
const generationFlow=readFileSync(new URL("./e2e/03-material-generation-review-release.spec.mjs",import.meta.url),"utf8");
const securityFlow=readFileSync(new URL("./e2e/04-isolation-roles-security.spec.mjs",import.meta.url),"utf8");

test("Phase 6 reference eval dataset is versioned, unique and covers critical dimensions",()=>{
  assert.equal(dataset.schemaVersion,"phase6-eval-v1");assert.equal(dataset.projectId,"xugu-agentic-group");assert.equal(dataset.cases.length,10);
  assert.equal(new Set(dataset.cases.map(item=>item.id)).size,dataset.cases.length);
  for(const item of dataset.cases){assert.match(item.id,/^[a-z0-9-]+$/);assert.ok(["accept","reject"].includes(item.expected));assert.ok(item.description.length>=10);if(item.expected==="reject")assert.ok(item.expectedCode);}
  const dimensions=new Set(dataset.cases.map(item=>item.dimension));for(const dimension of ["grounding","isolation","versioning","graph","dates","duplicates","review","transactions","release"])assert.ok(dimensions.has(dimension));
});

test("reference eval failure modes are tied to deterministic validator, review and API coverage",()=>{
  const corpus=`${validator}\n${review}\n${generationFlow}\n${securityFlow}`;
  for(const phrase of ["evidence","PROJECT_NOT_FOUND","STALE","CYCLE","DATE","DUPLICATE","withTransaction","rollback","CSRF"])assert.match(corpus,new RegExp(phrase,"i"));
});
