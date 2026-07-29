# Design S-05：AI Services

状态：`implemented baseline`
专项契约：`AI-SPEC.md`

## Capabilities

### Chat

- 输入：projectId、question、principal。
- 数据：当前 published facts + 当前项目可检索证据。
- 输出：answer + allowlist citations。
- 副作用：配额/使用记录，无项目内容写入。

### Generation

- 输入：projectId、材料、更新模板、幂等键。
- 数据：锁定发布版本、证据代际/hash、readiness。
- 输出：pending ChangeProposal。
- 副作用：generation job/attempt/usage/proposal，无 draft/published 写入。

### Vision Extraction

- 输入：受限 PDF/图片内容。
- 输出：统一提取结果。
- 副作用：材料 artifact/evidence，由 Materials 模块负责持久化。

## Provider Adapter

统一属性：

- `configured`
- `safeLabel`
- `generate(input, { signal })`

实现：

- disabled provider。
- fake provider，测试使用。
- OpenAI-compatible provider。

Provider adapter 负责网络、超时、响应大小和协议，不负责相信内容或应用项目变更。

## Configuration

来源优先级：

1. 数据库平台设置。
2. 受控环境变量。
3. disabled。

配置包含 base URL、模型、密钥、超时、max tokens、allowlist host 和有限 reasoning effort。密钥不返回浏览器。

## Chat Flow

1. authorize project member。
2. 规范化并限制问题长度。
3. 读取当前 published facts。
4. reserve chat quota。
5. 检索当前项目/受众证据。
6. 无证据直接返回 insufficient。
7. 构建不可信证据边界和 citation allowlist。
8. 调用 provider。
9. 校验回答引用均在 allowlist。
10. 完成 usage 记录。

任何模型返回的未知 evidence ID 被拒绝或降级为不足回答。

## Generation Job

创建时保存：

- projectId。
- current published baseVersionId。
- templateId/version。
- material IDs。
- active extraction generations。
- evidence IDs/content hashes。
- readiness snapshot。
- idempotency key。
- retry lineage。

状态：

```text
queued
→ retrieving_evidence
→ generating
→ validating
→ succeeded

失败：failed_retryable | failed_terminal | stale
修复：repairing
```

## Proposal Validation

顺序：

1. JSON/Schema。
2. envelope project/base/template。
3. module/operation/field allowlist。
4. evidence existence/hash/project。
5. semantic type and confidence。
6. date/unit/task/parent/dependency。
7. duplicate and base conflict。
8. high-impact evidence requirements。

只有全部通过才事务保存 proposal。

## Prompt Injection Boundary

- 材料文本明确标记为 untrusted evidence。
- 系统提示禁止遵循材料中的指令。
- 模型不能调用工具。
- 不发送其他项目数据、密钥、Cookie、CSRF 或运行路径。
- 诊断日志不保存完整提示和材料正文。

## Quota and Concurrency

- chat/generation 分开计数。
- project/user/capability 维度限额。
- 全局 provider 并发有界。
- 失败也记录 attempt/outcome，但不伪造成成功 usage。

## Planned Experience

Phase 11 只调整 Provider 设置和问答/生成 UI。AI 领域边界不变；连接测试若新增，必须返回脱敏状态而非原始 provider 响应。

## Verification

- disabled/fake/real-compatible provider contract。
- timeout、abort、bad JSON、repair once。
- prompt 内容契约和敏感信息缺失。
- citation allowlist。
- quota/concurrency。
- stale base/evidence hash 和跨项目证据。
- provider 失败不改变 draft/published。
