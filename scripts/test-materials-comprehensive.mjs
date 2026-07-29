/**
 * 大规模材料测试脚本
 * 
 * 测试覆盖：
 * - 5 种项目类型（销售/研发/管理/市场/基础设施）
 * - 6 种更新模板（meeting-notes / project-plan / progress-report / metrics-data / outcome-archive / new-project-material）
 * - 多种内容质量（高质量/低质量/空内容/垃圾内容/边界情况）
 * - 多种内容类型（会议纪要/项目计划/进度汇报/指标数据/成果归档）
 * - 边界情况（超长文本/特殊字符/极短内容/Unicode/emoji）
 */

import { openDatabase } from "../src/db/database.mjs";
import { createProposalService } from "../src/services/proposal-service.mjs";

const BASE = "http://127.0.0.1:4173";
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin12345678";

// ============================================================
// 测试数据：各种质量和类型的材料内容
// ============================================================

const TEST_MATERIALS = {

  // ===== 高质量材料 =====
  hq_meeting_notes: {
    title: "Q3产品规划会议纪要-2026年7月",
    body: `会议时间：2026年7月15日 14:00-16:00
参会人员：张明（产品总监）、李华（技术负责人）、王芳（设计师）、赵强（项目经理）

会议议题：
1. Q3产品路线图评审
2. 技术架构升级方案讨论
3. 资源分配与排期确认

决议事项：
- 确认Q3核心目标：完成混合云迁移平台MVP，目标上线日期2026年9月30日
- 技术架构从单体应用迁移到微服务架构，使用Kubernetes作为容器编排平台
- 新增"目标架构设计"任务，负责人李华，预计8月15日前完成设计文档
- "混合云迁移"任务状态从"规划中"更新为"进行中"，进度30%→50%
- 识别新风险：Kubernetes集群稳定性风险，严重程度"高"，需制定缓解方案
- 确认里程碑：8月30日完成架构设计评审，9月15日完成开发，9月30日上线

行动项：
- 张明负责协调跨部门资源，8月1日前确认外部供应商合作
- 李华负责输出技术架构设计文档，8月15日前完成
- 王芳负责UI/UX设计方案，8月20日前提交评审
- 赵强负责项目排期更新和风险跟踪`,
    template: "meeting-notes"
  },

  hq_project_plan: {
    title: "基础设施迁移项目计划书",
    body: `项目名称：基础设施云迁移工程
项目周期：2026年7月1日 - 2026年12月31日
项目负责人：赵强

项目目标：
将现有单体架构应用迁移至混合云平台，实现99.9%可用性目标，降低运维成本30%。

项目范围：
1. 新增作战单元"云基础设施组"，5人编制
2. 建立混合云网络架构（AWS+私有云）
3. 容器化改造（Docker+Kubernetes）
4. CI/CD流水线建设
5. 监控告警体系搭建

关键里程碑：
- M1（8月）：架构设计完成，评审通过
- M2（9月）：MVP版本上线，核心功能可用
- M3（10月）：数据迁移完成，双轨运行
- M4（11月）：全量切换，旧系统下线
- M5（12月）：项目收尾，经验复盘

人员安排：
- 云基础设施组：李华（组长）、张伟、陈静、刘洋、周杰
- 负责范围：架构设计、容器编排、网络配置、监控运维

风险预算：
- 预留15%缓冲时间应对技术不确定性
- 准备回滚方案，确保业务连续性`,
    template: "project-plan"
  },

  hq_progress_report: {
    title: "2026年7月项目进度月报",
    body: `报告周期：2026年7月1日-7月31日
编制人：赵强（项目经理）

一、整体进度
项目整体进度：65%（上月55%，环比增长10%）
当前阶段：开发实施阶段
健康状态：良好（绿色）

二、关键任务进展
1. 混合云迁移任务：状态"进行中"，进度50%→65%
   - 完成了AWS VPC网络搭建
   - Kubernetes集群部署完成，3节点运行正常
   - 数据库迁移方案已验证

2. 监控告警系统：状态"进行中"，进度30%→45%
   - Prometheus+Grafana部署完成
   - 核心指标采集已接入
   - 告警规则配置中

3. 安全审计任务：状态"已完成"
   - 通过了ISO27001安全审计
   - 发现3个中风险问题已全部修复

三、风险更新
- 新增风险：云服务成本超预算风险（严重程度：中）
  缓解措施：启用成本告警，优化资源使用
- 已缓解风险：Kubernetes稳定性风险从"高"降为"中"

四、下月计划
- 完成数据迁移双轨验证
- 启动全量切换准备工作
- 完成安全渗透测试`,
    template: "progress-report"
  },

  hq_metrics_data: {
    title: "Q3系统运行指标数据-7月",
    body: `数据周期：2026年7月
数据来源：Prometheus监控系统

核心指标：
1. 系统可用性：99.95%（目标99.9%，超标完成）
2. 平均响应时间：128ms（目标<200ms，达标）
3. 错误率：0.03%（目标<0.1%，达标）
4. 日活用户数：12,450（环比增长15%）
5. API调用量：日均320万次（环比增长8%）
6. 服务器CPU平均利用率：45%（目标<70%，健康）
7. 内存平均利用率：62%（目标<80%，健康）
8. 磁盘使用率：38%（目标<60%，健康）

月度趋势：
- 可用性：连续3个月保持在99.9%以上
- 响应时间：从上月145ms降至128ms，改善12%
- 错误率：与上月持平，维持低位
- 用户增长：连续6个月保持10%以上增速

异常事件：
- 7月18日 03:00-03:15 发生一次短暂服务降级（可用性影响0.02%）
- 原因：数据库连接池耗尽，已扩容修复`,
    template: "metrics-data"
  },

  // ===== 低质量材料（销售场景为主）=====

  lq_vague_notes: {
    title: "随便记的笔记",
    body: `今天开了个会，讨论了一些事情。
领导说要加快进度。
大家觉得可以试试。
然后就散会了。`,
    template: "meeting-notes"
  },

  lq_off_topic: {
    title: "团建活动记录",
    body: `2026年7月20日团建活动

活动内容：密室逃脱+聚餐
参与人员：全体15人
费用：人均150元，总计2250元
地点：XX密室逃脱（五道口店）

大家玩得很开心，下次建议去爬山。`,
    template: "meeting-notes"
  },

  // --- 销售低质量：微信群聊碎片化记录 ---
  lq_sales_wechat_group: {
    title: "销售大群聊天记录",
    body: `\u5f20\u603b \u4eca\u5929\u548c\u519c\u884c\u7684\u5468\u603b\u89c1\u9762\u4e86 \u8c08\u5f97\u4e0d\u9519
\u5218\u82b3 \u519c\u884c\u90a3\u8fb9\u6709\u620f\u4e86\uff1f
\u5f20\u603b \u6709\u620f \u4f46\u8fd8\u8981\u8d70\u6d41\u7a0b
\u738b\u4f1f \u5389\u5bb3 \ud83d\udc4d
\u5218\u82b3 \u5927\u6982\u4ec0\u4e48\u65f6\u5019\u80fd\u7b7e\uff1f
\u5f20\u603b \u8bf4\u4e0d\u51c6 \u53ef\u80fd8\u6708 \u4e5f\u53ef\u80fd9\u6708
\u738b\u4f1f \u90a3\u4e2d\u4ea4\u90a3\u4e2a\u5462
\u5f20\u603b \u4e2d\u4ea4\u90a3\u4e2a\u5ba2\u6237\u8bf4\u9884\u7b97\u88ab\u780d\u4e86 \u6682\u505c
\u5218\u82b3 \u559c\u6b62\u600e\u4e48\u6837
\u5f20\u603b \u559c\u6b62 \u5c31\u90a3\u6837\u5427 \u8fd8\u5728\u8c08
\u6768\u5a77 \u6211\u8fd9\u8fb9\u653f\u52a1\u90a3\u4e2a\u5ba2\u6237 \u5bf9\u65b9\u8bf4\u4e0b\u5468\u7ed9\u7b54\u590d
\u5f20\u603b ok \u5927\u5bb6\u52aa\u529b \u4e09\u5b63\u5ea6\u51b2\u4e00\u6ce2`,
    template: "meeting-notes"
  },

  // --- 销售低质量：语音转文字（口语化、无标点、信息散乱）---
  lq_sales_voice_memo: {
    title: "\u9500\u552e\u5468\u4f1a\u8bed\u97f3\u8f6c\u6587\u5b57",
    body: `\u55ef\u90a3\u4e2a\u5468\u4e00\u5f00\u4e86\u4e2a\u4f1a \u5c31\u662f\u5218\u7ecf\u7406\u4ed6\u4eec\u90a3\u4e2a\u56e2\u961f \u7136\u540e\u5462\u8bb2\u4e86\u4e0b\u8fd9\u4e2a\u4e09\u5b63\u5ea6\u7684\u4e00\u4e2a\u76ee\u6807 \u76ee\u6807\u7684\u8bdd\u5c31\u662f \u55ef \u600e\u4e48\u8bf4\u5462 \u603b\u7684\u6765\u8bf4\u5c31\u662f\u5e0c\u671b\u5927\u5bb6\u52aa\u529b\u5427 \u7136\u540e\u5462 \u5176\u4ed6\u7684\u8bdd \u5c31\u662f\u90a3\u4e2a\u519c\u884c\u90a3\u4e2a\u5355\u5b50 \u8fd8\u5728\u8ddf\u8fdb \u5c31\u662f\u8fd8\u6ca1\u7b7e \u53ef\u80fd\u8981\u5230\u4e0b\u4e2a\u6708 \u7136\u540e\u5462 \u653f\u52a1\u90a3\u8fb9 \u5c31\u662f\u8bf4\u5bf9\u65b9\u8981\u8d70\u62db\u6295 \u8fd8\u4e0d\u786e\u5b9a \u55ef \u5176\u4ed6\u7684\u8bdd \u5c31\u8fd9\u6837\u5427 \u5927\u5bb6\u52a0\u6cb9 \u5c31\u662f\u8bf4 \u8fd9\u4e2a\u4e09\u5b63\u5ea6\u5f88\u91cd\u8981 \u90a3\u4e2a \u55ef \u5e74\u5e95\u7684\u7ee9\u6548 \u5c31\u9760\u8fd9\u4e2a\u4e86 \u6240\u4ee5\u8bf4 \u5927\u5bb6\u90fd\u52aa\u529b\u4e00\u4e0b \u7136\u540e\u5462 \u5404\u4e2a\u7ec4 \u4e0b\u5468\u4e00\u4ea4\u4e2a\u8fdb\u5ea6\u7ed9\u6211 \u5c31\u8fd9\u6837`,
    template: "meeting-notes"
  },

  // --- 销售低质量：碎片化进度同步（只有结论没有细节）---
  lq_sales_fragmented: {
    title: "\u9500\u552e\u8fdb\u5ea6\u540c\u6b65",
    body: `\u8fdb\u5ea6\u540c\u6b65\uff1a

\u519c\u884c\uff1a\u5728\u8ddf
\u4e2d\u4ea4\uff1a\u6682\u505c
\u653f\u52a1\uff1a\u7b49\u56de\u590d
\u559c\u6b62\uff1a\u5728\u8c08
\u5efa\u884c\uff1a\u6ca1\u52a8\u9759

\u4e0b\u5468\u518d\u66f4\u65b0\u3002`,
    template: "progress-report"
  },

  // --- 销售低质量：客户沟通记录（流水账）---
  lq_sales_customer_chat: {
    title: "\u5468\u4e8c\u5ba2\u6237\u6c9f\u901a\u8bb0\u5f55",
    body: `\u5468\u4e8c\u5ba2\u6237\u6c9f\u901a\u60c5\u51b5\uff1a

\u5468\u4e00\uff1a\u6253\u4e863\u4e2a\u7535\u8bdd\uff0c\u5ba2\u62371\u8bf4\u5728\u5fd9\uff0c\u5ba2\u62372\u6ca1\u63a5\uff0c\u5ba2\u62373\u8bf4\u4e0b\u5468\u518d\u8054\u7cfb
\u5468\u4e8c\uff1a\u89c1\u4e86\u5ba2\u62371\uff0c\u804a\u4e86\u4f1a\uff0c\u611f\u89c9\u8fd8\u884c
\u5468\u4e09\uff1a\u5ba2\u62372\u7ec8\u4e8e\u56de\u7535\u8bdd\u4e86\uff0c\u8bf4\u8981\u6253\u6837
\u5468\u56db\uff1a\u5ba2\u62373\u8bf4\u9884\u7b97\u6ca1\u4e86\uff0c\u660e\u5e74\u518d\u8bf4

\u611f\u89c9\u8fd9\u5468\u6ca1\u4ec0\u4e48\u8fdb\u5c55\uff0c\u4e0b\u5468\u7ee7\u7eed\u3002`,
    template: "progress-report"
  },

  // --- 销售低质量：模糊的销售预测（无数据支撑）---
  lq_sales_forecast: {
    title: "\u4e09\u5b63\u5ea6\u9884\u6d4b",
    body: `\u4e09\u5b63\u5ea6\u7684\u8bdd\uff0c\u611f\u89c9\u80fd\u5b8c\u6210\u3002
\u519c\u884c\u7684\u5355\u5b50\u5982\u679c\u4e0b\u4e2a\u6708\u7b7e\u7684\u8bdd\uff0c\u5c31\u5dee\u4e0d\u591a\u4e86\u3002
\u653f\u52a1\u90a3\u8fb9\u8fd8\u6709\u673a\u4f1a\uff0c\u770b\u770b\u5427\u3002
\u5176\u4ed6\u7684\u5c31\u770b\u60c5\u51b5\u3002
\u603b\u4f53\u6765\u8bf4\u95ee\u9898\u4e0d\u5927\uff0c\u52aa\u529b\u5c31\u884c\u3002`,
    template: "metrics-data"
  },

  // --- 销售低质量：内部周会纪要（杂乱、跑题）---
  lq_sales_weekly_meeting: {
    title: "\u9500\u552e\u5468\u4f1a",
    body: `\u4eca\u5929\u5f00\u4f1a\u4e86
\u5f20\u603b\u8bb2\u4e86\u5f88\u591a
\u5218\u82b3\u6c47\u62a5\u4e86\u4e0b\u519c\u884c
\u738b\u4f1f\u8bf4\u4e2d\u4ea4\u90a3\u4e2a\u6682\u505c\u4e86
\u6768\u5a77\u8bf4\u653f\u52a1\u90a3\u8fb9\u8fd8\u5728\u7b49
\u7136\u540e\u8ba8\u8bba\u4e86\u4e0b\u56e2\u5efa\u7684\u4e8b
\u53c8\u804a\u4e86\u4e0b\u5e74\u5e95\u7ee9\u6548
\u8fd8\u8bf4\u4e86\u4e0b\u5e74\u4f11\u7684\u4e8b
\u5f20\u603b\u603b\u7ed3\u8bf4\u5927\u5bb6\u52aa\u529b
\u5c31\u8fd9\u6837\u5427`,
    template: "meeting-notes"
  },

  // ===== 边界情况 =====
  edge_minimal: {
    title: "极短记录",
    body: "任务完成。",
    template: "meeting-notes"
  },

  edge_empty_meaningful: {
    title: "无实质内容文档",
    body: "标题标题标题标题。内容内容内容内容。测试测试测试测试。",
    template: "project-plan"
  },

  edge_special_chars: {
    title: "特殊字符测试: <>&\"'\\/@#$%^&*()",
    body: `这是一段包含特殊字符的材料。
包含中文标点：，。！？；：""''【】《》（）——……
包含英文符号：< > & " ' \\ / @ # $ % ^ & * ( ) [ ] { } | 
包含Unicode：\u00e9 \u00fc \u4e16\u754c \u30b3\u30f3\u30cb\u30c1\u30cf
包含emoji：\u2705 \u274c \u26a0\ufe0f \ud83d\udcca
换行测试\n制表符\t测试
结束。`,
    template: "progress-report"
  },

  edge_long_content: {
    title: "超长会议纪要-压力测试",
    body: `大型技术评审会议纪要\n`.repeat(200) + `
会议决议：
1. 确认系统架构升级方案，目标完成日期2026年10月
2. 新增数据库优化专项任务，负责人张伟
3. 现有"API网关重构"任务进度更新为75%
4. 风险跟踪：安全合规风险已关闭，性能瓶颈风险仍为"监控中"`,
    template: "meeting-notes"
  },

  // ===== 不同项目类型的材料 =====
  sales_meeting: {
    title: "Q3销售战略会议纪要",
    body: `会议时间：2026年7月10日
参会：销售总监陈明、大客户经理刘芳、渠道经理王伟

议题：Q3销售策略调整

决议：
1. 大客户"金融行业拓展"任务进度更新为40%，预计Q3末完成签约
2. 新增任务"政务行业市场调研"，负责人刘芳，8月启动
3. 渠道合作"华东代理商招募"状态从"规划中"改为"进行中"
4. 风险更新：竞品价格战风险严重程度从"中"升为"高"
5. 销售指标：Q3签约目标5000万，截至7月已完成1800万（36%）`,
    template: "meeting-notes"
  },

  rd_sprint_review: {
    title: "Sprint 15 评审会议",
    body: `Sprint周期：2026年7月1日-7月14日
团队：研发一组（8人）

完成事项：
1. 用户认证模块重构：已完成，代码合并到main分支
2. API性能优化：平均响应时间从350ms降至180ms
3. "前端框架升级"任务进度从60%更新为85%

新增任务：
1. "微服务拆分-订单服务"，负责人张工，预计2个Sprint完成
2. "自动化测试覆盖提升"，负责人李工，目标覆盖率80%

风险：
- 数据库迁移兼容性风险，严重程度"中"，正在制定缓解方案
- 技术债务积累风险，需在下个Sprint安排专项清理`,
    template: "meeting-notes"
  },

  admin_ops_report: {
    title: "IT运维周报-第28周",
    body: `报告周期：2026年7月8日-7月14日

核心指标：
1. 系统可用性：99.97%
2. 工单处理：新增28张，关闭25张，积压3张
3. 服务器巡检：全部正常
4. 安全扫描：发现2个低危漏洞，已修复

任务进展：
1. "办公网络升级"进度从20%更新为45%
2. "VPN系统迁移"状态更新为"已完成"
3. 新增"终端安全加固"任务，负责人王运维

风险：
- 核心交换机已达保修期，建议采购延保服务（严重程度：中）`,
    template: "progress-report"
  },

  market_campaign_report: {
    title: "暑期营销活动效果复盘",
    body: `活动名称：2026暑期品牌推广
活动周期：7月1日-7月31日

效果指标：
1. 曝光量：1250万次（目标1000万，超额25%）
2. 点击率：3.2%（行业平均2.5%）
3. 转化率：1.8%（目标1.5%，达标）
4. ROI：3.5（目标>3，达标）
5. 新增注册用户：8.2万

任务更新：
1. "社交媒体推广"任务状态更新为"已完成"
2. "KOL合作"任务进度从70%更新为90%
3. 新增"Q4品牌策略规划"任务

风险：
- 广告预算即将用尽，需追加预算（严重程度：中）`,
    template: "metrics-data"
  },

  // ===== 模板不匹配的材料 =====
  mismatch_template: {
    title: "服务器采购清单",
    body: `采购清单：
1. Dell R750 机架式服务器 x3
2. Cisco Nexus 9300 交换机 x2  
3. APC UPS 10KVA x1

预算：总计约45万元
交货期：下单后4周`,
    template: "meeting-notes"  // 明显不匹配——采购清单用会议纪要模板
  },

  // ===== 第二批：更丰富的真实场景 =====

  // --- 销售高质量：详细客户拜访记录 ---
  hq_sales_visit: {
    title: "农行总行拜访纪要-2026年7月22日",
    body: `日期：2026年7月22日 14:00-16:30
地点：农行总行 信息科技部
参会：张总（我方销售总监）、刘芳（大客户经理）、周总（农行信息科技部副总经理）、李工（农行架构师）

议题：核心交易系统升级方案确认

讨论要点：
1. 周总确认方案整体可行，但要求在安全性方面增加等保三级合规设计
2. 李工提出技术疑问：分布式事务一致性方案是否支持TCC模式，我方解答满足
3. 商务方面：总预算约2800万，分两期执行（一期1500万、二期1300万）
4. 预计8月中旬完成内部审批，8月底前签约

决议与行动项：
- 张总负责协调方案团队在8月5日前提交等保三级补充设计文档（负责人：张总，截止：8月5日）
- 刘芳负责跟进农行内部审批流程，每周同步进展（负责人：刘芳，截止：每周五）
- "金融行业核心交易系统升级"任务进度更新为55%，预计签约日期2026年8月31日
- 新增风险：农行内部审批周期可能延长，严重程度"中"，缓解措施为提前准备材料减少退回次数`,
    template: "meeting-notes"
  },

  // --- 销售高质量：季度销售数据汇总 ---
  hq_sales_dashboard: {
    title: "2026年Q3销售数据看板-7月",
    body: `数据周期：2026年7月1日-7月31日
数据来源：CRM系统 + 合同管理系统

核心指标：
1. 季度签约目标：5000万元
2. 截至7月底已完成签约：2100万元（完成率42%）
3. 在途商机总额：18500万元（覆盖37个商机）
4. 新增商机：12个，总金额4200万元
5. 商机转化率：28%（上月22%，提升6个百分点）
6. 平均签约周期：72天（上月85天，缩短13天）
7. 大客户复购率：65%
8. 渠道贡献占比：32%

重点客户进展：
- 农行核心交易系统升级：预算2800万，预计8月签约，进度55%
- 中交建数据中台项目：预算1500万，预计10月签约，进度30%
- 政务云平台项目：预算800万，预计9月签约，进度40%

趋势分析：
- Q3完成5000万目标存在风险，需在8月确保农行签约落地
- 政务市场增长明显，建议加大投入
- 渠道转化率需提升，建议优化渠道激励机制`,
    template: "metrics-data"
  },

  // --- 研发高质量：详细技术方案评审 ---
  hq_rd_review: {
    title: "订单微服务拆分技术评审-2026年7月18日",
    body: `评审时间：2026年7月18日 10:00-12:00
参会：李华（技术负责人）、张工（订单服务负责人）、王工（支付服务负责人）、赵强（项目经理）

评审结论：方案通过，按以下计划执行

技术决议：
1. 订单服务拆分为：订单核心服务、订单查询服务、订单状态机服务三个独立微服务
2. 使用 Kafka 作为服务间异步通信中间件，保证最终一致性
3. 数据库分库策略：按 tenant_id 进行水平分片，单库不超过500万订单
4. API 网关统一路由，对外暴露 RESTful + GraphQL 双协议

新增任务：
- "订单核心服务开发"，负责人张工，预计2个Sprint完成（8月14日）
- "订单查询服务开发"，负责人王工，预计1.5个Sprint完成（8月7日）
- "订单状态机服务开发"，负责人陈静，预计1个Sprint完成（7月31日）

任务更新：
- "微服务基础设施搭建"进度从40%更新为65%
- "Kafka集群部署"状态更新为"已完成"

风险：
- 数据迁移复杂度风险（严重程度：高），缓解措施：编写详细的迁移脚本+灰度切换方案
- 服务间通信延迟风险（严重程度：中），缓解措施：引入本地缓存+异步预热`,
    template: "meeting-notes"
  },

  // --- 管理高质量：季度OKR复盘 ---
  hq_admin_okr: {
    title: "2026年Q2 IT部门OKR复盘",
    body: `复盘周期：2026年Q2（4月-6月）
编制：IT部负责人 王运维

OKR达成情况：
1. O1：提升基础设施稳定性
   - KR1：系统可用性从99.5%提升至99.9% → 实际99.92%，✓超额完成
   - KR2：故障平均恢复时间从30分钟降至10分钟 → 实际12分钟，△未达标
   - KR3：完成核心系统容灾演练 → ✓已完成

2. O2：推进数字化转型
   - KR1：OA系统升级上线 → ✓已完成
   - KR2：部署RPA自动化流程20个 → 实际18个，△接近达标
   - KR3：员工数字化培训覆盖率80% → 实际85%，✓超额完成

3. O3：优化IT成本
   - KR1：年度IT预算降低10% → 实际降低12%，✓超额完成
   - KR2：云资源利用率提升至70% → 实际68%，△接近达标

任务状态更新：
- "OA系统升级"状态更新为"已完成"，进度100%
- "RPA流程部署"进度从70%更新为90%
- 新增"Q3容灾体系升级"任务，负责人王运维，预计Q3完成

经验教训：
- 故障恢复时间未达标，根因是值班响应机制不够完善，Q3优化排班制度
- RPA部署略低于目标，需引入更多业务场景识别`,
    template: "progress-report"
  },

  // --- 市场高质量：整合营销效果报告 ---
  hq_market_integrated: {
    title: "2026年Q3整合营销效果分析报告",
    body: `报告周期：2026年7月1日-7月31日
数据来源：Google Analytics + 广告平台 + CRM

一、整体指标
1. 总曝光量：5800万次（目标5000万，达标率116%）
2. 总点击量：186万次（CTR 3.2%，行业平均2.5%）
3. 获客成本（CAC）：385元（目标<450元，优于目标）
4. 营销来源收入：1200万元（ROI 4.2，目标>3.5）
5. 新增MQL（营销合格线索）：3200条
6. MQL→SQL转化率：42%

二、各渠道表现
- 搜索引擎SEM：花费85万，获客980人，CAC 867元
- 信息流广告：花费72万，获客1100人，CAC 655元
- 社交媒体（自然+付费）：花费45万，获客720人，CAC 625元
- KOL合作：花费38万，获客450人，CAC 844元
- 线下活动：花费25万，获客180人，CAC 1389元

三、任务更新
- "Q3品牌升级campaign"进度从60%更新为80%
- "小红书内容营销"状态更新为"已完成"
- 新增"Q4双11营销策划"任务，负责人市场部张经理，预计10月启动

四、风险与建议
- 信息流广告CAC持续上升，建议优化定向策略（严重程度：中）
- KOL合作效果下滑，建议调整合作矩阵，增加中腰部KOL比例`,
    template: "metrics-data"
  },

  // --- 基础设施高质量：迁移执行报告 ---
  hq_infra_migration: {
    title: "核心系统云迁移执行报告-Phase 2",
    body: `报告周期：2026年7月15日-7月28日
执行团队：云基础设施组（李华组长带队5人）

一、本阶段完成情况
1. 数据迁移：用户数据1.2亿条迁移完成，校验通过
2. 服务切换：订单服务、支付服务、用户服务已切换至云端
3. 性能验证：P99延迟从320ms降至145ms，提升55%
4. 监控接入：3个服务已接入Prometheus+Grafana监控

二、任务进度更新
- "用户数据迁移"状态更新为"已完成"，进度100%
- "订单服务迁移"状态更新为"已完成"，进度100%
- "支付服务迁移"进度从45%更新为85%
- "商品服务迁移"进度从20%更新为50%
- 新增"迁移后稳定性观察"任务，负责人陈静，预计持续2周

三、风险更新
- 新增风险：支付服务迁移后偶发超时（严重程度：高），缓解措施：已定位为连接池配置问题，正在调优
- 已缓解：数据一致性风险从"高"降为"低"

四、下阶段计划（8月）
- 完成支付服务和商品服务迁移
- 启动历史数据归档
- 完成全量迁移后的性能压测`,
    template: "progress-report"
  },

  // ===== 第三批：低质量变体（更多真实痛点）=====

  // --- 销售低质量：只有结论的周报 ---
  lq_sales_weekly_brief: {
    title: "销售周报",
    body: `本周情况：
农行在推进
中交暂停了
其他正常

下周继续努力。`,
    template: "progress-report"
  },

  // --- 销售低质量：口语化的商机同步 ---
  lq_sales_pipeline_chat: {
    title: "商机同步群消息汇总",
    body: `@所有人 同步下这周商机
农行那个周总说下个月走流程 应该没问题
中交那边预算被砍了 短期内没戏了
政务那个 对方说要走招标 具体时间不确定
建行的单子 客户一直拖着不回复
招行新来了个需求 让我们出方案
感觉这周还行吧 农行那个能签就超额了
大家加油`,
    template: "meeting-notes"
  },

  // --- 销售低质量：数据严重缺失的指标 ---
  lq_sales_sparse_metrics: {
    title: "销售数据",
    body: `签约了几个
农行那个比较大
其他都是小单
大概完成了三分之一吧
具体数字我要查一下`,
    template: "metrics-data"
  },

  // --- 研发低质量：Scrum站会流水账 ---
  lq_rd_standup: {
    title: "每日站会记录",
    body: `张工：昨天改了bug，今天继续
李工：昨天开会了，今天写代码
王工：昨天修了测试，今天继续修
赵工：昨天看文档，今天继续看
陈工：昨天部署了，今天看监控
就这些`,
    template: "meeting-notes"
  },

  // --- 研发低质量：模糊的进度汇报 ---
  lq_rd_vague_progress: {
    title: "开发进度",
    body: `整体进度还可以
前端差不多了
后端还在写
测试还没开始
数据库在调
应该能按时上线吧`,
    template: "progress-report"
  },

  // --- 管理低质量：只有数字没有分析 ---
  lq_admin_bare_numbers: {
    title: "运维数据",
    body: `服务器：48台
在线率：99.2%
工单：35
处理：28
积压：7

本月正常。`,
    template: "metrics-data"
  },

  // --- 管理低质量：跑题的行政通知 ---
  lq_admin_off_topic: {
    title: "部门通知",
    body: `通知：
1. 下周五下午部门团建，地点待定
2. 空调温度统一设定26度
3. 打印机墨盒已更换
4. 下月起考勤系统升级

收到请回复。`,
    template: "progress-report"
  },

  // --- 市场低质量：只有口号的策划 ---
  lq_market_slogans: {
    title: "Q4营销方向",
    body: `Q4我们要：
全力冲刺！
抢占市场！
提升品牌！
引爆流量！

具体方案后面再定。`,
    template: "project-plan"
  },

  // --- 混合语言材料 ---
  edge_mixed_language: {
    title: "Tech Review Notes - 技术评审",
    body: `Date: 2026-07-20
Participants: 李华(Tech Lead), John(Solution Architect), 王工(Backend)

Agenda: API Gateway refactoring review

Decision:
1. Use Kong as API gateway, replace Nginx reverse proxy
2. 实现JWT-based authentication, 替换现有的session方案
3. Rate limiting: 1000 req/min per tenant
4. "API网关重构"任务进度更新为70%
5. New task: "Kong插件开发-租户配额管理", owner: 王工, due: 2026-08-10

Action items:
- 李华: output Kong deployment config by 2026-07-25
- John: review JWT integration design by 2026-07-28
- 王工: start plugin development next Monday

Risk: Kong社区版功能受限，企业版费用较高（severity: medium）`,
    template: "meeting-notes"
  },

  // --- 含表格格式的材料（纯文本表格）---
  edge_text_table: {
    title: "Q3项目资源分配表",
    body: `日期：2026年7月25日

部门 | 项目 | 负责人 | 投入人力 | 预计工期
研发部 | 订单微服务拆分 | 张工 | 5人 | 8月-9月
研发部 | 数据中台建设 | 李工 | 3人 | 8月-12月
市场部 | Q4品牌campaign | 张经理 | 2人 | 10月-11月
运维部 | 云迁移Phase3 | 陈静 | 4人 | 8月-9月
销售部 | 金融行业拓展 | 刘芳 | 2人 | 持续

新增任务：
- "数据中台建设"，负责人李工，预计2026年12月完成
- "云迁移Phase3"，负责人陈静，预计9月完成
- "数据中台"和"云迁移Phase3"存在依赖关系，数据中台需要迁移完成后才能部署

风险：研发人力紧张，8月同时进行3个大型项目，建议优先级排序`,
    template: "project-plan"
  },

  // --- 纯英文材料 ---
  edge_english_only: {
    title: "Sprint 16 Retrospective",
    body: `Sprint: 16 (July 15 - July 28)
Team: Backend Squad (6 engineers)

What went well:
- Completed payment service refactoring, P99 latency reduced from 450ms to 180ms
- "Payment gateway upgrade" task updated to 90% complete
- Zero production incidents during sprint

What didn't go well:
- Story points completed: 34/52 (65%), below 80% target
- Code review bottleneck: PR wait time averaged 2.5 days

Action items:
- Rotate code reviewer daily to reduce bottleneck (owner: 李华, due: Aug 1)
- Reduce story scope for Sprint 17, focus on quality over velocity
- New task: "Technical debt cleanup - remove deprecated APIs", owner: 王工, due: Aug 14

Risk: Developer burnout risk increasing, 3 consecutive sprints with overtime (severity: medium)`,
    template: "meeting-notes"
  },

  // --- 超高质量：结构完整、信息密集的综合报告 ---
  hq_comprehensive_report: {
    title: "2026年Q3经营分析报告-7月",
    body: `报告周期：2026年7月
编制：项目管理办公室（PMO）

一、经营概况
本月整体经营状况良好，核心指标：
1. 营收：1850万元（环比+12%，年度目标完成率58%）
2. 新签合同：8份，总金额3200万元
3. 项目交付率：92%（目标90%，达标）
4. 客户满意度：4.6/5.0（目标4.5，达标）

二、重点项目进展

【销售线】
- "金融行业核心系统"任务：进度55%，预计8月签约（金额2800万）
- "政务云平台"任务：进度40%，预计9月签约（金额800万）
- 新增风险：中交建项目预算缩减1500万→800万（严重程度：高）

【研发线】
- "订单微服务拆分"任务：进度65%，预计9月完成
- "API网关重构"任务：进度70%，预计8月完成
- "数据中台建设"任务：新增，预计12月完成
- 研发效能：Sprint速率从42提升至48 story points/sprint

【基础设施】
- "云迁移Phase2"任务：进度85%，预计8月完成
- 系统可用性：99.92%（达标）
- 新增风险：支付服务迁移后偶发超时（严重程度：高）

三、风险汇总
| 风险 | 严重程度 | 状态 | 缓解措施 |
| 中交建预算缩减 | 高 | 新增 | 调整方案范围，争取追加预算 |
| 支付服务超时 | 高 | 监控中 | 连接池调优中 |
| 研发人力紧张 | 中 | 持续 | Q3招聘3名后端工程师 |
| 广告CAC上升 | 中 | 监控中 | 优化定向策略 |

四、下月重点
1. 确保农行签约落地
2. 完成云迁移Phase2收尾
3. 启动数据中台建设
4. 招聘到位缓解人力瓶颈`,
    template: "progress-report"
  },

  // --- 高质量但用词非标准的材料 ---
  hq_non_standard_terms: {
    title: "产研协同会议-7月第三周",
    body: `开会时间：2026年7月19号下午2点
来的人：产品老周、技术大刘、设计小美、测试老陈、运营阿强

聊了啥：
1. 新功能"智能推荐"的产品需求确认了，大刘说技术上没问题，预计要搞一个月
2. 老周拍板：8月1号开始做，8月底出第一版
3. "首页改版"这活儿干完了，效果还不错，用户停留时间涨了15%
4. 阿强说运营那边需要加个"活动配置后台"，算是新需求
5. 老陈吐槽测试环境太不稳定，大刘答应这周搞定

谁干啥：
- 大刘：负责"智能推荐"的技术方案，8月1号出方案
- 小美：负责"智能推荐"的UI设计，7月26号交稿
- 老陈：这周搞定测试环境稳定性
- 阿强：整理"活动配置后台"的需求文档，7月24号提交

有个风险：推荐算法的效果不好评估，可能需要AB测试一段时间`,
    template: "meeting-notes"
  }
};

