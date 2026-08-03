# Design S-07：Product Experience

状态：`Phase 1–10 implemented; Phase 11 first slice verified`

## Technology

- 单页浏览器应用。
- `public/app.js`：路由、平台壳、认证、项目切换、弹窗和 API client。
- `public/modules/registry.js`：固定 browser module map。
- `public/modules/renderers.js`：九模块和材料/审核/发布视图。
- `public/modules/shared.js`：共享 UI helpers。
- `public/material-template-downloads.js`：创建与项目更新入口共用的静态模板目录和下载器。
- `public/styles.css`：全局和模块样式。

不加载远程 registry、CDN 组件或项目脚本。

## Information Architecture

### Platform

- 登录。
- 项目列表。
- 项目创建/生命周期。
- 平台设置，仅 platform admin。

### Project

六个一级工作区：

1. 总览。
2. 项目路线图。
3. 作战单元/团队。
4. 排期甘特。
5. 项目健康。
6. 项目资料。

项目资料包含成果和材料；项目健康包含风险和指标。“AI 生成项目节点预览”属于独立项目更新流程，不进入项目资料二级导航。

## Routing

- URL 是页面和深链状态的可复制表示。
- 项目路由显式包含 projectId。
- roadmap 使用 view/stage/unit/task/anchor。
- material/job/proposal 保留稳定详情路由。
- 未知、越权和历史兼容由 router + server 共同处理。

## Capability Rendering

API DTO 返回 capability。UI：

- 能力存在才渲染操作。
- mutation 前获取 CSRF。
- 服务端拒绝时显示统一业务错误。
- 不从 `isPlatformAdmin` 或 role 字符串推断所有项目动作。

## Template Language

presentation 映射：

- 作战单元/团队。
- 战役节点/里程碑。
- 行动任务/任务。
- 战果/交付物。
- 生命周期标签。

结构共享，显示语言可变。不得把 Xugu 专用文案硬编码到标准项目。

## Core User Journeys

### Enter and Read

登录 → 项目列表 → 选择项目 → 总览 → 路线/团队/甘特/健康/资料。

### Create Project

选择三种入口 → 上传入口可先下载创建模板 → 输入门阀/收集建议 → 确认创建 → 进入项目。

### Update Project

总览或其他通用“项目更新”入口 → 独立更新流程的本次材料步骤 → 处理/readiness → 生成 → 携带具体 `proposalId` 进入模拟路线图 → 路线图核对 → 人工审核 → 合并草稿 → 发布预览 → 人工发布。

“项目资料”只承载战果档案和长期材料台账；“项目更新”不是第七个内容模块，而是独立流程路由。通用 `/updates` 代表开始一次新更新，只显示步骤导航、本次材料输入、处理状态和生成动作；不得自动选择最近 proposal。生成任务成功后使用 `/updates/preview/:proposalId` 打开该次模拟路线图，再由 `/updates/proposals/:proposalId` 进入人工审核。若存在未完成 proposal，材料起点可以显示次要“继续处理”入口，但不能替代本次材料主操作。

模板下载出现在更新材料起点、材料台账、材料录入和材料详情。模拟路线图阶段不重复材料模板、上传区、生成统计或任务列表。

更新页只显示一张路线图。它直接调用正式项目路线图 renderer，输入改为 published graph 叠加当前 proposal 后的内存投影，并通过 preview mode 决定卡片视觉和编辑 capability。不得再维护 `ai-preview-stage-card` / `ai-preview-task-card` 等第二套路线图结构。

### Edit Roadmap Cards

正式路线图和项目更新模拟路线图共用一套侧栏卡片编辑器：

- 主节点字段：标题、日期、状态、说明、预期产出。
- 任务字段：标题、目标、负责人、状态、起止日期、进度、健康度、所属团队、父任务、依赖、相关方、交付物、风险、验收标准、决策和预期产出。
- 已有值可查看和修改；空值保存可清除可选属性；数组字段使用逐项文本输入的受控序列化。
- 删除区与普通保存区视觉分离，只有输入“确认删除”后删除按钮才可用。

