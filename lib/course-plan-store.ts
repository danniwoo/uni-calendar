import {PlanError, planDraft, type CoursePlanData, type PlanEntry, type SharedPlan} from "./course-plan";
import {invitationCode,type InvitePreview} from "./friend-invitation";

type PlanRow = Omit<PlanEntry,"updatedAt"|"finalMark"|"finalGrade"|"wamExcluded"> & {updated_at:string;final_mark:number|null;final_grade:string|null;wam_excluded:number};
type SharedPlanRow = Pick<PlanRow,"university"|"code"|"name"|"year"|"session"|"status"|"credits"|"updated_at"> & {friend_id:string;friend_name:string};
type ProfileRow = {owner:string;id:string;name:string;revision:number};
type Relationship = {id:string;a:string;b:string;requester:string;status:string;blocked_by:string|null;revision:number};
const pair = (a:string,b:string) => [a,b].sort();
const stale = () => new PlanError("This record changed in another tab. Refresh and review it before saving again.",409);
function revision(value:unknown) {
  if (!Number.isInteger(value)||Number(value)<0) throw new PlanError("Refresh and try again.");
  return Number(value);
}
function id(value:unknown) {
  if (typeof value!=="string"||!/^[a-f0-9-]{36}$/.test(value)) throw new PlanError("Choose a valid record.");
  return value;
}
function entry(row:PlanRow):PlanEntry {
  return {id:row.id,university:row.university,code:row.code,name:row.name,year:row.year,session:row.session,status:row.status,credits:row.credits,finalMark:row.final_mark??null,finalGrade:row.final_grade??null,wamExcluded:!!row.wam_excluded,revision:row.revision,updatedAt:row.updated_at};
}
async function hash(code:string) {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
}
export async function readCoursePlan(db:D1Database, owner:string):Promise<CoursePlanData> {
  const [profile,plans,relations,shared] = await Promise.all([
    db.prepare("SELECT id, name, sharing, revision FROM friend_profiles WHERE owner = ?").bind(owner).first<{id:string;name:string;sharing:number;revision:number}>(),
    db.prepare("SELECT * FROM course_plans WHERE owner = ? ORDER BY year, session, code").bind(owner).all<PlanRow>(),
    db.prepare("SELECT p.id, p.name, f.id AS connection_id, f.requester, f.status, f.blocked_by, f.revision FROM friendships f JOIN friend_profiles p ON p.owner = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE (f.a = ? OR f.b = ?) AND (f.status != 'blocked' OR f.blocked_by = ?)").bind(owner,owner,owner,owner).all<{id:string;connection_id:string;name:string;requester:string;status:string;blocked_by:string|null;revision:number}>(),
    db.prepare("SELECT c.university, c.code, c.name, c.year, c.session, c.status, c.credits, c.updated_at, p.id AS friend_id, p.name AS friend_name FROM friendships f JOIN course_plans c ON c.owner = CASE WHEN f.a = ? THEN f.b ELSE f.a END JOIN friend_profiles p ON p.owner = c.owner WHERE (f.a = ? OR f.b = ?) AND f.status = 'accepted' AND p.sharing = 1 ORDER BY c.year, c.session, c.code, p.name").bind(owner,owner,owner).all<SharedPlanRow>(),
  ]);
  return {profile:profile?{...profile,sharing:!!profile.sharing}:null,plans:plans.results.map(entry),friends:relations.results.map(r=>({id:r.id,connectionId:r.connection_id,name:r.name,revision:r.revision,state:r.status==="pending"?(r.requester===owner?"outgoing":"incoming"):r.status as "accepted"|"blocked"})),sharedPlans:shared.results.map(r=>{
    return {university:r.university,code:r.code,name:r.name,year:r.year,session:r.session,status:r.status,credits:r.credits,updatedAt:r.updated_at,friendId:r.friend_id,friendName:r.friend_name} satisfies SharedPlan;
  })};
}

