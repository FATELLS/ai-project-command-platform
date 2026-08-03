import { resolve } from "node:path";
import { backupXuguVolume } from "../src/operations/database-backup.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const output = valueAfter("--output");
if (!output) throw new Error("Usage: npm run backup -- --output /secure/path/xugu-backup.tar.gz (platform must be stopped)");
console.log(JSON.stringify(await backupXuguVolume(resolve(output)), null, 2));
