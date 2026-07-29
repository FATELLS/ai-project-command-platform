function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function text(value,label,{required=false,max=500}={}){if(value===undefined)return undefined;if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new TypeError(`${label} is invalid`);return value;}
function number(value,label){if(value===undefined||value===null||value==="unknown"||value==="")return undefined;if(typeof value!=="number")throw new TypeError(`${label} is invalid`);return value;}
function stringArray(value,label){if(value===undefined)return undefined;if(!Array.isArray(value)||value.some(item=>typeof item!=="string"))throw new TypeError(`${label} is invalid`);return [...new Set(value)];}

function tableExists(database,name){try{database.prepare(`SELECT 1 FROM ${name} LIMIT 1`).get();return true;}catch{return false;}}

function nextCardPosition(database,versionId){return database.prepare(`SELECT coalesce(max(position),-1)+1 AS position FROM project_cards WHERE version_id=?`).get(versionId).position;}

function cardExists(database,versionId,id){return Boolean(database.prepare(`SELECT 1 FROM project_cards WHERE version_id=? AND external_id=?`).get(versionId,id));}

function getCardRow(database,versionId,id){
  const row=database.prepare(`SELECT card_attrs AS cardAttrs,element_type AS elementType FROM project_cards WHERE version_id=? AND external_id=?`).get(versionId,id);
  if(!row)return undefined;
  return {elementType:row.elementType,attrs:object(JSON.parse(row.cardAttrs||"{}"))};
}

// 拆分 patch：公共字段 → 列；差异字段 → attrs
function splitPatch(patch,elementType){
  const commonKeys=new Set(["title","owner","state","objective","startDate","endDate","progress","health","unitId","parentId","dependsOn","name"]);
  const columnFields={};
  const attrsFields={};
  for(const[key,value]of Object.entries(patch)){
    if(commonKeys.has(key))columnFields[key]=value;
    else attrsFields[key]=value;
  }
  // name -> title 映射（unit/metric 用 name 做标题）
  if(columnFields.name!==undefined&&columnFields.title===undefined){columnFields.title=columnFields.name;delete columnFields.name;}
  // startDate/endDate/end_date 映射
  return{columnFields,attrsFields};
}

