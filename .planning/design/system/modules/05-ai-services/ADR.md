# ADR S-05：LLM 是不可信的受限建议服务

状态：`accepted / implemented`
关联：D-004、D-014、D-015、D-028、D-031、D-032

## Context

LLM 需要把材料转成更新建议并回答项目问题，但模型输出可能不稳定、越权、引用错误或受到材料提示注入。平台不能把模型当成数据库用户、审核者或发布者。

## Decision

- Chat 与 Generation 是独立 capability、配额、提示和 Provider 配置。
- Provider 只接收服务端构造的受控上下文，无工具调用。
- Chat 只读取发布态和授权证据，回答引用必须来自 allowlist。
- Generation 锁定发布基准、材料、证据、模板、readiness 和 hash。
- 输出只接受版本化结构化 Schema，服务端独立领域校验。
- 结构错误最多进行一次有界修复调用。
- Provider 关闭或失败不影响非 AI 项目浏览。

## Rejected Alternatives

| 方案 | 原因 |
|---|---|
| 模型直接读数据库 | 破坏项目隔离和查询控制。 |
| 模型调用工具修改项目 | 绕过审核与版本边界。 |
| 自由文本由前端解析 | 不稳定且无法确定性校验。 |
| Chat 与 Generation 共用配额 | 无法分别控制只读查询和高成本更新。 |
| 无证据也给“合理回答” | 会补造项目进度。 |

## Consequences

- 提示词和响应 Schema 都必须版本化测试。
- Provider-specific 参数只能来自服务端 allowlist。
- 模型能力升级不能放宽 proposal/draft/published 边界。

## Invariants

- LLM 永远没有审核、合并、发布或执行代码权限。
- 所有事实和高影响字段必须有允许证据。
- 无来源问答返回不足回答。
- 跨项目证据永远被服务端拒绝。
