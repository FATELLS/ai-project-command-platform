// 最小复现：定位 SQLite parameter 3 到底是哪个参数
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE t (a INTEGER, b TEXT, c TEXT, d INTEGER, e TEXT, f TEXT, g TEXT, h TEXT, i REAL, j TEXT)`);

// 模拟 taskBase 的 create 绑定
const stmt = db.prepare("INSERT INTO t VALUES (?,?,?,?,?,?,?,?,?,?)");

// 先用全合法值测一遍
try {
  stmt.run(1, "id1", "default-unit", null, 0, "标题", "", "", 60, "{}");
  console.log("✓ 全合法值成功");
} catch(e) { console.log("✗ 全合法值失败:", e.message); }

// 再测 progress=null (第8个参数, index 8)
try {
  stmt.run(1, "id2", "default-unit", null, 1, "标题2", "", "", null, "{}");
  console.log("✓ progress=null 成功");
} catch(e) { console.log("✗ progress=null 失败:", e.message); }

// 测 undefined
try {
  stmt.run(1, "id3", "default-unit", null, 2, "标题3", "", "", undefined, "{}");
  console.log("✓ progress=undefined 成功");
} catch(e) { console.log("✗ progress=undefined 失败:", e.message); }

// 关键：unitId=undefined 时 text() 的行为
// version-apply 的 text(value,label,{required:true}) 当 value=undefined 时:
//   typeof undefined !== "string" → 抛 TypeError
// 但报错是 SQLite binding error，说明没走到 text 抛错...
// 难道是 STRICT 表的列约束？
console.log("");
console.log("=== 测 STRICT 表 ===");
db.exec(`CREATE TABLE t_strict (a INTEGER, b TEXT, c TEXT NOT NULL, d TEXT, j TEXT NOT NULL DEFAULT '{}') STRICT;`);
const stmt2 = db.prepare("INSERT INTO t_strict (a,b,c,d,j) VALUES (?,?,?,?,?)");
try {
  stmt2.run(1, "id", undefined, null, "{}");
  console.log("✓ c=undefined 成功 (不应该)");
} catch(e) { console.log("✗ c=undefined 失败:", e.message); }
