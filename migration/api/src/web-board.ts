import {readBackup} from "../../../lib/backup.ts";
import {prepareRecovery} from "../../recovery.ts";
import {ApiError} from "./auth.ts";
import {currentRecovery, restoreRecovery} from "./recovery.ts";
import type {SqlDatabase} from "./store.ts";

export async function getWebBoard(db:SqlDatabase, owner:string) {
  const {version,backup}=await currentRecovery(db,owner);
  if (!backup) return {semester:null,revision:version};
  const board=readBackup(backup.snapshot.originalJson);
  const overrides=new Map(backup.completion.map(row=>[row.taskId,Boolean(row.done)]));
  for (const task of board.tasks) if (overrides.has(task.id)) task.done=overrides.get(task.id);
  return {semester:board,revision:version};
}

export async function saveWebBoard(db:SqlDatabase, owner:string, body:Record<string,unknown>) {
  const {version,backup}=await currentRecovery(db,owner);
  if (!backup) throw new ApiError(404,"missing_board","Import your semester first.");
  if (body.revision!==version) throw new ApiError(409,"board_changed","The semester changed. Reload before saving.");
  let desired;
  try {desired=readBackup(JSON.stringify(body.semester));}
  catch {throw new ApiError(400,"invalid_board","This semester could not be validated.");}
  const previous=readBackup(backup.snapshot.originalJson);
  if (previous.year!==desired.year || previous.session!==desired.session || previous.boardGeneration!==desired.boardGeneration)
    throw new ApiError(400,"board_replaced","Use Account & backups to replace a semester.");
  const source=new Map(previous.tasks.map(task=>[task.id,task]));
  const completion=new Map(backup.completion.map(row=>[row.taskId,row]));
  // Keep completion in the same revisioned records as iOS. Pure checkbox edits
  // preserve the imported JSON byte-for-byte. Other edits update the active snapshot.
  for (const task of desired.tasks) {
    const before=source.get(task.id);
    if (!before) continue;
    const override=completion.get(task.id);
    const wasDone=override ? Boolean(override.done) : Boolean(before.done);
    if (Boolean(task.done)!==wasDone)
      completion.set(task.id,{taskId:task.id,done:task.done ? 1 : 0,revision:(override?.revision ?? 0)+1});
    if (before.done===undefined) delete task.done;
    else task.done=before.done;
  }
  let snapshot=backup.snapshot;
  if (JSON.stringify(desired)!==JSON.stringify(previous)) {
    try {snapshot=(await prepareRecovery(JSON.stringify(desired),owner,backup)).backup.snapshot;}
    catch(e){throw new ApiError(400,"linked_work",e instanceof Error ? e.message : "Invalid semester change.");}
  }
  return restoreRecovery(db,owner,{expectedVersion:version,file:JSON.stringify({...backup,snapshot,completion:[...completion.values()]})});
}
