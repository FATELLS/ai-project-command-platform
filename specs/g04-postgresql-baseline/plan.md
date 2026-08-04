# G04 Plan

## T001: Write 0001_create_baseline_schema.sql

从 V1 的 37 张表（BASELINE.md §3）重建为 PG 18 native schema：
- VARCHAR(40) timestamps → TIMESTAMPTZ
- CLOB → JSONB（结构化 JSON）或 TEXT（自由文本）
- INTEGER IDENTITY → GENERATED ALWAYS AS IDENTITY
- INTEGER booleans → BOOLEAN
- 添加所有被虚谷跳过的 CHECK 约束（70+）
- 添加 trigger 替代（版本指针校验）
- 保持 project_cards/project_card_links 为唯一项目图

## T002: Write Kysely types and client

- `packages/database/src/types/db.ts` — Kysely DB type（全部 37 表）
- `packages/database/src/client/create-client.ts` — 连接池工厂
- `packages/database/src/client/transaction.ts` — 事务原语

## T003: Write sanitized fixtures

- `tests/fixtures/seed-baseline.sql` — 脱敏种子数据
- 保留 `xugu-agentic-group` 作为 stable external ID
- 无真实人名、公司名

## T004: Write integration tests

- Migration replay test（空库 → migrate → 验证表存在）
- 重复运行保护（migrate twice → 第二次无变化）
- 中文/JSON/时间/事务/并发测试
- pg_dump/pg_restore 往返测试

## T005: Write docker-compose for PostgreSQL

- `ops/compose.yaml` — PostgreSQL 18 服务

## T006: Update changes docs + VERIFICATION
