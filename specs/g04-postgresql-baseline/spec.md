# G04 Spec: PostgreSQL 数据基线

## Objective

从业务不变量重建 PostgreSQL 18 schema、唯一 migration tree、Kysely 类型和脱敏 fixture；不迁移旧虚谷数据。

## Allowed

- `packages/database`（migrations、schema、client、types）
- `packages/domain`
- `packages/test-kit`
- `tests/integration`（数据库集成测试）
- `tests/fixtures`（脱敏种子数据）
- `ops/compose.yaml` 的 PostgreSQL 服务定义
- 数据库文档/ADR

## Forbidden

- 运行时双写
- 保留第二 PG schema
- 导入真实/旧虚谷数据
- 修改项目图语义（project_cards / project_card_links 不变）
- CLOB/JSON 字符串机械照搬

## Roadmap

| ID | Milestone | Deliverable |
|---|---|---|
| R04.1 | Canonical data model | Domain entity list with constraints |
| R04.2 | Migration | `0001_create_baseline_schema.sql` |
| R04.3 | Constraints | FK/UNIQUE/CHECK 全覆盖 |
| R04.4 | Fixture | 脱敏种子数据 |
| R04.5 | Backup/restore | pg_dump/pg_restore 验证 |

## Success Criteria

1. 空库 migration PASS
2. 所有业务不变量有 DB 或应用边界
3. 备份恢复后数量/关系/checksum 对账 PASS
4. 只有一个 migration tree

## Failure Indicators

- CLOB/JSON 字符串机械照搬
- 无约束 JSON 堆积
- 迁移真实数据
- down migration 破坏数据
- 连接池泄漏

## Unlocks

- G05 (Fastify 平台基础)
