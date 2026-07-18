import { resolve } from "node:path";
import { defaultDatabasePath } from "../src/db/database.mjs";
import { backupDatabaseFile } from "../src/operations/database-backup.mjs";

function valueAfter(flag){const index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:undefined;}
const source=resolve(valueAfter("--database")??defaultDatabasePath());
const output=valueAfter("--output");
if(!output)throw new Error("Usage: npm run backup -- --output /explicit/path/platform.sqlite");
console.log(JSON.stringify(await backupDatabaseFile(source,resolve(output)),null,2));
