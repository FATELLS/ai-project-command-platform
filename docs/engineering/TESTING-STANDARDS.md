# Testing Standards

> Authority: constitution C-12, REFACTOR-PLAN §6.8

---

## 1. 测试分层

| 层 | 工具 | 目的 | 位置 |
|---|---|---|---|
| Unit | Vitest (API + packages) / Vitest (web) | 单个函数/类的行为 | `tests/unit/` 或 colocated `*.test.ts` |
| Integration | Vitest + Fastify inject + real PostgreSQL | API 路由→service→repository→DB | `tests/integration/` |
| Contract | Vitest + JSON Schema | 请求/响应 schema 验证 | `tests/contract/` |
| E2E | Playwright + real Chromium | 关键用户旅程 | `tests/e2e/` |

## 2. 命名规则

- 测试文件：`<target-name>.test.ts`（单元/集成）或 `<journey>.spec.ts`（E2E）
- 测试标题使用行为语言：`"returns 404 when project does not exist"`
- 一个测试验证一个主要行为

## 3. 数据策略

- **Fixture**：脱敏、最小、语义明确。放在 `tests/fixtures/` 或 `packages/test-kit/`
- **数据库**：真实 PostgreSQL，每测试独立事务回滚或 TRUNCATE
- **时间/UUID/随机数**：固定值，不依赖系统时间
- **外部响应**：mock Provider HTTP 层，不 mock 内部 service

## 4. 覆盖要求

每个业务用例必须覆盖：

1. ✅ 成功路径
2. ❌ 失败路径（验证错误、未找到、冲突、权限不足）
3. 🔒 权限隔离（跨 projectId 访问返回 404/not-found 语义）
4. 🔄 状态转换（非法状态转换被拒绝）

## 5. 运行命令

```bash
# 全量测试
npm test

# 单元测试（快）
npm run test:unit

# 集成测试（需 PostgreSQL）
npm run test:integration

# E2E（需完整应用运行）
npm run test:e2e

# 类型检查
npm run typecheck
```

## 6. 禁止

- 禁止删除、放宽、skip 必需测试
- 禁止改成无意义断言（`expect(true).toBe(true)`）
- 禁止依赖测试执行顺序
- 禁止共享可变测试状态
- 禁止 mock 整个数据库层（集成测试必须用真实 PG）
