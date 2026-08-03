import { resolve } from "node:path";
import { restoreXuguVolume } from "../src/operations/database-backup.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = valueAfter("--source");
if (!source || valueAfter("--confirm") !== "RESTORE") {
  throw new Error("Usage: npm run restore -- --source /secure/path/xugu-backup.tar.gz --confirm RESTORE (platform must be stopped)");
}
console.log(JSON.stringify(await restoreXuguVolume(resolve(source)), null, 2));