// 确保 task 引用的 unit 在 project_cards 中存在（否则合并后 graph 校验失败）
function ensureUnitCard(database,versionId,unitId){
  if(!unitId)return;
  if(cardExists(database,versionId,unitId))return;
  const now=new Date().toISOString();
  const pos=database.prepare(`SELECT coalesce(max(position),-1)+1 AS position FROM project_cards WHERE version_id=? AND element_type='unit'`).get(versionId).position;
  database.prepare(`INSERT INTO project_cards (version_id,external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    versionId,unitId,"unit",pos,
    unitId==="default-unit"?"默认团队":unitId,
    "","",  // owner, state
    "",     // objective
    "","",  // start_date, end_date
    null,"",  // progress, health
    "",null,"[]",  // unit_id, parent_id, depends_on
    JSON.stringify({status:"active"}),
    now,now
  );
}

// 规范化 LLM 输出的枚举值到 schema 允许的范围
const RISK_STATUS_MAP={"open":"open","monitoring":"monitoring","mitigated":"mitigated","closed":"closed","resolved":"closed","done":"closed","completed":"closed","active":"open","new":"open","处理中":"monitoring","已解决":"closed","已关闭":"closed","开放":"open"};
const RISK_SEVERITY_MAP={"low":"low","medium":"medium","high":"high","critical":"critical","info":"low","minor":"low","major":"high","blocker":"critical","严重":"high","高":"high","中":"medium","低":"low"};
const METRIC_STATUS_MAP={"pending":"pending","on-track":"on-track","atrisk":"at-risk","at-risk":"at-risk","off-track":"off-track","offtrack":"off-track","red":"off-track","yellow":"at-risk","green":"on-track","进行中":"on-track","正常":"on-track","风险":"at-risk","偏离":"off-track"};
function normalizeEnum(value,map,defaultValue){if(!value)return defaultValue;const key=String(value).toLowerCase().replace(/[\s_-]/g,"");return map[key]||map[value]||defaultValue;}

function writeCard(database,versionId,change,elementType){
  const{columnFields,attrsFields}=splitPatch(change.patch,elementType);
  // risk / metric 枚举值规范化（LLM 可能输出中文或近义词）
  if(elementType==="risk"){
    if(attrsFields.status!==undefined)attrsFields.status=normalizeEnum(attrsFields.status,RISK_STATUS_MAP,"open");
    if(attrsFields.severity!==undefined)attrsFields.severity=normalizeEnum(attrsFields.severity,RISK_SEVERITY_MAP,"medium");
    // risk 的 state 列复用为 status
    if(columnFields.state!==undefined)columnFields.state=normalizeEnum(columnFields.state,RISK_STATUS_MAP,"open");
  }
  if(elementType==="metric"){
    if(attrsFields.status!==undefined)attrsFields.status=normalizeEnum(attrsFields.status,METRIC_STATUS_MAP,"pending");
    if(columnFields.state!==undefined)columnFields.state=normalizeEnum(columnFields.state,METRIC_STATUS_MAP,"pending");
  }
  const now=new Date().toISOString();

  if(change.operation==="create"){
    if(cardExists(database,versionId,change.targetId))throw new TypeError("Review create target already exists in current draft");
    const title=columnFields.title||change.patch.name||change.targetId;
    const unitId=columnFields.unitId||(elementType==="task"?"default-unit":"");
    // task 写入前确保其 unit 存在于 project_cards（LLM 常省略 unit 定义）
    if(elementType==="task"&&unitId)ensureUnitCard(database,versionId,unitId);
    database.prepare(`INSERT INTO project_cards (version_id,external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      versionId,change.targetId,elementType,nextCardPosition(database,versionId),
      text(title,"title",{required:true,max:512}),
      text(columnFields.owner,"owner",{max:256})??"",
      text(columnFields.state,"state",{max:20})??"",
      text(columnFields.objective,"objective",{max:2000})??"",
      text(columnFields.startDate,"startDate",{max:10})??(columnFields.date??""),
      text(columnFields.endDate,"endDate",{max:10})??(columnFields.dueDate??""),
      number(columnFields.progress,"progress")??null,
      text(columnFields.health,"health",{max:20})??"",
      unitId,
      text(columnFields.parentId,"parentId",{max:128})??null,
      JSON.stringify(columnFields.dependsOn??[]),
      JSON.stringify(attrsFields),
      now,now
    );
    return;
  }

  if(change.operation==="delete"){
    if(!cardExists(database,versionId,change.targetId))throw new TypeError("Review delete target does not exist");
    database.prepare(`DELETE FROM project_cards WHERE version_id=? AND external_id=?`).run(versionId,change.targetId);
    return;
  }

  // update
  if(!cardExists(database,versionId,change.targetId))throw new TypeError("Review target does not exist in current draft");
  const current=getCardRow(database,versionId,change.targetId);
  const mergedAttrs={...current.attrs,...attrsFields};
  const updates=[];
  const params=[];
  if(columnFields.title!==undefined||columnFields.name!==undefined){updates.push("title=?");params.push(text(columnFields.title||columnFields.name,"title",{max:512}));}
  if(columnFields.owner!==undefined){updates.push("owner=?");params.push(columnFields.owner??"");}
  if(columnFields.state!==undefined){updates.push("state=?");params.push(columnFields.state??"");}
  if(columnFields.objective!==undefined){updates.push("objective=?");params.push(columnFields.objective??"");}
  if(columnFields.startDate!==undefined){updates.push("start_date=?");params.push(columnFields.startDate??"");}
  if(columnFields.endDate!==undefined){updates.push("end_date=?");params.push(columnFields.endDate??"");}
  if(columnFields.dueDate!==undefined){updates.push("end_date=?");params.push(columnFields.dueDate??"");}
  if(columnFields.date!==undefined){updates.push("start_date=?");params.push(columnFields.date??"");}
  if(columnFields.progress!==undefined){updates.push("progress=?");params.push(number(columnFields.progress,"progress")??null);}
  if(columnFields.health!==undefined){updates.push("health=?");params.push(columnFields.health??"");}
  if(columnFields.unitId!==undefined){const uid=columnFields.unitId||"default-unit";if(elementType==="task"&&uid)ensureUnitCard(database,versionId,uid);updates.push("unit_id=?");params.push(uid);}
  if(columnFields.parentId!==undefined){updates.push("parent_id=?");params.push(columnFields.parentId||null);}
  updates.push("card_attrs=?");params.push(JSON.stringify(mergedAttrs));
  updates.push("updated_at=?");params.push(now);
  params.push(versionId,change.targetId);
  database.prepare(`UPDATE project_cards SET ${updates.join(", ")} WHERE version_id=? AND external_id=?`).run(...params);
}

