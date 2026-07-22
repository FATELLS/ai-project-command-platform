# Phase 9 验证

最后更新：2026-07-22

## 验证命令

```bash
npm run verify
```

当前通过 149 项后台自动化测试 + 31 项 Playwright 全自动浏览器 E2E。

## 切片一：同单元 parentId 拆解链（LIF-02/03）

- 种子校验：parentId 经迁移往返不丢失、同作战单元、不与 dependsOn 重复（`test/project-migration.test.mjs`）。
- E2E：副泳道带 parentId 的子任务条有 `⇢` 拆解标记（`data-parent` 非空，>=3）；选中任务高亮整条拆解链（rd 三代链 `chain` class），非链任务淡化（E2E 05-10）。

## 切片二：术语模板化（LIF-01）

- E2E：虚谷（campaign）泳道图例显示「事前/事中/事后」；标准项目（standard）显示「规划/执行/交付」（E2E 05-11）。

## 切片三：多源合并收口（LIF-04）

- E2E：3 元素 between 收口锚点渲染、`?anchor=` 深链、详情显示 3 个关联阶段（report-1/launch/pilot）；收口锚点总数 >=3（E2E 05-12）。
- closure 计数断言更新 2→3（`test/db-foundation.test.mjs`、`test/project-migration.test.mjs`）。

## 切片四：单元级分形生命周期（LIF-05）

- E2E：副泳道行头有 unit 级生命周期带标记（`unit-band-*` class，>=7）；platform→prepare（事前）、rd→active（事中）；行头显示模板术语带标签（E2E 05-13）。

## 基线与隔离（沿用）

- fixture 与迁移来源参考种子哈希等价（参考应用两次提交 HEAD `d8224f30`/`90bcc64`）。
- 4 个 browser-evidence manifest 的 reference head/seedSha256 同步更新。
- published/draft/proposal 隔离、CSRF、角色、跨项目 404 不变（沿用 Phase 8 验证）。
- 参考虚谷应用基线已提交更新，工作区干净。
