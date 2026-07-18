import { resolve } from "node:path";
import { defaultDatabasePath } from "../src/db/database.mjs";
import { restoreDatabaseFile } from "../src/operations/database-backup.mjs";

function valueAfter(flag){const index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:undefined;}
const source=valueAfter("--source");
if(!source||valueAfter("--confirm")!=="RESTORE")throw new Error("Usage: npm run restore -- --source /explicit/backup.sqlite --confirm RESTORE (server must be stopped)");
const target=resolve(valueAfter("--database")??defaultDatabasePath());
console.log(JSON.stringify(await restoreDatabaseFile(resolve(source),target),null,2));