function applyCardLinks(database,versionId,change){
  if(change.operation==="delete")return;
  const dependencies=stringArray(change.patch.dependsOn,"dependsOn");
  if(dependencies===undefined)return;
  database.prepare("DELETE FROM project_card_links WHERE version_id=? AND card_external_id=?").run(versionId,change.targetId);
  const insert=database.prepare("INSERT INTO project_card_links (version_id,card_external_id,depends_on_external_id,position) VALUES (?,?,?,?)");
  dependencies.forEach((id,index)=>insert.run(versionId,change.targetId,id,index));
}

// ============================================================
// 旧路径（当 project_cards 表不存在时的回退）
// ============================================================
function nextPosition(database,table,versionId){return database.prepare(`SELECT coalesce(max(position),-1)+1 AS position FROM ${table} WHERE version_id=?`).get(versionId).position;}
function dataRow(database,table,versionId,id){const row=database.prepare(`SELECT data_json AS dataJson FROM ${table} WHERE version_id=? AND external_id=?`).get(versionId,id);return row?object(JSON.parse(row.dataJson)):undefined;}
function mergeData(current,patch,keys){const result={...current};for(const [field,target] of Object.entries(keys))if(patch[field]!==undefined)result[target]=patch[field];return result;}
function requireTarget(database,table,versionId,id){if(!database.prepare(`SELECT 1 FROM ${table} WHERE version_id=? AND external_id=?`).get(versionId,id))throw new TypeError("Review target does not exist in current draft");}
function requireCreate(database,table,versionId,id){if(database.prepare(`SELECT 1 FROM ${table} WHERE version_id=? AND external_id=?`).get(versionId,id))throw new TypeError("Review create target already exists in current draft");}

function applyOverview(database,versionId,change){if(change.operation!=="update")throw new TypeError("Overview only supports update");const row=database.prepare("SELECT metadata_json AS metadataJson FROM project_versions WHERE id=?").get(versionId);const metadata=object(JSON.parse(row.metadataJson));if(change.patch.title!==undefined)metadata.title=text(change.patch.title,"title",{required:true,max:160});if(change.patch.summary!==undefined)metadata.summary=text(change.patch.summary,"summary",{max:4000});if(change.patch.status!==undefined)metadata.projectStatus=text(change.patch.status,"status",{required:true,max:80});database.prepare("UPDATE project_versions SET metadata_json=? WHERE id=?").run(JSON.stringify(metadata),versionId);}