export async function changeCoursePlan(db:D1Database, owner:string, raw:unknown):Promise<{message:string;inviteCode?:string;expiresAt?:string;invitePreview?:InvitePreview}> {
  if (!raw||typeof raw!=="object"||Array.isArray(raw)) throw new PlanError("Invalid request.");
  const body=raw as Record<string,unknown>, now=new Date().toISOString();
  if (body.action==="save-plan") {
    const plan=planDraft(body.plan), expected=revision(body.revision);
    const planId=body.id===null?crypto.randomUUID():id(body.id);
    if (body.id===null && expected!==0 || body.id!==null && expected===0) throw stale();
    const duplicate=await db.prepare("SELECT id FROM course_plans WHERE owner = ? AND university = ? AND code = ? AND year = ? AND session = ? AND id != ?").bind(owner,plan.university,plan.code,plan.year,plan.session,planId).first();
    if (duplicate) throw new PlanError("This unit is already in that semester. Edit the existing entry.",409);
    let result:D1Result;
    try {
      if (body.id===null) {
        result=await db.prepare("INSERT INTO course_plans (id,owner,university,code,name,year,session,status,credits,final_mark,final_grade,wam_excluded,revision,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,1,? WHERE (SELECT COUNT(*) FROM course_plans WHERE owner = ?) < 240").bind(planId,owner,plan.university,plan.code,plan.name,plan.year,plan.session,plan.status,plan.credits,plan.finalMark,plan.finalGrade,Number(plan.wamExcluded),now,owner).run();
        if (!result.meta.changes) throw new PlanError("Your plan has reached the 240-entry limit.");
      } else {
        // Older clients omit private-result fields; preserve them unless explicitly supplied.
        const supplied=body.plan as Record<string,unknown>;
        result=await db.prepare("UPDATE course_plans SET university=?, code=?, name=?, year=?, session=?, status=?, credits=?, final_mark=CASE WHEN ? THEN ? ELSE final_mark END, final_grade=CASE WHEN ? THEN ? ELSE final_grade END, wam_excluded=CASE WHEN ? THEN ? ELSE wam_excluded END, updated_at=?, revision=revision+1 WHERE id=? AND owner=? AND revision=?").bind(plan.university,plan.code,plan.name,plan.year,plan.session,plan.status,plan.credits,Number(Object.hasOwn(supplied,"finalMark")),plan.finalMark,Number(Object.hasOwn(supplied,"finalGrade")),plan.finalGrade,Number(Object.hasOwn(supplied,"wamExcluded")),Number(plan.wamExcluded),now,planId,owner,expected).run();
        if (!result.meta.changes) throw stale();
      }
    } catch(error) {
      if(error instanceof PlanError) throw error;
      if(String(error).includes("UNIQUE constraint")) throw new PlanError("This unit was just added in another tab. Refresh your plan.",409);
      throw error;
    }
    return {message:"Unit saved."};
  }
  if(body.action==="delete-plan") {
    const result=await db.prepare("DELETE FROM course_plans WHERE id=? AND owner=? AND revision=?").bind(id(body.id),owner,revision(body.revision)).run();
    if(!result.meta.changes) throw stale();
    return {message:"Unit removed from your course plan."};
  }
  if(body.action==="save-profile") {
    const name=typeof body.name==="string"?body.name.trim():"";
    if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name)) throw new PlanError("Enter a display name of 1–60 characters.");
    if(typeof body.sharing!=="boolean")throw new PlanError("Choose all friends or private for your course plan.");
    const expected=revision(body.revision);
    const result=expected===0
      ? await db.prepare("INSERT INTO friend_profiles (owner,id,name,sharing,revision) VALUES (?,?,?,?,1) ON CONFLICT(owner) DO NOTHING").bind(owner,crypto.randomUUID(),name,Number(body.sharing)).run()
      : await db.prepare("UPDATE friend_profiles SET name=?,sharing=?,revision=revision+1 WHERE owner=? AND revision=?").bind(name,Number(body.sharing),owner,expected).run();
    if(!result.meta.changes)throw stale();
    return {message:body.sharing?"Profile saved. Your unit plans are shared with all accepted friends.":"Profile saved. Your course plan is private."};
  }
  if(body.action==="preview-invite") {
    const code=typeof body.code==="string"?invitationCode(body.code):null;
    if(!code)throw new PlanError("Enter a full invitation link or code.");
    const invite=await db.prepare("SELECT i.owner,p.name FROM friend_invites i JOIN friend_profiles p ON p.owner=i.owner WHERE i.code_hash=? AND i.expires_at>?").bind(await hash(code),now).first<{owner:string;name:string}>();
    if(!invite)throw new PlanError("This invitation has expired or been replaced. Ask your friend for a new link.");
    const [a,b]=pair(owner,invite.owner);
    const relation=await db.prepare("SELECT status,requester FROM friendships WHERE a=? AND b=?").bind(a,b).first<{status:string;requester:string}>();
    if(relation?.status==="blocked")throw new PlanError("This invitation is unavailable.");
    const state:InvitePreview["state"]=owner===invite.owner?"self":relation?.status==="accepted"?"accepted":relation?.status==="pending"?(relation.requester===owner?"outgoing":"incoming"):"available";
    return {message:"Invitation checked.",invitePreview:{name:invite.name,state}};
  }
  const profile=await db.prepare("SELECT owner,id,name,revision FROM friend_profiles WHERE owner=?").bind(owner).first<ProfileRow>();
  if(!profile)throw new PlanError("Save a display name before connecting with friends.");
  if(body.action==="create-invite") {
    const code=crypto.randomUUID().replaceAll("-","").toUpperCase();
    const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
    await db.prepare("INSERT INTO friend_invites (owner,code_hash,expires_at) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at").bind(owner,await hash(code),expiresAt).run();
    return {message:"Invitation created. Any previous code has expired.",inviteCode:code,expiresAt};
  }
  if(body.action==="revoke-invite") {
    await db.prepare("DELETE FROM friend_invites WHERE owner=?").bind(owner).run();
    return {message:"Invitation code revoked. Existing requests are unchanged."};
  }
  if(body.action==="request-friend") {
    const code=typeof body.code==="string"?invitationCode(body.code):null;
    if(!code)throw new PlanError("Enter the full invitation link or code.");
    const codeHash=await hash(code);
    const invite=await db.prepare("SELECT owner FROM friend_invites WHERE code_hash=? AND expires_at>?").bind(codeHash,now).first<{owner:string}>();
    if(!invite||invite.owner===owner)throw new PlanError("This code is unavailable. Ask your friend for a new code.");
    const [a,b]=pair(owner,invite.owner);
    // Recheck expiration/revocation inside the write; a blocked pair cannot be recreated.
    await db.prepare("INSERT INTO friendships (id,a,b,requester,status,revision) SELECT ?,?,?,?,'pending',1 WHERE EXISTS (SELECT 1 FROM friend_invites WHERE owner=? AND code_hash=? AND expires_at>?) ON CONFLICT(a,b) DO NOTHING").bind(crypto.randomUUID(),a,b,owner,invite.owner,codeHash,now).run();
    return {message:"Request submitted if available. Shared units appear after your friend accepts."};
  }
  if(body.action==="friend-action") {
    const peer=await db.prepare("SELECT owner FROM friend_profiles WHERE id=?").bind(id(body.friendId)).first<{owner:string}>();
    if(!peer||peer.owner===owner)throw new PlanError("This connection is unavailable.",404);
    const [a,b]=pair(owner,peer.owner), expected=revision(body.revision);
    const relation=await db.prepare("SELECT * FROM friendships WHERE a=? AND b=?").bind(a,b).first<Relationship>();
    if(!relation||relation.id!==id(body.connectionId)||relation.revision!==expected)throw stale();
    let result:D1Result;
    if(body.operation==="accept" && relation.status==="pending" && relation.requester!==owner) {
      result=await db.prepare("UPDATE friendships SET status='accepted',revision=revision+1 WHERE a=? AND b=? AND revision=? AND id=? AND status='pending' AND requester!=?").bind(a,b,expected,relation.id,owner).run();
    } else if(body.operation==="block" && relation.status!=="blocked") {
      result=await db.prepare("UPDATE friendships SET status='blocked',blocked_by=?,revision=revision+1 WHERE a=? AND b=? AND revision=? AND id=?").bind(owner,a,b,expected,relation.id).run();
    } else if(body.operation==="remove" && relation.status!=="blocked" || body.operation==="unblock" && relation.status==="blocked" && relation.blocked_by===owner) {
      result=await db.prepare("DELETE FROM friendships WHERE a=? AND b=? AND revision=? AND id=?").bind(a,b,expected,relation.id).run();
    } else throw new PlanError("This action is unavailable for this connection.",403);
    if(!result.meta.changes)throw stale();
    return {message:body.operation==="accept"?"Friend request accepted.":body.operation==="block"?"Friend blocked. Shared-unit access has been removed.":body.operation==="unblock"?"Unblocked. A new request is needed to reconnect.":"Connection removed. Shared-unit access has been removed."};
  }
  throw new PlanError("Unknown course-plan action.");
}
