export const PLAN_STATUSES = ["considering", "planned", "enrolled", "completed"] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];
export type PlanSession = "S1C" | "S2C";
export const STATUS_LABEL: Record<PlanStatus, string> = {
  considering: "Considering", planned: "Planned", enrolled: "Enrolled", completed: "Completed",
};
export type PlanEntry = {
  id: string; university: "usyd"; code: string; name: string;
  year: number; session: PlanSession; status: PlanStatus; credits: number | null;
  finalMark: number | null; finalGrade: string | null; wamExcluded: boolean;
  revision: number; updatedAt: string;
};
export type PlanDraft = Omit<PlanEntry, "id" | "revision" | "updatedAt">;
export type FriendProfile = {id: string; name: string; sharing: boolean; revision: number};
export type PlanFriend = {
  id: string; connectionId: string; name: string; revision: number;
  state: "accepted" | "incoming" | "outgoing" | "blocked";
};
// Explicit allowlist: extending the owner's records must never expand friend access.
export type SharedPlan = Pick<PlanEntry, "university" | "code" | "name" | "year" | "session" | "status" | "credits" | "updatedAt"> & {friendId: string; friendName: string};
export type InvitationStatus = {state:"none"|"active"|"expired"|"revoked";expiresAt:string|null;revision:number;fingerprint:string|null};
export type FriendsPage = {friends:PlanFriend[];friendsNext:string|null};
export type SharedPage = {sharedPlans:SharedPlan[];sharedNext:string|null};
export type SharedFilter = {year?:number;session?:PlanSession;friend?:string;code?:string};
export type CoursePlanData = FriendsPage & SharedPage & {
  invitation:InvitationStatus; incomingCount:number; friendCount:number;
  profile: FriendProfile | null; plans: PlanEntry[]; friends: PlanFriend[]; sharedPlans: SharedPlan[];
};
export class PlanError extends Error {
  constructor(message: string, public status = 400, public retryAfter?:number) { super(message); }
}
export function planDraft(raw: unknown): PlanDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new PlanError("Check the unit details.");
  const p = raw as Record<string, unknown>;
  const code = typeof p.code === "string" ? p.code.trim().toUpperCase() : "";
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (p.university !== "usyd" || !/^[A-Z]{4}\d{4}$/.test(code)) throw new PlanError("Enter a USYD unit code, for example ISYS2120.");
  if (!name || name.length > 160) throw new PlanError("Enter a unit name of up to 160 characters.");
  if (!Number.isInteger(p.year) || Number(p.year) < 2000 || Number(p.year) > 2100) throw new PlanError("Choose a year between 2000 and 2100.");
  if (p.session !== "S1C" && p.session !== "S2C") throw new PlanError("Choose Semester 1 or 2.");
  if (!PLAN_STATUSES.includes(p.status as PlanStatus)) throw new PlanError("Choose a course status.");
  if (p.credits !== null && (typeof p.credits !== "number" || !Number.isFinite(p.credits) || p.credits < 0 || p.credits > 60 || p.credits * 2 % 1)) throw new PlanError("Enter credit points in half-point increments from 0 to 60, or leave blank.");
  const finalMark=p.finalMark===undefined?null:p.finalMark;
  if(finalMark!==null&&(typeof finalMark!=="number"||!Number.isFinite(finalMark)||finalMark<0||finalMark>100))throw new PlanError("Enter a final mark from 0 to 100, or leave it blank.");
  if(p.finalGrade!=null&&typeof p.finalGrade!=="string")throw new PlanError("Enter a final grade label, or leave it blank.");
  const finalGrade=typeof p.finalGrade==="string"?p.finalGrade.trim():null;
  if(finalGrade&&(finalGrade.length>24||/[\u0000-\u001f\u007f]/.test(finalGrade)))throw new PlanError("Enter a final grade label of up to 24 characters.");
  if(p.wamExcluded!==undefined&&typeof p.wamExcluded!=="boolean")throw new PlanError("Choose whether to exclude this result from WAM.");
  return {university:"usyd", code, name, year:p.year as number, session:p.session, status:p.status as PlanStatus, credits:p.credits as number|null,finalMark:finalMark as number|null,finalGrade:finalGrade||null,wamExcluded:p.wamExcluded===true};
}
export function sameOffering(a: Pick<PlanDraft,"university"|"code"|"year"|"session">, b: Pick<PlanDraft,"university"|"code"|"year"|"session">) {
  return a.university===b.university && a.code===b.code && a.year===b.year && a.session===b.session;
}
export function matchesFor(plan: PlanEntry, shared: SharedPlan[]) {
  return shared.filter(p => sameOffering(plan,p) && p.status !== "completed");
}
export function creditSummary(plans: PlanEntry[], statuses: PlanStatus[]) {
  const selected = plans.filter(p=>statuses.includes(p.status));
  return {known: selected.reduce((n,p)=>n+(p.credits??0),0), unknown:selected.filter(p=>p.credits===null).length};
}

// USYD general WAM guidance, checked 2026-11-02:
// https://www.sydney.edu.au/students/weighted-average-mark.html
// https://www.sydney.edu.au/students/weighted-average-mark/how-to-find-my-wam.html
// No grade-to-mark conversion, inferred passes, level weighting or best-attempt deduplication.
const NON_WAM_GRADES=new Set(["SR","FR","CN","DC","DF","IC","RI","UC","J2","WD","NE"]);
export function wamExclusion(plan:Pick<PlanEntry,"finalMark"|"finalGrade"|"credits"|"wamExcluded">) {
  if(plan.wamExcluded)return "Excluded by you";
  const grade=plan.finalGrade?.trim().toUpperCase();
  if(grade&&NON_WAM_GRADES.has(grade))return `${grade} is excluded from standard WAM`;
  if(typeof plan.finalMark!=="number"||!Number.isFinite(plan.finalMark)||plan.finalMark<0||plan.finalMark>100)return "No numeric final mark";
  if(plan.credits===null)return "Credit points not entered";
  if(!Number.isFinite(plan.credits)||plan.credits<=0)return "No positive credit points";
  return null;
}
export function wamSummary(plans:PlanEntry[]) {
  const included=plans.filter(p=>!wamExclusion(p));
  const credits=included.reduce((sum,p)=>sum+p.credits!,0);
  const points=included.reduce((sum,p)=>sum+p.finalMark!*p.credits!,0);
  const excluded=plans.filter(p=>p.finalMark!==null||p.finalGrade||p.status==="completed")
    .flatMap(p=>{const reason=wamExclusion(p);return reason?[{id:p.id,code:p.code,year:p.year,session:p.session,reason}]:[];});
  return {average:credits?points/credits:null,included:included.length,credits,excluded};
}
