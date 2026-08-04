# G01 Spec: Cross-Agent Engineering Governance

## Objective

让新 Agent 在没有聊天上下文时，仅靠仓库恢复相同的编码思想、命名、目录、决策和执行流程。

## Success Criteria

1. `.specify/memory/constitution.md` 存在，包含 REFACTOR-PLAN §6 全部不可变原则
2. `docs/engineering/` 下有 TESTING-STANDARDS、PERFORMANCE-BUDGETS、SECURITY-STANDARDS
3. `docs/adr/` 下至少有 3 条 ADR（PostgreSQL 替代虚谷、模块化单体、两服务运维）
4. `AGENTS.md` 按 REFACTOR-PLAN §1.2 重写，强制阅读顺序正确，指向有效路径
5. `README.md` 重写，反映新架构
6. `.planning/` 产品文档迁移到 `docs/product/`，设计文档迁移到 `docs/architecture/`
7. 过期文档标记 superseded 或删除（PROCESS.md、MIGRATION.md、VUE-MIGRATION-PLAN.md）
8. 新 Agent fresh-context walkthrough 可准确说出目标目录、命名、唯一数据库、运行服务上限

## Failure

- `.planning` 与新 docs 同时作为权威
- AGENTS 仍指向失效路径
- 规范只写原则没有可执行例子

## Forbidden

- 修改应用源代码、依赖、数据库、运行脚本