function unitData(current,patch){return mergeData(current,patch,{description:"objective",owner:"owner",status:"status",effectiveDate:"effectiveDate",lifecycleReason:"lifecycleReason",source:"source"});}
function applyUnit(database,versionId,change){const table="project_units";if(change.operation==="delete")throw new TypeError("Unit delete is not allowed");if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare("INSERT INTO project_units (version_id,external_id,position,name,data_json) VALUES (?,?,?,?,?)").run(versionId,change.targetId,nextPosition(database,table,versionId),text(change.patch.name,"name",{required:true,max:160}),JSON.stringify(unitData({status:"active"},change.patch)));return;}requireTarget(database,table,versionId,change.targetId);const data=unitData(dataRow(database,table,versionId,change.targetId),change.patch);database.prepare("UPDATE project_units SET name=coalesce(?,name),data_json=? WHERE version_id=? AND external_id=?").run(text(change.patch.name,"name",{required:true,max:160})??null,JSON.stringify(data),versionId,change.targetId);}

function applyStage(database,versionId,change){const table="project_stages";if(change.operation==="delete")throw new TypeError("Roadmap delete is not allowed");if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare("INSERT INTO project_stages (version_id,external_id,position,title,date_label,data_json) VALUES (?,?,?,?,?,?)").run(versionId,change.targetId,nextPosition(database,table,versionId),text(change.patch.title,"title",{required:true,max:160}),text(change.patch.date,"date",{max:10})??"",JSON.stringify(mergeData({},change.patch,{description:"description",state:"state"})));return;}requireTarget(database,table,versionId,change.targetId);const data=mergeData(dataRow(database,table,versionId,change.targetId),change.patch,{description:"description",state:"state"});database.prepare("UPDATE project_stages SET title=coalesce(?,title),date_label=coalesce(?,date_label),data_json=? WHERE version_id=? AND external_id=?").run(text(change.patch.title,"title",{required:true,max:160})??null,text(change.patch.date,"date",{max:10})??null,JSON.stringify(data),versionId,change.targetId);}

