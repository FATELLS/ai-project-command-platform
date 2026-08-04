# Vue 3 迁移计划

## 现状

| 维度 | 当前 | 目标 |
|------|------|------|
| 框架 | Vanilla JS（零依赖） | Vue 3 + Composition API |
| 构建 | 无（静态文件直出） | Vite |
| 路由 | 手写 History API | Vue Router |
| DOM | `el()` 命令式构建 + `replaceChildren` | 声明式模板 + 响应式更新 |
| 样式 | `styles.css` 2665 行全局 | Scoped `<style>` + 设计 token |
| 规模 | ~5200 行 JS / ~2700 行 CSS | 组件化拆分 |

## 核心原则

1. **后端 API 零改动** — 所有 `/api/*` 端点保持不变
2. **逐步替换** — 不一刀切，按页面分批迁移，旧页面和新页面可共存
3. **发布包不带 node_modules** — Vite 构建产物输出到 `public/dist/`，portable 包只打包产物

## 技术选型

```
Vue 3.x (Composition API, <script setup>)
Vue Router 4.x
Vite 6.x
Pinia（状态管理，按需引入）
```

不引入 UI 组件库（Element Plus / Naive UI 等），保留现有视觉风格，用原生 CSS + Vue scoped style。

## 迁移阶段

### Phase 0：基础设施搭建（1 天）

1. 在项目根目录初始化 Vite + Vue：
   ```
   frontend/
     package.json
     vite.config.mjs
     index.html
     src/
       main.js
       App.vue
       router/index.js
       stores/          # Pinia stores
       composables/     # 共享逻辑（useApi, useToast, useAuth）
       components/      # 通用 UI 组件
       views/           # 页面级组件
       styles/          # 全局样式 + CSS 变量
   ```

2. `vite.config.mjs` 配置：
   - `build.outDir: '../public/dist'` — 构建产物输出到 public/dist
   - `server.proxy: { '/api': 'http://127.0.0.1:4173' }` — 开发代理
   - `build.target: 'es2020'`

3. `server.mjs` 适配：
   - 生产模式：静态服务 `public/dist/` 目录
   - 开发模式（`PLATFORM_DEV=true`）：服务端不提供静态文件，前端走 Vite dev server proxy

4. CI `assemble-release.mjs` 适配：
   - 打包前先 `cd frontend && npm ci && npm run build`
   - 将 `public/dist/` 打入 release 包

### Phase 1：公共基础（1 天）

1. **Pinia stores**：
   - `useAuthStore` — 登录态、当前用户、CSRF token
   - `useToastStore` — 全局通知
   - `useProjectStore` — 项目列表、当前项目缓存

2. **Composables**：
   - `useApi()` — 替代 `api()` 函数，自动处理 CSRF + 401 跳转
   - `useUpload()` — 文件上传 + 进度

3. **通用组件**：
   - `<AppToast />` — 通知
   - `<ModelSelector />` — 模型选择器（从 v1.0.3 的 createModelSelector 迁移）
   - `<EvidenceBlock />` — 证据块
   - `<EmptyState />`、<LoadingSkeleton />`、`<ErrorPanel />`

4. **布局**：
   - `App.vue` — 顶层布局（导航栏 + `<router-view>`）
   - `MainLayout.vue` — 登录后布局

### Phase 2：认证 + 设置页（1 天）

优先迁移简单页面验证基础设施：

1. `LoginView.vue` — 登录页
2. `SettingsView.vue` — 设置页（AI 配置三个表单 + 连接测试 + 模型选择器）
3. `PasswordChangeView.vue` — 修改密码

这批页面表单交互多、DOM 操作频繁，迁移后收益最明显。

### Phase 3：项目列表 + 概览（1 天）

1. `ProjectsView.vue` — 项目列表
2. `ProjectOverview.vue` — 项目概览模块（renderers.js 中最大的一个）

### Phase 4：项目模块渲染器（2-3 天）

将 `renderers.js`（2827 行）中的 8 个渲染器逐一迁移为 Vue 组件：

| 模块 | 组件 | 复杂度 |
|------|------|--------|
| overview | `<ModuleOverview />` | 中 |
| roadmap | `<ModuleRoadmap />` | 高（树形 + 拖拽） |
| units | `<ModuleUnits />` | 中 |
| gantt | `<ModuleGantt />` | 高（甘特图） |
| outcomes | `<ModuleOutcomes />` | 中 |
| risks | `<ModuleRisks />` | 中 |
| metrics | `<ModuleMetrics />` | 低 |
| materials | `<ModuleMaterials />` | 高（上传 + 处理 + 证据） |

### Phase 5：生成 + 审核 + 材料处理（2 天）

1. `GenerationView.vue` — AI 生成流程（条件配置 → 生成 → 审核 → 发布）
2. `MaterialDetail.vue` — 材料详情
3. `ProjectQAView.vue` — 项目问答

### Phase 6：清理 + 切换（0.5 天）

1. 删除旧的 `public/app.js`、`public/modules/`
2. `index.html` 指向 `public/dist/index.html`
3. 更新 `assemble-release.mjs` 不再打包旧文件
4. 更新 `.gitignore` 排除 `frontend/node_modules/`
5. 更新 CI workflow 增加 `npm ci && npm run build` 步骤

## 开发工作流

```
# 开发（热更新）
cd frontend && npm run dev    # → http://localhost:5173（代理 API 到 4173）

# 后端
node server.mjs               # → http://127.0.0.1:4173

# 构建
cd frontend && npm run build  # → public/dist/

# 生产
node server.mjs               # 服务 public/dist/
```

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| portable 包体积增大 | Vite tree-shake + gzip，预计产物 < 200KB（当前 vanilla JS 无压缩 ~170KB） |
| 构建步骤复杂化 | CI 自动构建，开发者只需 `npm run dev` |
| 迁移期间功能回归 | Phase 2-5 逐步替换，新旧路由共存（旧页面 fallback 到 vanilla JS） |
| 样式不一致 | Phase 1 先迁移 CSS 变量 + 全局 reset，组件 scoped style 逐步替换 |

## 不迁移的东西

- 后端所有代码（server.mjs、src/）
- 数据库和迁移
- 虚谷管理脚本（scripts/）
- 测试结构（E2E 测试适配新前端即可）
