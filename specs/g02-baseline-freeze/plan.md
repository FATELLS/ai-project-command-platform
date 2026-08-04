# G02 Plan: Baseline Freeze

## Approach

1. 从代码提取 API inventory（通过分析 src/http/app.mjs 路由）
2. 从迁移文件提取数据库 schema 基线（001-008 SQL）
3. 记录核心业务旅程和稳定 ID
4. 测量代码体积和 tracked 文件数
5. 验证 forbidden artifact 基线（0 tracked）
6. 记录已知 gap list
7. 写 BASELINE.md

## Allowed

- `docs/architecture/BASELINE.md` 新建
- `specs/g02-baseline-freeze/` SDD 工件
- 只读分析代码和迁移文件

## Forbidden

- 任何源码修改
- 任何依赖变更