function ensureUnit(database,versionId,unitId){if(unitId&&database.prepare("SELECT 1 FROM project_units WHERE version_id=? AND external_id=?").get(versionId,unitId))return;database.prepare("INSERT INTO project_units (version_id,external_id,position,name,data_json) VALUES (?,?,?,?,?)").run(versionId,unitId,nextPosition(database,"project_units",versionId),unitId==="default-unit"?"默认团队":unitId,JSON.stringify({status:"active"}));}
function taskBase(database,versionId,change){const table="project_tasks",p=change.patch;const unitId=text(p.unitId,"unitId",{max:128})||"default-unit";const taskKeys={owner:"owner",state:"state",objective:"objective",stakeholders:"stakeholders",health:"health",deliverables:"deliverables",risks:"risks",acceptanceCriteria:"acceptanceCriteria",decisions:"decisions",expectedOutput:"expectedOutput"};if(change.operation==="delete")return;ensureUnit(database,versionId,unitId);if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare(`INSERT INTO project_tasks (version_id,external_id,unit_external_id,parent_external_id,position,title,start_date,end_date,progress,data_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(versionId,change.targetId,unitId,text(p.parentId,"parentId",{max:128})||null,nextPosition(database,table,versionId),text(p.title,"title",{required:true,max:240}),text(p.startDate,"startDate",{max:10})??"",text(p.endDate,"endDate",{max:10})??"",number(p.progress,"progress")??null,JSON.stringify(mergeData({},p,taskKeys)));return;}requireTarget(database,table,versionId,change.targetId);const current=dataRow(database,table,versionId,change.targetId),data=mergeData(current,p,taskKeys);database.prepare(`UPDATE project_tasks SET unit_external_id=coalesce(?,unit_external_id),parent_external_id=CASE WHEN ?=1 THEN ? ELSE parent_external_id END,title=coalesce(?,title),start_date=coalesce(?,start_date),end_date=coalesce(?,end_date),progress=CASE WHEN ?=1 THEN ? ELSE progress END,data_json=? WHERE version_id=? AND external_id=?`).run(unitId,p.parentId!==undefined?1:0,text(p.parentId,"parentId",{max:128})||null,text(p.title,"title",{required:true,max:240})??null,text(p.startDate,"startDate",{max:10})??null,text(p.endDate,"endDate",{max:10})??null,p.progress!==undefined?1:0,number(p.progress,"progress")??null,JSON.stringify(data),versionId,change.targetId);}

function taskLinks(database,versionId,change){if(change.operation==="delete")return;const dependencies=stringArray(change.patch.dependsOn,"dependsOn");if(dependencies===undefined)return;database.prepare("DELETE FROM task_links WHERE version_id=? AND task_external_id=?").run(versionId,change.targetId);const insert=database.prepare("INSERT INTO task_links (version_id,task_external_id,depends_on_external_id,position) VALUES (?,?,?,?)");dependencies.forEach((id,index)=>insert.run(versionId,change.targetId,id,index));}
function deleteTask(database,versionId,change){if(change.operation!=="delete")return;requireTarget(database,"project_tasks",versionId,change.targetId);const referenced=database.prepare(`SELECT (SELECT count(*) FROM project_tasks WHERE version_id=? AND parent_external_id=?)+(SELECT count(*) FROM task_links WHERE version_id=? AND depends_on_external_id=?)+(SELECT count(*) FROM workstream_tasks WHERE version_id=? AND task_external_id=?) AS count`).get(versionId,change.targetId,versionId,change.targetId,versionId,change.targetId).count;if(referenced)throw new TypeError("Task delete target is still referenced");database.prepare("DELETE FROM project_tasks WHERE version_id=? AND external_id=?").run(versionId,change.targetId);}

function applyOutcome(database,versionId,change){const table="project_closures",p=change.patch;if(change.operation==="delete")throw new TypeError("Outcome delete is not allowed");if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare("INSERT INTO project_closures (version_id,external_id,position,title,date_label,data_json) VALUES (?,?,?,?,?,?)").run(versionId,change.targetId,nextPosition(database,table,versionId),text(p.title,"title",{required:true,max:160}),text(p.date,"date",{max:10})??"",JSON.stringify(mergeData({},p,{state:"state",description:"description",result:"result",source:"source"})));return;}requireTarget(database,table,versionId,change.targetId);const data=mergeData(dataRow(database,table,versionId,change.targetId),p,{state:"state",description:"description",result:"result",source:"source"});database.prepare("UPDATE project_closures SET title=coalesce(?,title),date_label=coalesce(?,date_label),data_json=? WHERE version_id=? AND external_id=?").run(text(p.title,"title",{required:true,max:160})??null,text(p.date,"date",{max:10})??null,JSON.stringify(data),versionId,change.targetId);}

function applyRisk(database,versionId,change){const table="project_risks",p=change.patch;const validSeverity=s=>["low","medium","high","critical"].includes(s)?s:"medium";const safeSeverity=p.severity==="unknown"||!p.severity?validSeverity(null):text(p.severity,"severity",{required:true,max:20});if(change.operation==="delete"){requireTarget(database,table,versionId,change.targetId);database.prepare("DELETE FROM project_risks WHERE version_id=? AND external_id=?").run(versionId,change.targetId);return;}if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare(`INSERT INTO project_risks (version_id,external_id,position,title,severity,status,owner,mitigation,due_date,source) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(versionId,change.targetId,nextPosition(database,table,versionId),text(p.title,"title",{required:true,max:240}),safeSeverity,text(p.status,"status",{required:true,max:20}),text(p.owner,"owner",{max:160})??"",text(p.mitigation,"mitigation",{max:2000})??"",text(p.dueDate,"dueDate",{max:10})??"",text(p.source,"source",{max:500})??"");return;}requireTarget(database,table,versionId,change.targetId);database.prepare(`UPDATE project_risks SET title=coalesce(?,title),severity=coalesce(?,severity),status=coalesce(?,status),owner=coalesce(?,owner),mitigation=coalesce(?,mitigation),due_date=coalesce(?,due_date),source=coalesce(?,source) WHERE version_id=? AND external_id=?`).run(...[text(p.title,"title",{required:true,max:240}),safeSeverity,text(p.status,"status",{max:20}),text(p.owner,"owner",{max:160}),text(p.mitigation,"mitigation",{max:2000}),text(p.dueDate,"dueDate",{max:10}),text(p.source,"source",{max:500})].map(value=>value??null),versionId,change.targetId);}

