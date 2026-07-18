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

## Phase 1 迁移验收

1. 夹具可在一个 SQLite 事务内导入。
2. 项目 ID、单元 ID 和任务 ID 稳定。
3. 所有依赖均存在且不跨作战单元。
4. 导出后与夹具进行语义等价比较。
5. 旧项目文件和 Git 状态不发生变化。
