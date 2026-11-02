import { clockTime, dateKey, shortDate } from "./model";
import { addDays, dueLabel } from "./experience";
import { sydneyInstant } from "../../lib/sydney-time";
import { readStagingSemester, type StagingSemester } from "./staging-core";

export const CLOUD_WIDGET_URL = "semester-preview://cloud-work";
export const CLOUD_WIDGET_CACHE_KEY = "semester.preview.cloud-widget.v1";
export const CLOUD_WIDGET_MAX_AGE = 24 * 60 * 60 * 1000;
const STALE_AFTER = 6 * 60 * 60 * 1000;

// Kept in app-private storage. Only the display props below enter the App Group.
export type CloudSnapshot = {
  version: 1; scope: string; subject: string; accountId: string;
  boardId: string; revision: number; syncedAt: number;
  deadlines: { unit: string; title: string; due: number }[];
  completed: number; total: number;
};
export type CloudWidgetProps = {
  unit: string; title: string; when: string; freshness: string;
  second: string; secondWhen: string; progress: string; url: string;
};
export type CloudTimeline = { date: Date; props: CloudWidgetProps }[];
const compact = (s: string, length = 100) => s.replace(/\s+/g, " ").trim().slice(0, length);

export function makeCloudSnapshot(scope: string, subject: string, accountId: string, value: StagingSemester, now: number): CloudSnapshot {
  const { semester, revision } = readStagingSemester(value);
  if (!scope || !subject || !accountId || !Number.isFinite(now)) throw new Error("Verified widget identity is required.");
  return { version: 1, scope, subject, accountId, boardId: semester.id, revision, syncedAt: now,
    deadlines: semester.assessments.map(a => ({unit:compact(a.unitCode,24),title:compact(a.title),due:Date.parse(a.dueAt)}))
      .sort((a,b)=>a.due-b.due),
    completed: semester.tasks.filter(t=>t.completed).length, total: semester.tasks.length };
}

export function readCloudSnapshot(raw: string | null, scope: string, subject: string, now: number): CloudSnapshot | undefined {
  try {
    const s = JSON.parse(raw ?? "null");
    if (!s || s.version !== 1 || s.scope !== scope || s.subject !== subject
      || typeof s.accountId !== "string" || !s.accountId || typeof s.boardId !== "string" || !s.boardId
      || !Number.isSafeInteger(s.revision) || s.revision < 1 || !Number.isFinite(s.syncedAt)
      || s.syncedAt > now + 60000 || now - s.syncedAt >= CLOUD_WIDGET_MAX_AGE
      || !Number.isSafeInteger(s.completed) || !Number.isSafeInteger(s.total)
      || s.completed < 0 || s.total < s.completed || s.total > 100
      || !Array.isArray(s.deadlines) || s.deadlines.length > 100
      || !s.deadlines.every((d: any)=>d && typeof d.unit === "string" && d.unit.length <= 24
        && typeof d.title === "string" && d.title.length <= 100 && Number.isFinite(d.due))) return undefined;
    // Explicit projection discards unexpected fields, including any credentials.
    return {version:1,scope,subject,accountId:s.accountId,boardId:s.boardId,revision:s.revision,syncedAt:s.syncedAt,
      deadlines:s.deadlines.map((d: any)=>({unit:d.unit,title:d.title,due:d.due})).sort((a: {due:number},b: {due:number})=>a.due-b.due),
      completed:s.completed,total:s.total};
  } catch { return undefined; }
}

