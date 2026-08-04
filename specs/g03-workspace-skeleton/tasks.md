# G03 Tasks

## T001: Create workspace directories
- Status: ✅ done
- Result: apps/api, apps/web, packages/{contracts,database,domain,test-kit}, tests/{contract,integration,e2e,fixtures}, ops/{container,packaging,scripts}

## T002: Root package.json as workspace root
- Status: ✅ done
- Result: 6 workspaces configured, V1 scripts under `v1:*` prefix, Node 22 engines

## T003: TypeScript strict configuration
- Status: ✅ done
- Result: tsconfig.base.json with strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes

## T004: API skeleton
- Status: ✅ done
- Result: apps/api with package.json, tsconfig.json, src/main.ts, src/app/build-app.ts

## T005: Web skeleton
- Status: ✅ done
- Result: apps/web with package.json, tsconfig.json, src/main.ts, index.html

## T006: Package skeletons
- Status: ✅ done
- Result: contracts, database, domain, test-kit each with package.json + tsconfig.json + index.ts

## T007: Structure verification script
- Status: ✅ done
- Result: scripts/verify-structure.mjs — checks 17 dirs, 9 files, 4 forbidden dirs. PASS.

## T008: Verify V1 still runs
- Status: ✅ done
- Result: V1 scripts accessible via `v1:*` prefix in root package.json
