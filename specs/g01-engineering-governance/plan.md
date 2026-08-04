# G01 Plan: Cross-Agent Engineering Governance

## Approach

1. 建 `.specify/memory/constitution.md` — 从 REFACTOR-PLAN §6 提取不可变原则
2. 建 `docs/engineering/TESTING-STANDARDS.md`、`PERFORMANCE-BUDGETS.md`、`SECURITY-STANDARDS.md`
3. 建 `docs/adr/ADR-001` 到 `ADR-003`（PostgreSQL 替代虚谷、模块化单体、两服务运维）
4. 迁移 `.planning/` 文档到 `docs/product/` 和 `docs/architecture/`
5. 重写 `AGENTS.md` 按 REFACTOR-PLAN §1.2
6. 重写 `README.md`
7. 删除/标记 superseded 的过期文档
8. 建 Goal 模板和 verification 模板
9. 验证：fresh-context walkthrough

## Allowed

- `.specify/` 目录
- `docs/**` 全部子目录
- `AGENTS.md`, `README.md` 重写
- `.planning/` 文档迁移和清理
- `specs/` 新增

## Forbidden

- 任何 `.mjs`/`.js`/`.ts` 源码修改
- `package.json` 依赖变更
- 数据库修改
