function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function text(value,label,{required=false,max=500}={}){if(value===undefined)return undefined;if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new TypeError(`${label} is invalid`);return value;}
function number(value,label){if(value===undefined||value===null||value==="unknown"||value==="")return undefined;if(typeof value!=="number")throw new TypeError(`${label} is invalid`);return value;}
function stringArray(value,label){if(value===undefined)return undefined;if(!Array.isArray(value)||value.some(item=>typeof item!=="string"))throw new TypeError(`${label} is invalid`);return [...new Set(value)];}

// PMBOK 数组字段去重键——用于 update 时的深度合并
const ARRAY_DEDUP_KEY={"stakeholders":"_self","deliverables":"name","risks":"title","decisions":"summary"};
// 按 dedup key 合并两个 PMBOK 数组：新条目追加，已有同名条目更新非空字段
function mergePmbokArray(existing,incoming,dedupKey){
  if(!Array.isArray(existing)||existing.length===0)return [...(incoming??[])];
  if(!Array.isArray(incoming)||incoming.length===0)return [...existing];
  const getKeyValue=(item)=>{
    if(dedupKey==="_self")return typeof item==="string"?item:JSON.stringify(item);
    return typeof item==="object"&&item!==null?String(item[dedupKey]??""):"";
  };
  const result=[...existing];
  const existingKeys=new Set(existing.map(getKeyValue));
  for(const item of incoming){
    const key=getKeyValue(item);
    if(key&&existingKeys.has(key)){
      // 同名条目——更新非空字段（浅合并）
      const idx=result.findIndex(r=>getKeyValue(r)===key);
      if(idx>=0&&typeof item==="object"&&typeof result[idx]==="object"){
        result[idx]={...result[idx],...Object.fromEntries(Object.entries(item).filter(([,v])=>v!==undefined&&v!==null&&v!==""))};
      }
    }else{
      result.push(item);
      if(key)existingKeys.add(key);
    }
  }
  return result;
}
// 对 update 操作中 card_attrs 的数组字段做深度合并
function deepMergeAttrs(currentAttrs,incomingAttrs){
  const merged={...currentAttrs};
  for(const[key,value]of Object.entries(incomingAttrs)){
    if(ARRAY_DEDUP_KEY[key]&&Array.isArray(value)){
      merged[key]=mergePmbokArray(currentAttrs[key]??[],value,ARRAY_DEDUP_KEY[key]);
    }else{
      merged[key]=value;
    }
  }
  return merged;
}

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
  // Roadmap/outcome proposals use `date`; unified cards expose it as dateLabel.
  if(["stage","outcome"].includes(elementType)&&attrsFields.date!==undefined&&attrsFields.dateLabel===undefined){
    attrsFields.dateLabel=attrsFields.date;
    delete attrsFields.date;
  }
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
  const mergedAttrs=deepMergeAttrs(current.attrs,attrsFields);
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

function applyOverview(database,versionId,change){if(change.operation!=="update")throw new TypeError("Overview only supports update");const row=database.prepare("SELECT metadata_json AS metadataJson FROM project_versions WHERE id=?").get(versionId);const metadata=object(JSON.parse(row.metadataJson));if(change.patch.title!==undefined)metadata.title=text(change.patch.title,"title",{required:true,max:160});if(change.patch.summary!==undefined)metadata.summary=text(change.patch.summary,"summary",{max:4000});if(change.patch.status!==undefined)metadata.projectStatus=text(change.patch.status,"status",{required:true,max:80});database.prepare("UPDATE project_versions SET metadata_json=? WHERE id=?").run(JSON.stringify(metadata),versionId);}

// module → element_type 映射
const MODULE_TO_ELEMENT_TYPE={
  "task-network":"task","gantt":"task",
  "units":"unit","roadmap":"stage","outcomes":"outcome",
  "risks":"risk","metrics":"metric"
};

export function applyReviewedChanges(database,versionId,changes){
  for(const change of changes){
    if(change.module==="overview"){applyOverview(database,versionId,change);continue;}
    const elementType=MODULE_TO_ELEMENT_TYPE[change.module];
    if(!elementType)throw new TypeError(`Unsupported review module: ${change.module}`);
    writeCard(database,versionId,change,elementType);
    if(elementType==="task")applyCardLinks(database,versionId,change);
  }
  return versionId;
}
