import { validateVersionGraph } from "../modules/schemas.mjs";

export class ReviewGraphError extends Error {
  constructor(code,message,details={}) { super(message); this.name="ReviewGraphError"; this.code=code; this.status=422; this.details=details; }
}

function normalized(value){return String(value??"").normalize("NFKC").trim().toLocaleLowerCase("zh-CN");}

export function validateReviewGraph(graph) {
  validateVersionGraph(graph);
  for (const [label,items,key] of [
    ["团队或作战单元",graph.units,"name"],["路线节点",graph.stages,"title"],["任务",graph.tasks,"title"],
    ["成果",graph.closures,"title"],["风险",graph.risks,"title"],["指标",graph.metrics,"name"]
  ]) {
    const names=new Map();
    for(const item of items){const value=normalized(item[key]);if(!value)throw new ReviewGraphError("REQUIRED_FIELD_MISSING",`${label}缺少名称`,{id:item.id});if(names.has(value)&&names.get(value)!==item.id)throw new ReviewGraphError("DUPLICATE_NAME",`${label}名称重复`,{id:item.id});names.set(value,item.id);}
  }
  const tasks=new Map(graph.tasks.map(item=>[item.id,item]));
  for(const task of graph.tasks)for(const link of [task.parentId,...task.dependsOn].filter(Boolean)){const target=tasks.get(link);if(target&&target.unitId!==task.unitId)throw new ReviewGraphError("TASK_LINK_CROSS_UNIT","任务依赖必须位于同一团队或作战单元",{id:task.id,link});}
  const units=new Map(graph.units.map(item=>[item.id,item]));
  for(const task of graph.tasks){const unit=units.get(task.unitId);if(["archived","exited"].includes(unit?.status)&&!(Number(task.progress)>=100||["done","completed","complete","closed","archived","exited","已完成","完成","关闭","已关闭","归档","已归档"].includes(normalized(task.state))))throw new ReviewGraphError("UNIT_HAS_ACTIVE_TASKS","归档或退出的作战单元不能保留未完成任务",{id:task.id,unitId:task.unitId});}
  return graph;
}
