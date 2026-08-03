# 虚谷项目迁移说明

## 迁移对象

- 稳定项目 ID：`xugu-agentic-group`
- 模板：`campaign-map-v1`
- 脱敏夹具：`fixtures/projects/xugu-agentic-group.json`
- 参考应用：`../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`（只读）

## 保真要求

- 7 个作战单元、29 项任务、6 个阶段。
- 父子关系、前置依赖、阶段日期和甘特窗口。
- 战役路线、BP 闭环、当前节点、公司级战线和成果边界。
- 稳定项目/卡片 ID 与导入导出语义等价。

## 数据边界

不迁移 API Key、运行材料、上传原件、预处理文件、会话、日志和备份。夹具必须保持脱敏。

## 执行

启动虚谷与平台数据库后：

```bash
npm run import:xugu
npm run export:xugu
```

导入在一个显式虚谷事务中创建项目、published/draft 版本、统一卡片和关系。相同内容重复导入保持幂等；相同项目 ID 的不同内容明确拒绝。

## 验收

1. 8 个迁移成功且 checksum 一致。
2. 中文/CLOB 无损。
3. 导出与夹具语义等价。
4. 关系不缺失、不跨版本、不形成非法任务图。
5. 参考应用文件、Git 状态和种子不被修改。
6. 提案合并只增加 draft；发布后 published 才变化；回滚恢复直接前驱。
7. 备份、破坏测试数据、恢复后项目名称与项目图恢复。
