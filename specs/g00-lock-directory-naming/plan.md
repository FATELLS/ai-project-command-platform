# G00 Plan: Directory Lock and Migration Mapping

## Approach

1. 用 `git ls-tree -r HEAD --name-only` 生成当前 tracked 文件完整清单（已完成，218 文件）
2. 将 REFACTOR-PLAN.md §3 的目标目录树写入 `PROJECT-STRUCTURE.md`，附每个目录的 owner/职责/禁止内容/依赖方向
3. 为全部 218 个 tracked 文件建立 current→target/action→reason→owner→goal 映射表
4. 检查覆盖率：unmapped=0, duplicate=0
5. 等待用户确认目录命名

## Allowed Modifications

- `docs/REFACTOR-PLAN.md`（如有微调）
- 新建 `docs/architecture/PROJECT-STRUCTURE.md`
- 新建 `docs/architecture/MIGRATION-MAP.md`
- 新建 `specs/g00-*/` 工件
- 新建 `docs/changes/` 变更记录

## Forbidden

- 移动/重命名/删除任何源码
- 修改 package 依赖
- 创建 apps/ 或 packages/ 代码
- 修改数据库

## Key Decisions

- Node 22 LTS（而非计划中原文写的 Node 24 LTS）
- `.specify/` 目录在 G01 手动创建，不依赖 `specify init` CLI