正式路线图的编辑按钮创建人工节点预览并进入审核，不让用户误以为已经生效；关键字段或删除时编辑器要求选择项目材料及证据。项目更新模拟路线图只在本次 proposal 的 added/modified 卡片上显示编辑按钮，保存后原地重算；既有上下文卡片使用降亮蒙层、“当前节点·只读”文本和禁用编辑共同表达不可修改。

卡片编辑入口和全局工具使用共享线性图标目录。熟悉命令可使用纯图标，但必须同时提供 `aria-label` 和 `title`；编辑入口固定为卡片内侧右上角的弱化铅笔按钮，不显示可见“编辑”文字，也不得悬浮到路线节点或覆盖标题。窄任务卡采用可收缩标题、纵向状态布局和省略规则，移动端把触控区域扩大到 44×44px。删除、发布等高风险动作仍保留明确文字，不缩减为图标。

### Ask Project

任意项目页面 → 浮动问答 → 带来源回答 → 来源深链。

## Current UI Baseline

Phase 1–10 已实现：

- 白色顶部导航和暖色项目背景。
- 固定模块 renderer。
- 项目切换和六个内容工作区，另有独立项目更新流程。
- 卡片路线图和多视图。
- 材料、问答、提案、审核、发布和设置。
- 三种项目创建入口。

## Verified Current Experience

Phase 11 设计输入位于：

- `.planning/phases/11-workflow-first-ui/11-SPEC.md`
- `.planning/phases/11-workflow-first-ui/UI-SPEC.md`
- `.planning/phases/11-workflow-first-ui/modules/`

截至 2026-08-02 已验证：

- 紧凑平台壳和首屏有效性。
- 六个一级工作区和项目更新独立流程。
- 创建与项目更新入口共享材料模板目录和异常材料门阀。
- 材料可行动状态机。
- 业务变化优先审核。
- 项目更新四步流程：本次材料、处理与生成、模拟路线图、审核与发布。
- 模拟路线图只渲染一张复用正式 renderer 的路线图。
- 正式路线图和 AI 节点预览共享卡片编辑器，且不直写 draft/published。
- 移动端路线/甘特等价投影。
- 设置渐进披露。
- 字号、对比度、焦点和触摸目标。

仍待完成：

- 总览“需要处理 / 当前进展 / 近期变化”的确定性注意力队列。
- 三种创建方式扩展到团队、阶段和任务级 `ProjectSkeleton`。
- 查看者服务端提案读取进一步收紧。
- “确认并发布”的可恢复编排，覆盖 merge 成功但 publish 失败。
- 全弹窗键盘 UAT 和两模板×四角色视觉矩阵。

## Error and Async States

每个 surface 必须定义 loading、empty、partial、forbidden、retryable error、terminal error 和 success。版本变化和发布状态使用持久页面反馈，toast 只做短确认。

## Accessibility

- 语义导航、按钮、表单、dialog、tabs。
- 可见 focus。
- dialog/sheet focus trap、Esc 和 restore。
- 键盘可完成核心流程。
- 动态状态适度 live region。
- reduced motion。

## Responsive

- 桌面使用多栏工具工作台。
- 平板减少辅助栏但保留主要内容。
- 移动端单栏、底部操作和等价列表投影。
- 不通过 CSS 隐藏路线图、甘特或审核主体。

## Verification

- UI server 静态契约。
- Playwright 登录、导航、深链、材料、审核、发布、隔离。
- 独立异常材料 Playwright 套件验证创建/更新失败无部分状态、阶段用途阻断和模板下载覆盖。
- Xugu/standard 两模板。
- platform admin/project admin/editor/viewer。
- Phase 11 第一切片已增加三视口和首屏 bounding-box 断言；完整两模板×四角色视觉/键盘矩阵仍待补齐。
- 2026-08-02 全功能 UI 回归通过：82 项统一主流程/领域 Playwright、9 项异常材料/节点预览 Playwright、Phase 3–6 浏览器证据。
