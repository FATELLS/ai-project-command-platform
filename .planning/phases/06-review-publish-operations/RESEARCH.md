# Phase 6 Research：审核与不可变版本推进

状态：`complete`
日期：2026-07-18

## Finding

当前 normalized version graph 与 `projects.published_version_id/draft_version_id` 已适合采用 copy-on-write：审核决定单独保存；合并时克隆当前 draft、在新版本上应用接受项、运行固定 graph validator，再原子切换 draft pointer。发布同样从当前 draft 克隆新的 published，并建立新 draft 基线。这样任何失败都只留下事务回滚，不会污染现有版本。

## Data model

- `proposal_review_items`：每个 proposal item 的 pending/accepted/rejected、可选 edited patch、note、reviewer/time。
- `proposal_merges`：proposal、源/结果 draft version、accepted/rejected counts、actor/time；proposal 每个基准只合并一次。
- `publication_events`：publish/rollback、from/to published、source draft、actor/time、checklist；提供直接上一版本回滚链。
- `project_import_events` 与现有 `audit_events` 记录运营动作；不把原始材料或密钥放入导出。

## Transaction rules

1. 审核编辑复用原 generation job 的 locked material/evidence envelope，并重新执行 proposal validator。
2. 合并前要求 proposal base 仍为当前 published、所有项已决定、至少一项接受；把接受子集重校验后应用到当前 draft clone。
3. 新 graph 通过模板、固定模块、引用、日期和 DAG validator 后才切换 draft pointer并写 merge/audit。
4. 发布前检查当前 draft ID、graph 完整性、未决提案数和确认清单；发布与新 draft 基线在同一事务提交。
5. 回滚只接受服务端计算的直接前驱 published version；回滚后新 draft 与目标 published 同步。

## Operations

- SQLite backup 使用 `VACUUM INTO` 产生一致快照并执行 `quick_check`；restore 在临时验证数据库上检查完整性、迁移历史和参考表后，先备份现库再替换，且要求服务离线。
- 项目导出沿用脱敏 legacy fixture，不包含用户、会话、密钥、原件路径或运行日志；导入由平台管理员指定稳定 ID 与模板版本并经过完整 fixture validator。
- 评估集覆盖事实/计划、证据缺失、日期冲突、循环依赖、重复、跨项目、stale、编辑后非法和发布回滚。
