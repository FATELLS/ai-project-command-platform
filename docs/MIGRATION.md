# 虚谷项目迁移说明

## 原则

现有项目 `/Users/mingyuzhuo/Documents/Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/` 保持不变。新平台只能读取其脱敏种子或显式导出文件，不在原目录执行平台化重构。

## 首个项目

- `projectId`：`xugu-agentic-group`
- 显示名称：虚谷 AI 转型促进作战地图
- 模板：`campaign-map-v1`
- 迁移夹具：`fixtures/projects/xugu-agentic-group.json`

## 必须保留

- 7 个作战单元；
- 29 项任务及父子、依赖关系；
- 战役路线、BP 闭环、第一次汇报和当前节点；
- 四条公司级战线；
- 甘特计划窗口；
- 事实、计划、待确认和成果边界；
- 蓝、白、暖橙视觉以及曲线路标主视觉。

## 不迁移到 Git 夹具

- API Key；
- 运行态材料台账；
- 上传原件；
- 预处理 Markdown；
- 本机后台会话和日志。

## 迁移与发布验收

1. 夹具可在一个 SQLite 事务内导入。
2. 项目 ID、单元 ID 和任务 ID 稳定。
3. 所有依赖均存在且不跨作战单元。
4. 导出后与夹具进行语义等价比较。
5. 旧项目文件和 Git 状态不发生变化。
6. 审核新增任务后，草稿为 30 项任务而发布版仍为 29 项。
7. 人工发布后发布版为 30 项任务，直接前驱回滚后恢复 29 项任务。
8. 发布、回滚和操作者可从追加式审计与发布事件复核。
9. 后续材料更新会先显示关键内容覆盖；关键缺失不会调用生成 provider。
10. 作战单元归档或退出不会物理删除历史事实，必须通过带证据提案和发布流程进入当前版本。

## 已实现方式

- 导入前校验两个快照的 ID、单元归属、父子关系、前置依赖和循环。
- 在一个 SQLite 事务内创建项目、`published`/`draft` 版本图和所有关系实体。
- 相同夹具重复导入是幂等操作；同一项目 ID 的不同内容会明确拒绝。
- 导出器从规范化表重建原夹具语义，自动化测试使用深度等价比较。
- 统一验证前后比较参考应用 HEAD、Git 状态和种子 SHA-256。
- `xugu-agentic-group` 浏览器 UAT 已执行材料提案、整模块接受、事务草稿合并、发布预览、发布和直接前驱回滚；全过程不修改参考目录。
- `xugu-agentic-group` 作为 Phase 7 首个作战项目，Materials 工作区已包含关键内容诊断、作战单元生命周期提案校验入口和管理员运维自检。

当前脱敏种子基线：

```text
b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa
```

手工验收：

```bash
node scripts/import-project.mjs --database /tmp/platform.sqlite --fixture fixtures/projects/xugu-agentic-group.json --project xugu-agentic-group
node scripts/export-project.mjs --database /tmp/platform.sqlite --project xugu-agentic-group --stdout
```
