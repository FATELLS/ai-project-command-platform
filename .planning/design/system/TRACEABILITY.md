# 全项目追踪矩阵

状态：`canonical`

## 1. Requirement to Module

| 需求组 | 主模块 | 协作模块 |
|---|---|---|
| PLAT-01–05 | 02 Identity & Project Access | 01、07 |
| MOD-01–04 | 03 Project Model & Rendering | 07 |
| TPL-01–03 | 03 Project Model & Rendering | 06、07 |
| VIS-01–05 | 03 Project Model & Rendering | 06、07 |
| MAT-01–06 | 04 Materials & Evidence | 01、02、07、08 |
| AIU-01–09 | 05 AI Services | 03、04、06 |
| UNIT-01–03 | 03 Project Model & Rendering | 06 |
| LIF-01–05 | 03 Project Model & Rendering | 06、07 |
| REV-01–08 | 06 Change Control & Release | 03、04、07 |
| AUTH-01–05 | 02 Identity & Project Access | 01、08 |
| CHAT-01–05 | 05 AI Services | 04、07 |
| DATA-01–02 | 01 Runtime & Persistence | 全模块 |
| NFR-01–08 | 01 / 08 | 全模块 |
| CRT-01–06 | 02 / 07 | 03、04、05 |
| SIM-01–04 | 04 / 06 / 07 | 05 |
| UX-01 | 07 Product Experience | 03 |
| WUI-01–23 | 07 Product Experience | 全模块 capability/DTO |

## 2. Module to Code and Tests

| 模块 | 代码边界 | 主要测试 |
|---|---|---|
| 01 Runtime & Persistence | `server.mjs`、`scripts/manage-server.mjs`、`src/db/`、`src/paths.mjs` | db-foundation、database-backup、server-lifecycle、packaging |
| 02 Identity & Project Access | `src/security/`、auth/project/member service/repository、HTTP auth/project routes | auth-*、project-api、member-service、E2E 01/04 |
| 03 Project Model & Rendering | `src/templates/`、`src/modules/`、`src/domain/`、`src/versions/` | module-*、template-catalog、unit-lifecycle、roadmap E2E |
| 04 Materials & Evidence | `src/materials/`、material service/repository、`public/material-template-downloads.js` | material-*、evidence-isolation、material-template-downloads、E2E 03/04/06 |
| 05 AI Services | `src/ai/`、`src/proposals/` generation/context/prompt/validator、chat service | ai-quota、chat-*、generation-*、proposal-* |
| 06 Change Control & Release | `src/review/`、`src/release/`、proposal service/repository | review-release-*、interaction-proposal、phase6-eval、E2E 03 |
| 07 Product Experience | `public/`、`src/http/static.mjs` | *-ui-server、E2E 01–06、异常材料套件、视觉证据 |
| 08 Operations & Delivery | `src/operations/`、`src/migration/`、`scripts/`、`.github/`、打包配置 | observability-product-test、project-migration、database-backup、server-lifecycle、packaging |

## 3. Decision to Module

| 模块 | 中央决策 |
|---|---|
| 01 | D-005、D-007、D-008、D-018、D-027、D-029、D-043 |
| 02 | D-002、D-006、D-009、D-030 |
| 03 | D-003、D-010–013、D-019、D-021–026 |
| 04 | D-014、D-019、D-027、D-031、D-044 |
| 05 | D-004、D-014、D-015、D-028、D-031、D-032 |
| 06 | D-004、D-015–017、D-019–021、D-031、D-038、D-045–046 |
| 07 | D-010–012、D-021、D-025–026、D-030–041、D-044–046 |
| 08 | D-001、D-018、D-020、D-027–029、D-043 |

## 4. Phase to System Module

| Phase | 系统模块 |
|---|---|
| Phase 1 | 01、02、03、08 |
| Phase 2 | 02、07 |
| Phase 3 | 03、07 |
| Phase 4 | 04、05、07 |
| Phase 5 | 05、06、07 |
| Phase 6 | 02、06、08、07 |
| Phase 7 | 03、04、06、08 |
| Phase 8 | 03、06、07 |
| Phase 9 | 03、06、07 |
| Phase 10 | 02、04、05、06、07 |
| Phase 11 | 07，及少量 02/03/04/06/08 DTO 或只读 API |

## 5. Verification Gates

### Database and Domain

- 所有迁移顺序、checksum、外键和触发器通过。
- 项目版本图、生命周期、日期和依赖校验通过。
- 备份恢复与迁移等价通过。

### Security and Isolation

- 会话、CSRF、登录限流和强制改密通过。
- 四角色矩阵通过。
- 材料、证据、问答、提案和发布跨项目访问全部阻止。
- 密钥、材料正文和提示词不进入诊断。

### AI and Change Control

- readiness blocked 不调用 provider。
- 模型非法输出、无证据事实和 stale base 被拒。
- 审核、合并、发布和回滚边界独立可测试。
- 节点预览只在内存投影待决定/已接受项，排除已驳回项，不写 draft/published。
- 正式路线图编辑/删除只创建 interaction proposal；AI 预览编辑只影响当前 proposal change item，强确认删除不产生越权直写。

### Product Experience

- 路由刷新、深链、Back、会话过期和越权行为通过。
- Xugu 与标准模板术语和视图通过。
- 创建与更新材料异常不产生部分状态；统一模板目录覆盖全部材料输入和更新发起入口。
- 项目资料与项目更新路由、导航和页面职责分离；旧节点预览入口兼容重定向到独立更新流程。
- 通用项目更新入口从本次材料开始，不自动打开最近 proposal；生成完成后以具体 proposalId 进入预览，再按审核、合并和发布推进。
- 路线图和节点预览的可编辑卡片均有明确编辑入口；预览中的既有节点降亮、标注只读且不能触发 mutation。
- 项目更新页只出现一张复用正式路线图 renderer 的模拟路线图，不出现统计卡、proposal 列表、生成任务列表或第二套路线图 DOM。
- 熟悉工具与卡片操作使用共享线性图标目录；纯图标按钮具备可访问名称和 tooltip，编辑入口位于卡片边界内且不遮挡标题，高风险动作保留文字。
- Phase 11 第一切片已增加三视口首屏和移动核心内容证据；完整键盘流程与两模板×四角色矩阵见 Phase 11 验证记录中的剩余项。

### Delivery

- `npm run verify` 全绿。
- 安装包不包含数据库、材料、密钥、日志、测试和规划文件。
- portable/RPM 在原生 runner 启动并通过 `/health`。

## 6. Change Control

- 需求变化：先改 `.planning/REQUIREMENTS.md`。
- 架构边界变化：先改模块 ADR 和 `.planning/DECISIONS.md`。
- 模块接口/状态变化：先改模块 DESIGN。
- 单阶段实现细节：写入对应 phase SPEC/PLAN。
- 验证完成：更新 `docs/RESULT.md`、STATE、PROCESS 和 HANDOFF。
