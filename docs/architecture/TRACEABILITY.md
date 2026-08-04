# Traceability: Requirements → Code → Tests

> Migrated from `.planning/design/system/TRACEABILITY.md`. Updated for V2 architecture.

| Requirement | Design/Code Location (V2) | Primary Validation |
|---|---|---|
| DATA-01 PostgreSQL 唯一后端 | `packages/database/` | `tests/integration/database.test.ts` |
| DATA-02 统一项目图 | `project.repository.ts`, `version-store.ts` | 导入导出 E2E |
| DATA-03 参数化 SQL | Kysely queries throughout | code review + lint |
| DATA-04 projectId 隔离 | all service/repository | 跨项目负面测试 |
| PROJ-01 多项目 | `project.service.ts`, `member.service.ts` | integration test |
| PROJ-03 固定视图 | `apps/web/src/features/project-workspace/` | E2E |
| MAT-01 材料证据 | `materials/` module | material E2E |
| MAT-02 readiness | `readiness.service.ts` | integration test |
| AI-01 有来源结构提案 | `ai-services/` module, `proposal-validator.ts` | proposal schema test |
| AI-03 AI 不发布 | service layer enforcement | negative test |
| GOV-01 人工审核 | `change-governance/` module | review E2E |
| GOV-04 前驱回滚 | `version-apply.ts` | rollback test |
| SEC-01 认证 CSRF | `identity/` module, auth plugin | auth E2E |
| SEC-03 项目隔离 | service-layer permission checks | cross-project test |
| SEC-04 密钥脱敏 | `settings.service.ts` | settings test |
| OPS-01 两服务上限 | deployment manifest | ADR-003 |
| REL-02 无数据发布包 | `ops/scripts/assemble-release.ts` | artifact check |
| TEST-04 无第二数据库 | CI gate (dependency check) | lint/CI |
