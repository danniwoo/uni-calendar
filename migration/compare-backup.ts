// Offline check for a real download. Print counts and digests, never individual marks or task text.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {readBackup} from "../lib/backup";

const [source, exported] = process.argv.slice(2);
if (!source || !exported || source === exported) throw new Error("Choose separate source and re-export files.");
const inspect = (path: string) => {
  const bytes = readFileSync(path), raw = JSON.parse(bytes.toString("utf8"));
  const board = readBackup(bytes.toString("utf8"));
  return {bytes, sha256:createHash("sha256").update(bytes).digest("hex"), raw,
    grade:board.tasks.filter(t => t.grade != null).map(t => [t.id,t.grade]),
    plans:board.tasks.filter(t => t.gradePlan != null).map(t => [t.id,t.gradePlan]),
    completed:board.completed, flags:board.tasks.filter(t => typeof t.done === "boolean").map(t => [t.id,t.done]),
    undated:board.tasks.filter(t => !t.date)};
};
const a = inspect(source), b = inspect(exported);
function compare(label: string, x: unknown, y: unknown) {
  if (!isDeepStrictEqual(x,y)) throw new Error(label + " differs; keep the original.");
}
for (const k of ["raw","grade","plans","completed","flags","undated"] as const) compare(k, a[k], b[k]);
compare("bytes", a.bytes, b.bytes);
console.log(JSON.stringify({match:true,sourceSha256:a.sha256,exportSha256:b.sha256,bytes:a.bytes.length,
  gradedWork:a.grade.length,gradePlans:a.plans.length,completionEntries:Object.keys(a.completed).length,
  completionTrue:Object.values(a.completed).filter(Boolean).length,completionFalse:Object.values(a.completed).filter(v=>!v).length,
  workWithDoneFlag:a.flags.length,undatedWork:a.undated.length,workTotal:a.raw.tasks.length}, null, 2));
