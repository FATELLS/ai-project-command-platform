# G02 Spec: Baseline Freeze

## Objective

在重构前建立可重复的产品行为、API、数据库语义、发布和资源基线，作为所有后续 Goal 的回归标准。

## Success Criteria

1. `docs/architecture/BASELINE.md` 存在且包含完整 API inventory
2. 数据库 schema 基线记录（37 表 + 关系 + 索引）
3. 核心业务旅程和稳定 ID 记录
4. 资源测量（代码行数、文件大小、tracked 文件数）
5. Forbidden artifact 基线（0 tracked secrets/logs/reports）
6. 已知 gap list 记录

## Failure

- 为获得绿灯删除断言
- 使用开发数据库
- 把历史测试报告提交 Git
- 不记录失败环境

## Forbidden

- 业务重构、目录迁移、换数据库、改 UI