// ============================================================
// 测试项目
// ============================================================
const TEST_PROJECTS = [
  { id: "sales-demo", name: "销售项目", template: "campaign-map" },
  { id: "rd-demo", name: "研发项目", template: "standard-project" },
  { id: "admin-demo", name: "管理项目", template: "standard-project" },
  { id: "market-demo", name: "市场项目", template: "campaign-map" },
  { id: "infra-demo", name: "基础设施项目", template: "campaign-map" }
];

// ============================================================
// HTTP 工具
// ============================================================
let csrfToken = "";
let cookieJar = "";

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginName: ADMIN_USER, password: ADMIN_PASS })
  });
  const data = await res.json();
  csrfToken = data.csrfToken;
  cookieJar = res.headers.get("set-cookie")?.split(";")[0] || "";
  return data;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cookie": cookieJar,
    ...(options.mutation ? { "x-csrf-token": csrfToken } : {}),
    ...options.headers
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function submitManualMaterial(projectId, material) {
  return api(`/api/projects/${projectId}/materials/manual`, {
    method: "POST",
    mutation: true,
    body: JSON.stringify({
      title: material.title,
      body: material.body,
      updateTemplateId: material.template,
      updateTemplateVersion: "1.0.0"
    })
  });
}

// ============================================================
// 测试结果收集
// ============================================================
const results = [];
let passCount = 0;
let failCount = 0;

