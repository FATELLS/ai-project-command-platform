# G00: Lock Directory Naming and Migration Mapping

## Objective

在不移动任何源码的前提下，确认最终目录树、目录职责、命名语法和依赖方向，并将当前每个 tracked 文件映射为 keep/move/replace/delete/generated 中唯一一种结果。

## Background

当前项目是一个 vanilla Node.js + 原生 JS 前端的单体应用，使用虚谷数据库。计划重构为 Node.js 22 LTS + TypeScript + Vue 3 + Fastify + PostgreSQL 的模块化单体。G00 是重构的第一步——只写契约文档，不动代码。

## Success Criteria

1. `docs/architecture/PROJECT-STRUCTURE.md` 存在，包含目标目录树和每个目录的 owner/职责/禁止内容/依赖方向
2. `docs/architecture/MIGRATION-MAP.md` 存在，对每个 tracked 文件给出 current→target/action→reason→owner→goal 映射
3. Mapping 覆盖率 = 100%（tracked 文件总数 = mapping 行数）
4. 未映射文件 = 0
5. 重复映射 = 0
6. 不存在 `legacy/`、`common/`、`utils/` 目标目录
7. 依赖图无环
8. 用户明确确认目录命名
9. `git diff --check` 通过