export function emptyCloudWidget(title = "Sign in to Semester"): CloudWidgetProps {
  return {unit:"CLOUD · TRIAL",title,when:"Tap to open cloud work",freshness:"No synced deadlines",
    second:"",secondWhen:"",progress:"Synthetic test data",url:CLOUD_WIDGET_URL};
}
export function cloudWidgetProps(snapshot: CloudSnapshot, now: number, syncFailed = false): CloudWidgetProps {
  const synced = `${shortDate(snapshot.syncedAt)} ${clockTime(snapshot.syncedAt)}`;
  if (now - snapshot.syncedAt >= CLOUD_WIDGET_MAX_AGE || snapshot.syncedAt > now + 60000)
    return {...emptyCloudWidget("Refresh your deadlines"),freshness:`Last sync ${synced}`};
  const next = snapshot.deadlines.filter(d=>d.due>now), past = snapshot.deadlines.length-next.length;
  const [first,second] = next;
  const stale = now - snapshot.syncedAt >= STALE_AFTER;
  const freshness = `${syncFailed ? "Sync failed · " : stale ? "Refresh · " : "Synced "}${dateKey(now) === dateKey(snapshot.syncedAt) ? clockTime(snapshot.syncedAt) : synced}`;
  return {
    unit:first ? `${first.unit} · TRIAL` : "CLOUD · TRIAL",
    title:first?.title ?? (past ? `${past} past ${past === 1 ? "date" : "dates"} · check` : "No upcoming dated work"),
    when:first ? dueLabel({due:first.due},now) : "Open cloud work to review",
    freshness, second:second ? `${second.unit} · ${second.title}` : "",
    secondWhen:second ? dueLabel({due:second.due},now) : "",
    progress:`${snapshot.completed}/${snapshot.total} preparation steps${past ? ` · ${past} past ${past === 1 ? "date" : "dates"}` : ""}`,
    url:CLOUD_WIDGET_URL,
  };
}
export function cloudWidgetTimeline(snapshot: CloudSnapshot, now: number, syncFailed = false): CloudTimeline {
  const expiry = snapshot.syncedAt + CLOUD_WIDGET_MAX_AGE;
  const dates = new Set([now,expiry,snapshot.syncedAt + STALE_AFTER]);
  for (const d of snapshot.deadlines) if(d.due>now && d.due<expiry) dates.add(d.due);
  // Sydney day labels must advance even if the host device uses another zone.
  for(let i=1;i<=2;i++) {
    const midnight=sydneyInstant(addDays(dateKey(now),i),"00:00");
    if(midnight!==undefined)dates.add(midnight);
  }
  return [...dates].filter(d=>d>=now && (d<=expiry || d===now)).sort((a,b)=>a-b)
    .map(date=>({date:new Date(date),props:cloudWidgetProps(snapshot,date,syncFailed)}));
}

type Storage = { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> };
export type CloudWidgetState = { props:CloudWidgetProps; snapshot?:CloudSnapshot; error?:string };

// Serial storage and generation checks prevent a slow previous account's read
// or write from restoring its widget after sign-out or account switching.
export class CloudWidgetBridge {
  private subject: string | null | undefined;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private snapshot?: CloudSnapshot;
  private syncFailed = false;
  constructor(private scope:string, private storage:Storage, private publish:(timeline:CloudTimeline)=>void,
    private report:(state:CloudWidgetState)=>void, private now:()=>number = Date.now) {}
  private enqueue(work:()=>Promise<void>) {
    const result=this.queue.then(work); this.queue=result.catch(()=>{}); return result;
  }
  private display(title = "Sign in to Semester") {
    const timeline=this.snapshot ? cloudWidgetTimeline(this.snapshot,this.now(),this.syncFailed)
      : [{date:new Date(this.now()),props:emptyCloudWidget(title)}];
    try { this.publish(timeline); this.report({props:timeline[0].props,snapshot:this.snapshot}); }
    catch { this.report({props:timeline[0].props,snapshot:this.snapshot,error:"Widget refresh failed. Reopen Semester to retry."}); }
  }
  async changeSubject(subject:string|null) {
    if(subject===this.subject) return this.queue;
    this.subject=subject; const generation=++this.generation;
    this.snapshot=undefined; this.syncFailed=false; this.display(subject ? "Loading cloud work" : undefined);
    return this.enqueue(async()=>{
      if(!subject) { await this.storage.removeItem(CLOUD_WIDGET_CACHE_KEY); return; }
      const saved=await this.storage.getItem(CLOUD_WIDGET_CACHE_KEY);
      if(generation!==this.generation) return;
      this.snapshot=readCloudSnapshot(saved,this.scope,subject,this.now());
      if(!this.snapshot) await this.storage.removeItem(CLOUD_WIDGET_CACHE_KEY);
      if(generation===this.generation) this.display("Refresh cloud work");
    });
  }
  async accept(subject:string,accountId:string,board:StagingSemester) {
    if(subject!==this.subject) return;
    const generation=this.generation, snapshot=makeCloudSnapshot(this.scope,subject,accountId,board,this.now());
    return this.enqueue(async()=>{
      if(generation!==this.generation || subject!==this.subject) return;
      // Within a board, an older network response cannot replace a newer save.
      if(this.snapshot?.boardId===snapshot.boardId && this.snapshot.revision>snapshot.revision) return;
      await this.storage.setItem(CLOUD_WIDGET_CACHE_KEY,JSON.stringify(snapshot));
      if(generation!==this.generation) return;
      this.snapshot=snapshot; this.syncFailed=false; this.display();
    });
  }
  async clear(title = "Refresh cloud work") {
    ++this.generation; this.snapshot=undefined; this.syncFailed=false; this.display(title);
    return this.enqueue(()=>this.storage.removeItem(CLOUD_WIDGET_CACHE_KEY));
  }
  unavailable() { this.syncFailed=true; this.display("Open Semester to refresh"); }
  refreshDisplay() { this.display(this.subject ? "Refresh cloud work" : "Sign in to Semester"); }
}