function record(category, name, status, detail) {
  results.push({ category, name, status, detail });
  if (status === "PASS") passCount++;
  else if (status === "FAIL") failCount++;
}

// ============================================================
// 主测试流程
// ============================================================
async function main() {
  console.log("=" .repeat(70));
  console.log("大规模材料测试：多项目类型 × 多质量级别 × 多内容类型");
  console.log("=" .repeat(70));
  console.log();

  // 登录
  console.log("[1/8] 登录...");
  await login();
  console.log("  ✓ 登录成功\n");

  // ========== 阶段1：高质量材料提交（5个项目 × 高质量内容） ==========
  console.log("[2/8] 阶段1：高质量材料提交（5个项目）");
  const hqMaterials = ["hq_meeting_notes", "hq_project_plan", "hq_progress_report", "hq_metrics_data"];
  
  for (const project of TEST_PROJECTS) {
    for (const matKey of hqMaterials) {
      const mat = TEST_MATERIALS[matKey];
      const label = `${project.name} - ${mat.title.slice(0, 20)}...`;
      try {
        const { status, body } = await submitManualMaterial(project.id, mat);
        if (status === 201 && body.material?.status === "ready") {
          const evCount = body.material.evidenceCount || 0;
          record("高质量材料", label, "PASS", `status=ready, evidence=${evCount}`);
          console.log(`  ✓ ${label} (evidence: ${evCount})`);
        } else {
          record("高质量材料", label, "FAIL", `HTTP ${status}: ${JSON.stringify(body).slice(0, 100)}`);
          console.log(`  ✗ ${label} (HTTP ${status})`);
        }
      } catch (e) {
        record("高质量材料", label, "FAIL", e.message);
        console.log(`  ✗ ${label} (${e.message})`);
      }
      await sleep(300); // 避免频率限制
    }
  }
  console.log();

  // ========== 阶段2：低质量材料提交（销售场景为主）==========
  console.log("[3/8] 阶段2：低质量/模糊内容材料（销售场景为主）");
  const lqMaterials = [
    { key: "lq_vague_notes", project: "rd-demo", desc: "模糊笔记" },
    { key: "lq_off_topic", project: "rd-demo", desc: "无关内容" },
    { key: "lq_sales_wechat_group", project: "sales-demo", desc: "微信群聊" },
    { key: "lq_sales_voice_memo", project: "sales-demo", desc: "语音转文字" },
    { key: "lq_sales_fragmented", project: "sales-demo", desc: "碎片化进度" },
    { key: "lq_sales_customer_chat", project: "sales-demo", desc: "客户沟通流水账" },
    { key: "lq_sales_forecast", project: "sales-demo", desc: "模糊预测" },
    { key: "lq_sales_weekly_meeting", project: "sales-demo", desc: "杂乱周会" },
    { key: "lq_sales_weekly_brief", project: "sales-demo", desc: "极简周报" },
    { key: "lq_sales_pipeline_chat", project: "sales-demo", desc: "商机群消息" },
    { key: "lq_sales_sparse_metrics", project: "sales-demo", desc: "数据缺失指标" },
    { key: "lq_rd_standup", project: "rd-demo", desc: "站会流水账" },
    { key: "lq_rd_vague_progress", project: "rd-demo", desc: "模糊进度" },
    { key: "lq_admin_bare_numbers", project: "admin-demo", desc: "裸数字" },
    { key: "lq_admin_off_topic", project: "admin-demo", desc: "行政跑题" },
    { key: "lq_market_slogans", project: "market-demo", desc: "口号策划" }
  ];
  
  for (const { key, project, desc } of lqMaterials) {
    const mat = TEST_MATERIALS[key];
    const label = `[${desc}] ${mat.title}`;
    try {
      const { status, body } = await submitManualMaterial(project, mat);
      if (status === 201) {
        const evCount = body.material?.evidenceCount || 0;
        const readiness = body.material?.readiness;
        const readinessStatus = readiness?.status || "unknown";
        const warnings = readiness?.warnings?.length || 0;
        // 低质量材料应该能提交但 readiness 可能有 warning
        record("低质量材料", label, "PASS", `evidence=${evCount}, readiness=${readinessStatus}, warnings=${warnings}`);
        console.log(`  ✓ ${label} (evidence: ${evCount}, readiness: ${readinessStatus}, warnings: ${warnings})`);
      } else {
        record("低质量材料", label, "FAIL", `HTTP ${status}: ${body?.error || ""}`);
        console.log(`  ✗ ${label} (HTTP ${status})`);
      }
    } catch (e) {
      record("低质量材料", label, "FAIL", e.message);
      console.log(`  ✗ ${label} (${e.message})`);
    }
    await sleep(300);
  }
  console.log();

  // ========== 阶段3：边界情况测试 ==========
  console.log("[4/8] 阶段3：边界情况测试");
  const edgeMaterials = ["edge_minimal", "edge_empty_meaningful", "edge_special_chars", "edge_long_content", "mismatch_template", "edge_mixed_language", "edge_text_table", "edge_english_only"];
  
  for (const matKey of edgeMaterials) {
    const mat = TEST_MATERIALS[matKey];
    const label = matKey;
    try {
      const { status, body } = await submitManualMaterial("infra-demo", mat);
      if (status === 201) {
        const evCount = body.material?.evidenceCount || 0;
        record("边界情况", label, "PASS", `evidence=${evCount}`);
        console.log(`  ✓ ${label} (evidence: ${evCount})`);
      } else {
        const errMsg = body?.error || body?.code || `HTTP ${status}`;
        record("边界情况", label, status === 400 || status === 422 ? "PASS" : "FAIL", `HTTP ${status}: ${errMsg}`);
        console.log(`  ${status === 400 || status === 422 ? "✓" : "✗"} ${label} (HTTP ${status}: ${errMsg})`);
      }
    } catch (e) {
      record("边界情况", label, "FAIL", e.message);
      console.log(`  ✗ ${label} (${e.message})`);
    }
    await sleep(300);
  }
  console.log();

  // ========== 阶段4：不同项目类型专属材料 ==========
  console.log("[5/8] 阶段4：不同项目类型专属材料");
  const projectMaterials = [
    { project: "sales-demo", mat: "sales_meeting" },
    { project: "rd-demo", mat: "rd_sprint_review" },
    { project: "admin-demo", mat: "admin_ops_report" },
    { project: "market-demo", mat: "market_campaign_report" }
  ];
  
  for (const { project, mat } of projectMaterials) {
    const material = TEST_MATERIALS[mat];
    const projName = TEST_PROJECTS.find(p => p.id === project)?.name || project;
    const label = `${projName} - ${material.title.slice(0, 25)}...`;
    try {
      const { status, body } = await submitManualMaterial(project, material);
      if (status === 201) {
        const evCount = body.material?.evidenceCount || 0;
        const tpl = body.material?.updateTemplate;
        record("项目类型", label, "PASS", `evidence=${evCount}, template=${tpl?.id || "none"}`);
        console.log(`  ✓ ${label} (evidence: ${evCount}, template: ${tpl?.id})`);
      } else {
        record("项目类型", label, "FAIL", `HTTP ${status}: ${body?.error || ""}`);
        console.log(`  ✗ ${label} (HTTP ${status})`);
      }
    } catch (e) {
      record("项目类型", label, "FAIL", e.message);
      console.log(`  ✗ ${label} (${e.message})`);
    }
    await sleep(300);
  }
  console.log();

  // ========== 阶段4b：高质量扩展材料（各项目类型专属高质量）==========
  console.log("[5b/8] 阶段4b：高质量扩展材料（真实场景深度测试）");
  const hqExtMaterials = [
    { key: "hq_sales_visit", project: "sales-demo", desc: "客户拜访记录" },
    { key: "hq_sales_dashboard", project: "sales-demo", desc: "销售数据看板" },
    { key: "hq_rd_review", project: "rd-demo", desc: "技术评审" },
    { key: "hq_admin_okr", project: "admin-demo", desc: "OKR复盘" },
    { key: "hq_market_integrated", project: "market-demo", desc: "整合营销报告" },
    { key: "hq_infra_migration", project: "infra-demo", desc: "迁移执行报告" },
    { key: "hq_comprehensive_report", project: "admin-demo", desc: "经营分析报告" },
    { key: "hq_non_standard_terms", project: "rd-demo", desc: "非标准用词会议" }
  ];
  
  for (const { key, project, desc } of hqExtMaterials) {
    const mat = TEST_MATERIALS[key];
    const projName = TEST_PROJECTS.find(p => p.id === project)?.name || project;
    const label = `[${desc}] ${mat.title.slice(0, 25)}...`;
    try {
      const { status, body } = await submitManualMaterial(project, mat);
      if (status === 201) {
        const evCount = body.material?.evidenceCount || 0;
        const readiness = body.material?.readiness;
        const readinessStatus = readiness?.status || "unknown";
        record("高质量扩展", `${projName} - ${label}`, "PASS", `evidence=${evCount}, readiness=${readinessStatus}`);
        console.log(`  ✓ ${projName} - ${label} (evidence: ${evCount}, readiness: ${readinessStatus})`);
      } else {
        const errMsg = body?.error || body?.code || `HTTP ${status}`;
        record("高质量扩展", `${projName} - ${label}`, "FAIL", `${errMsg}`);
        console.log(`  ✗ ${projName} - ${label} (${errMsg})`);
      }
    } catch (e) {
      record("高质量扩展", `${projName} - ${label}`, "FAIL", e.message);
      console.log(`  ✗ ${projName} - ${label} (${e.message})`);
    }
    await sleep(300);
  }
  console.log();

  // ========== 阶段5：验证证据提取质量 ==========
  console.log("[6/8] 阶段5：验证证据提取质量");
  
  for (const project of TEST_PROJECTS) {
    const { body } = await api(`/api/projects/${project.id}/materials`);
    const materials = body.items || [];
    const readyMaterials = materials.filter(m => m.status === "ready" && m.evidenceCount > 0);
    
    let totalEvidence = 0;
    let withTemplate = 0;
    let withReadiness = 0;
    
    for (const m of readyMaterials) {
      totalEvidence += m.evidenceCount || 0;
      if (m.updateTemplate?.id) withTemplate++;
      if (m.readiness?.status) withReadiness++;
    }
    
    const label = project.name;
    const ok = readyMaterials.length > 0 && totalEvidence > 0;
    record("证据质量", label, ok ? "PASS" : "FAIL", 
      `${readyMaterials.length} ready, ${totalEvidence} evidence, ${withTemplate} with template`);
    console.log(`  ${ok ? "✓" : "✗"} ${label}: ${readyMaterials.length} 材料就绪, ${totalEvidence} 条证据, ${withTemplate}/${readyMaterials.length} 有模板`);
  }
  console.log();

  // ========== 阶段6：LLM 生成验证（选3个项目做端到端） ==========
  console.log("[7/8] 阶段6：LLM 端到端生成验证（3个项目）");
  const llmProjects = ["infra-demo", "sales-demo", "rd-demo"];
  
  // 获取 admin principal
  const db = openDatabase();
  const adminRow = db.prepare("SELECT id, login_name, is_platform_admin FROM users WHERE login_name='admin'").get();
  const principal = {
    id: adminRow.id,
    loginName: adminRow.login_name,
    isPlatformAdmin: Boolean(adminRow.is_platform_admin)
  };
  const proposalService = createProposalService(db, { autoProcess: true });
  
  for (const projectId of llmProjects) {
    const projName = TEST_PROJECTS.find(p => p.id === projectId)?.name || projectId;
    const label = `${projName} 批量生成`;
    try {
      const result = await proposalService.createBatchJobs(principal, projectId);
      const s = result.summary;
      const ok = s.total > 0;
      const taskDetails = result.tasks.map(t => `${t.state}(${t.errorCode || "ok"})`).join(", ");
      record("LLM生成", label, ok ? "PASS" : "FAIL", 
        `total=${s.total}, succeeded=${s.succeeded}, failed=${s.failed}, groups=${s.groups} [${taskDetails}]`);
      console.log(`  ${ok ? "✓" : "✗"} ${label}: ${s.succeeded}/${s.total} 成功 [${taskDetails}]`);
    } catch (e) {
      record("LLM生成", label, "FAIL", e.message);
      console.log(`  ✗ ${label}: ${e.message}`);
    }
  }
  db.close();
  console.log();

  // ========== 输出汇总报告 ==========
  console.log("=" .repeat(70));
  console.log("测试结果汇总");
  console.log("=" .repeat(70));
  console.log(`总计: ${results.length} 项 | 通过: ${passCount} | 失败: ${failCount}`);
  console.log();

  // 按类别分组统计
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPass = catResults.filter(r => r.status === "PASS").length;
    const catFail = catResults.filter(r => r.status === "FAIL").length;
    console.log(`【${cat}】${catPass}/${catResults.length} 通过${catFail > 0 ? `, ${catFail} 失败` : ""}`);
    for (const r of catResults.filter(r => r.status === "FAIL")) {
      console.log(`  ✗ ${r.name}: ${r.detail}`);
    }
  }
  console.log();
  
  // 失败详情
  if (failCount > 0) {
    console.log("--- 失败详情 ---");
    for (const r of results.filter(r => r.status === "FAIL")) {
      console.log(`  [${r.category}] ${r.name}`);
      console.log(`    → ${r.detail}`);
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
