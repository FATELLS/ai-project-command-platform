# Phase 5 Verification

状态：`passed`
日期：2026-07-18
目标：从项目材料生成可校验、带来源、相对当前发布版本的结构化增量；任何生成路径都不得写入 `draft` 或 `published`。

## Goal verdict

Phase 5 目标已实现。生成任务由服务端锁定项目、当前发布基准、1–8 份同模板已授权材料、当前提取代际、证据 ID/哈希和版本化 Schema。provider 输出经过有界解析、精确 envelope、模板/字段/操作、目标、语义/证据、日期、任务依赖 DAG、重复和版本冲突校验后，才会在单事务中保存 pending proposal、item 与 evidence relation。

生成服务、repository 与 HTTP 层均没有 draft/published 写能力；自动化测试对成功、disabled、stale、非法输出和修复失败路径比较项目版本指针，均保持不变。Phase 5 UI 明确只读展示提案，不含接受、驳回、编辑、合并、发布或回滚入口。

## Requirement coverage

| Requirement | Verdict | Evidence |
|---|---|---|
| AIU-01 | PASS | 管理员显式授予 generation 权限；编辑者/管理员从同项目同模板 ready 材料创建幂等任务 |
| AIU-02 | PASS | `change-proposal-v1@1.0.0` 精确 keys、大小/数量/枚举/字段边界与六模板 allowlist |
| AIU-03 | PASS | fact 与高影响字段要求 locked evidence；未知、跨项目、旧代际或未锁定引用失败关闭 |
| AIU-04 | PASS | `fact|plan|suggestion|unknown` 精确枚举、确定性警告和 UI 标签 |
| AIU-05 | PASS | 任务锁定当前 published base，只接收 bounded create/update/delete delta，拒绝全量快照 |
| AIU-06 | PASS | 项目/Schema/目标/日期/DAG/证据/重复/base conflict 纯服务端验证与攻击矩阵 |
| AIU-07 | PASS | provider 无 tools/代码执行；generation 不持有版本写 API，所有路径版本指针不变 |
| NFR-03 | PASS | disabled、stale、非法/超限输出、repair 失败均形成稳定任务状态且不影响项目浏览 |
| AUTH-04 | PASS | generation 密钥/URL 仅服务端环境读取；capability、日志和 API 响应不返回凭据 |

## Automated verification

- `npm test`：120/120 通过。
- migration 005：新装、重复、从 001 升级、跨项目复合关系和最终语句故障回滚通过。
- proposal schema/catalog/validator：额外字段、代码/工具、全量快照、超限、跨项目证据、stale envelope、非法字段/日期、重复与 DAG 环全部拒绝。
- generation/provider：幂等、独立 no-key profile、allowlisted HTTPS、无 tools、有界 output、一次 repair、disabled/stale/失败、attempt/token/cost 和不写版本指针通过。
- API/UI：项目角色、CSRF、统一 404、对象重绑、提案证据、固定安全 DOM、Xugu/标准术语和无 Phase 6 动作通过。
- `npm run verify`：语法、全套测试、迁移/导入导出/API 冒烟、敏感运行文件、Phase 3–5 浏览器证据和参考项目只读校验通过。

## Browser acceptance

`.planning/evidence/phase5-browser-matrix.json` 的 15 个阻断用例全部 PASS，5 张 JPEG 的 SHA-256 与实际尺寸由脚本机检：

- Xugu 提案任务/列表与标准项目空工作区；
- 生成前置条件、成功、无密钥诚实降级和可重试失败；
- Schema 校验摘要、结构化字段、语义/置信度/警告与精确证据回跳；
- 项目切换清空、权限、安全文本、无 Phase 6 动作；
- 1440 桌面、1024×768 平板、390×844 手机；
- 应用 warning 0、error 0、dialog 0。

## Reference integrity

- Reference HEAD：`97cb1ebfbbd4998cdb32d419a5670f1233b7cba8`
- Reference status：clean
- Seed SHA-256：`b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa`

参考 Xugu 应用未被修改。Phase 6 可安全消费 pending proposal，但必须继续通过审核写入 draft，禁止从提案直接发布。
