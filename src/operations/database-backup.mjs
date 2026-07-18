import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { openDatabase } from "../db/database.mjs";

function explicitPath(value,label){if(!value)throw new TypeError(`${label} path is required`);return resolve(value);}
function sqlString(value){return `'${value.replaceAll("'","''")}'`;}

export async function verifyDatabaseFile(path) {
  const target=explicitPath(path,"Database");
  const info=await stat(target);
  if(!info.isFile()||info.size<1024)throw new Error("Database backup is empty or invalid");
  const database=openDatabase(target,{readOnly:true});
  try{
    const quick=database.prepare("PRAGMA quick_check").all();
    if(quick.length!==1||quick[0].quick_check!=="ok")throw new Error("SQLite quick_check failed");
    const foreign=database.prepare("PRAGMA foreign_key_check").all();
    if(foreign.length)throw new Error("SQLite foreign_key_check failed");
    const latest=database.prepare("SELECT max(version) AS version FROM schema_migrations").get()?.version;
    if(Number(latest)<6)throw new Error("Database migration history is incomplete");
    return{path:target,bytes:info.size,migrationVersion:Number(latest),quickCheck:"ok"};
  }finally{database.close();}
}

export async function backupDatabaseFile(sourcePath,targetPath) {
  const source=explicitPath(sourcePath,"Source database"),target=explicitPath(targetPath,"Backup");
  if(source===target)throw new TypeError("Backup target must differ from the source database");
  await mkdir(dirname(target),{recursive:true});
  try{await unlink(target);}catch(error){if(error.code!=="ENOENT")throw error;}
  const database=openDatabase(source);
  try{database.exec(`VACUUM INTO ${sqlString(target)}`);}finally{database.close();}
  return verifyDatabaseFile(target);
}

export async function restoreDatabaseFile(sourcePath,targetPath,options={}) {
  const source=explicitPath(sourcePath,"Restore source"),target=explicitPath(targetPath,"Restore target");
  if(source===target)throw new TypeError("Restore source and target must differ");
  const verified=await verifyDatabaseFile(source);
  await mkdir(dirname(target),{recursive:true});
  const suffix=options.suffix??new Date().toISOString().replaceAll(":","-");
  const preserved=`${target}.pre-restore-${suffix}.sqlite`;
  try{await copyFile(target,preserved);}catch(error){if(error.code!=="ENOENT")throw error;}
  const temporary=`${target}.restore-${suffix}.tmp`;
  await copyFile(source,temporary);
  await verifyDatabaseFile(temporary);
  await rename(temporary,target);
  return{...verified,target,preserved};
}
