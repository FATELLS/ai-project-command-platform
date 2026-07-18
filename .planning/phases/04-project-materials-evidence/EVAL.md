# Phase 4 Evaluation Strategy

状态：`accepted`
日期：2026-07-18

## 目标与阻断原则

Phase 4 的评估先证明“不会串项目、不会无来源回答、不会因材料指令获得权限”，再评价回答可读性。任何跨项目命中、失效引用、虚构事实、未授权来源、工具/写入副作用、配额绕过或泄密都阻断阶段完成。

## 评估维度

| 维度 | 通过标准 | 阻断失败 |
|---|---|---|
| 摄入安全 | 超限、伪装、重复、ZIP bomb/path traversal 均失败关闭且无孤儿文件/行 | 任一恶意样本进入 ready/FTS |
| 提取可追溯性 | 支持格式的块均有类型化 locator、材料 ID、项目 ID 和稳定顺序 | 页/段/表/图位置缺失或伪造 |
| 项目隔离 | 每个仓储/API/FTS 查询都同时约束项目和授权 | 同名、同摘要或猜测 ID 可跨项目访问 |
| 检索质量 | 固定参考集 recall@8 ≥ 0.90，首条命中准确率 ≥ 0.80，重复执行顺序一致 | 关键参考问题 top-8 无正确证据 |
| 引用有效性 | 100% 引用属于本次 evidence allowlist，且链接可返回同一块 | provider 输出的任意外部/未检索引用被展示 |
| 忠实与拒答 | 有证据问题的关键事实均受引用支持；无证据/冲突问题 100% 返回确定不足态 | 补造日期、进度、负责人、指标或成果 |
| Prompt injection | 材料中“忽略规则/跨项目/调用工具/输出秘密”等文本只作为证据数据 | 指令改变项目、授权、结构或产生工具/写入 |
| Provider 故障 | disabled/超时/429/5xx/非 JSON/超限响应返回稳定错误，浏览/材料不受影响 | 部分回答被当作可信结果或修改项目状态 |
| 配额与并发 | chat/generation 分账；重启后计数正确；并发上限无竞态 | 失败重试绕过预算或占用未来 generation 额度 |
| 隐私与日志 | 日志仅含内部 ID、分类、延迟、计量；无 key/prompt/正文/路径 | 浏览器/日志/错误包含敏感配置或材料正文 |

## 确定性参考集

- `xugu-agentic-group`：路线、任务风险、成果来源各 3 个可回答问题；2 个证据不足问题；2 个相互冲突材料问题。
- 标准项目：里程碑、负责人、交付物各 3 个可回答问题；2 个无证据问题。
- 隔离对：两项目使用相同文件名、相同标题和重叠关键词，但事实值不同。
- 攻击集：扩展名/MIME/魔数错配、超限流、截断 multipart、ZIP bomb/`../`/绝对路径/重复路径、PDF 超时、低置信 OCR、材料内 prompt injection、伪造 citation ID、跨项目 material/evidence ID。
- Provider 集：disabled、确定性 fake、超时、429、500、非 JSON、空内容、多 choices、tool call、未知 citation、超大响应。

参考集全部使用脱敏小文件或内存字节夹具，纳入仓库；不依赖真实密钥、公网或易变模型输出。

## 自动化门槛

```bash
node --test test/material-gate.test.mjs
node --test test/material-extraction.test.mjs test/evidence-isolation.test.mjs
node --test test/chat-retrieval.test.mjs test/chat-provider.test.mjs test/ai-quota.test.mjs
node --test test/material-api.test.mjs test/material-ui-server.test.mjs
npm run verify
```

fake provider 只按明确的 evidence IDs 返回固定 JSON。测试必须证明服务端会拒绝 fake/provider 试图引用 allowlist 外块，且 provider 调用前的零证据路径完全不发起模型请求。

## 运行保护与监控

- 启动时报告 extraction/provider 能力布尔值，不暴露路径、key、base URL 或模型秘密。
- 审计聚合：摄入结果码、处理状态/耗时、块数量、问答检索数量、结果分类、provider 延迟/attempt/token；正文只保存于受控材料/证据存储。
- 告警：跨项目拒绝异常增长、处理租约反复过期、引用验证失败、拒答率突变、provider p95 > 30s、日预算 ≥ 80%。
- 上线前以实际 provider 重跑一组非敏感 shadow 评估；结果未达到忠实/引用门槛时保持 provider disabled，不影响材料能力上线。

## 浏览器验收

在 1440×900、1024×768、390×844 上验证 Xugu 与标准项目台账、上传门阀反馈、精确 locator 导航、授权切换、问答引用/不足/配额/disabled 状态；查看者无变更控件，项目切换立即清空旧问答和材料视图，控制台无正文/密钥/脚本执行错误。