function applyMetric(database,versionId,change){const table="project_metrics",p=change.patch;if(change.operation==="delete")throw new TypeError("Metric delete is not allowed");const encoded=value=>value===undefined?undefined:JSON.stringify(value);if(change.operation==="create"){requireCreate(database,table,versionId,change.targetId);database.prepare(`INSERT INTO project_metrics (version_id,external_id,position,name,value_json,unit,status,as_of,target_json,source) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(versionId,change.targetId,nextPosition(database,table,versionId),text(p.name,"name",{required:true,max:160}),encoded(p.value)??null,text(p.unit,"unit",{max:80})??"",text(p.status,"status",{required:true,max:20}),text(p.asOf,"asOf",{max:10})??"",encoded(p.target)??null,text(p.source,"source",{max:500})??"");return;}requireTarget(database,table,versionId,change.targetId);database.prepare(`UPDATE project_metrics SET name=coalesce(?,name),value_json=CASE WHEN ?=1 THEN ? ELSE value_json END,unit=coalesce(?,unit),status=coalesce(?,status),as_of=coalesce(?,as_of),target_json=CASE WHEN ?=1 THEN ? ELSE target_json END,source=coalesce(?,source) WHERE version_id=? AND external_id=?`).run(text(p.name,"name",{required:true,max:160})??null,p.value!==undefined?1:0,encoded(p.value)??null,text(p.unit,"unit",{max:80})??null,text(p.status,"status",{max:20})??null,text(p.asOf,"asOf",{max:10})??null,p.target!==undefined?1:0,encoded(p.target)??null,text(p.source,"source",{max:500})??null,versionId,change.targetId);}

// module → element_type 映射
const MODULE_TO_ELEMENT_TYPE={
  "task-network":"task","gantt":"task",
  "units":"unit","roadmap":"stage","outcomes":"outcome",
  "risks":"risk","metrics":"metric"
};

export function applyReviewedChanges(database,versionId,changes){
  const useUnified=tableExists(database,"project_cards");

  if(useUnified){
    for(const change of changes){
      if(change.module==="overview"){applyOverview(database,versionId,change);continue;}
      const elementType=MODULE_TO_ELEMENT_TYPE[change.module];
      if(!elementType)throw new TypeError(`Unsupported review module: ${change.module}`);
      writeCard(database,versionId,change,elementType);
      if(elementType==="task")applyCardLinks(database,versionId,change);
    }
    return versionId;
  }

  // 旧路径回退
  const tasks=changes.filter(item=>["task-network","gantt"].includes(item.module));
  for(const change of changes.filter(item=>!["task-network","gantt"].includes(item.module))){
    if(change.module==="overview")applyOverview(database,versionId,change);
    else if(change.module==="units")applyUnit(database,versionId,change);
    else if(change.module==="roadmap")applyStage(database,versionId,change);
    else if(change.module==="outcomes")applyOutcome(database,versionId,change);
    else if(change.module==="risks")applyRisk(database,versionId,change);
    else if(change.module==="metrics")applyMetric(database,versionId,change);
    else throw new TypeError("Unsupported review module");
  }
  for(const change of tasks)taskBase(database,versionId,change);
  for(const change of tasks)taskLinks(database,versionId,change);
  for(const change of tasks)deleteTask(database,versionId,change);
  return versionId;
}
