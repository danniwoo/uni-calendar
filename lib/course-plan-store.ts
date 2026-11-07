import {PlanError, planDraft, type CoursePlanData, type PlanEntry, type SharedPlan, type FriendsPage, type SharedPage, type SharedFilter} from "./course-plan";
import {invitationCode,type InvitePreview} from "./friend-invitation";

type PlanRow = Omit<PlanEntry,"updatedAt"|"finalMark"|"finalGrade"|"wamExcluded"> & {updated_at:string;final_mark:number|null;final_grade:string|null;wam_excluded:number};
type SharedPlanRow = Pick<PlanRow,"university"|"code"|"name"|"year"|"session"|"status"|"credits"|"updated_at"> & {cursor:string;friend_id:string;friend_name:string};
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
const FRIEND_PAGE_SIZE=50, SHARED_PAGE_SIZE=100;
type RelationRow={id:string;connection_id:string;name:string;requester:string;status:string;blocked_by:string|null;revision:number;rank:number};
const rankSql="CASE WHEN f.status='pending' AND f.requester!=? THEN 0 WHEN f.status='accepted' THEN 1 WHEN f.status='pending' THEN 2 ELSE 3 END";
export async function readFriends(db:D1Database,owner:string,after=""):Promise<FriendsPage> {
  if(after&&!/^[0-3]:[a-f0-9-]{36}$/.test(after))throw new PlanError("Invalid friends page. Refresh the list.");
  const rank=after?Number(after[0]):-1,cursor=after.slice(2);
  const rows=await db.prepare(`SELECT * FROM (SELECT p.id,p.name,f.id AS connection_id,f.requester,f.status,f.blocked_by,f.revision,${rankSql} AS rank FROM friendships f JOIN friend_profiles p ON p.owner=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND f.status!='blocked') WHERE rank>? OR (rank=? AND connection_id>?) ORDER BY rank,connection_id LIMIT ?`).bind(owner,owner,owner,owner,rank,rank,cursor,FRIEND_PAGE_SIZE+1).all<RelationRow>();
  const page=rows.results.slice(0,FRIEND_PAGE_SIZE),last=page.at(-1);
  return {friends:page.map(r=>({id:r.id,connectionId:r.connection_id,name:r.name,revision:r.revision,state:r.status==="pending"?(r.requester===owner?"outgoing":"incoming"):r.status as "accepted"|"blocked"})),friendsNext:rows.results.length>FRIEND_PAGE_SIZE&&last?`${last.rank}:${last.connection_id}`:null};
}
export async function readSharedPlans(db:D1Database,owner:string,filter:SharedFilter={},after=""):Promise<SharedPage> {
  if(after&&!/^[a-f0-9-]{36}$/.test(after))throw new PlanError("Invalid units page. Refresh the list.");
  const where:string[]=[],values:(string|number)[]=[];
  if(filter.year!==undefined){where.push("c.year=?");values.push(filter.year);}
  if(filter.session){where.push("c.session=?");values.push(filter.session);}
  if(filter.friend){where.push("p.id=?");values.push(filter.friend);}
  if(filter.code){where.push("c.code=? AND c.status!='completed'");values.push(filter.code);}
  const rows=await db.prepare(`SELECT c.id AS cursor,c.university,c.code,c.name,c.year,c.session,c.status,c.credits,c.updated_at,p.id AS friend_id,p.name AS friend_name FROM friendships f JOIN course_plans c ON c.owner=CASE WHEN f.a=? THEN f.b ELSE f.a END JOIN friend_profiles p ON p.owner=c.owner WHERE (f.a=? OR f.b=?) AND f.status='accepted' AND p.sharing=1 AND c.id>? ${where.length?"AND "+where.join(" AND "):""} ORDER BY c.id LIMIT ?`).bind(owner,owner,owner,after,...values,SHARED_PAGE_SIZE+1).all<SharedPlanRow>();
  const page=rows.results.slice(0,SHARED_PAGE_SIZE);
  return {sharedPlans:page.map(r=>({university:r.university,code:r.code,name:r.name,year:r.year,session:r.session,status:r.status,credits:r.credits,updatedAt:r.updated_at,friendId:r.friend_id,friendName:r.friend_name} satisfies SharedPlan)),sharedNext:rows.results.length>SHARED_PAGE_SIZE?page.at(-1)!.cursor:null};
}
export async function readCoursePlan(db:D1Database, owner:string,filter:SharedFilter={}):Promise<CoursePlanData> {
  const [profile,plans,relations,shared,invite,counts] = await Promise.all([
    db.prepare("SELECT id, name, sharing, revision FROM friend_profiles WHERE owner = ?").bind(owner).first<{id:string;name:string;sharing:number;revision:number}>(),
    db.prepare("SELECT * FROM course_plans WHERE owner = ? ORDER BY year, session, code").bind(owner).all<PlanRow>(),
    readFriends(db,owner),readSharedPlans(db,owner,filter),
    db.prepare("SELECT code_hash,expires_at,revoked_at,revision FROM friend_invites WHERE owner=?").bind(owner).first<{code_hash:string;expires_at:string;revoked_at:string|null;revision:number}>(),
    db.prepare("SELECT SUM(CASE WHEN status='pending' AND requester!=? THEN 1 ELSE 0 END) AS incoming,SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) AS accepted FROM friendships WHERE a=? OR b=?").bind(owner,owner,owner).first<{incoming:number;accepted:number}>(),
  ]);
  return {profile:profile?{...profile,sharing:!!profile.sharing}:null,plans:plans.results.map(entry),...relations,...shared,incomingCount:counts?.incoming??0,friendCount:counts?.accepted??0,invitation:invite?{state:invite.revoked_at?"revoked":invite.expires_at>new Date().toISOString()?"active":"expired",expiresAt:invite.expires_at,revision:invite.revision,fingerprint:invite.code_hash.slice(0,16)}:{state:"none",expiresAt:null,revision:0,fingerprint:null}};
}
async function rateLimit(db:D1Database,owner:string,action:string) {
  const limits:Record<string,[number,number]>={"preview-invite":[30,600],"create-invite":[5,3600],"request-friend":[20,3600]};
  if(!Object.hasOwn(limits,action))return;
  const limit=limits[action];
  const [max,seconds]=limit,now=Math.floor(Date.now()/1000),window=Math.floor(now/seconds)*seconds;
  const row=await db.prepare("INSERT INTO friend_rate_limits (owner,action,window_start,count) VALUES (?,?,?,1) ON CONFLICT(owner,action) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN friend_rate_limits.window_start!=excluded.window_start THEN 1 ELSE friend_rate_limits.count+1 END WHERE friend_rate_limits.window_start!=excluded.window_start OR friend_rate_limits.count<? RETURNING count").bind(owner,action,window,max).first();
  if(!row)throw new PlanError("Too many invitation attempts. Please try again later.",429,window+seconds-now);
}

export async function changeCoursePlan(db:D1Database, owner:string, raw:unknown):Promise<{message:string;inviteCode?:string;expiresAt?:string;invitePreview?:InvitePreview;inviteRevision?:number;inviteFingerprint?:string}> {
  if (!raw||typeof raw!=="object"||Array.isArray(raw)) throw new PlanError("Invalid request.");
  const body=raw as Record<string,unknown>, now=new Date().toISOString();
  await rateLimit(db,owner,String(body.action));
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
    const invite=await db.prepare("SELECT i.owner,p.name FROM friend_invites i JOIN friend_profiles p ON p.owner=i.owner WHERE i.code_hash=? AND i.expires_at>? AND i.revoked_at IS NULL").bind(await hash(code),now).first<{owner:string;name:string}>();
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
    const codeHash=await hash(code);
    const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
    const invite=await db.prepare("INSERT INTO friend_invites (owner,code_hash,expires_at) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, revoked_at=NULL, revision=friend_invites.revision+1 RETURNING revision").bind(owner,codeHash,expiresAt).first<{revision:number}>();
    return {message:"Invite ready to share.",inviteCode:code,expiresAt,inviteRevision:invite!.revision,inviteFingerprint:codeHash.slice(0,16)};
  }
  if(body.action==="revoke-invite") {
    await db.prepare("UPDATE friend_invites SET revoked_at=?,revision=revision+1 WHERE owner=? AND revoked_at IS NULL").bind(now,owner).run();
    return {message:"Invitation code revoked. Existing requests are unchanged."};
  }
  if(body.action==="request-friend") {
    const code=typeof body.code==="string"?invitationCode(body.code):null;
    if(!code)throw new PlanError("Enter the full invitation link or code.");
    const codeHash=await hash(code);
    const invite=await db.prepare("SELECT owner FROM friend_invites WHERE code_hash=? AND expires_at>? AND revoked_at IS NULL").bind(codeHash,now).first<{owner:string}>();
    if(!invite||invite.owner===owner)throw new PlanError("This code is unavailable. Ask your friend for a new code.");
    const [a,b]=pair(owner,invite.owner);
    // Recheck expiration/revocation inside the write; a blocked pair cannot be recreated.
    const result=await db.prepare("INSERT INTO friendships (id,a,b,requester,status,revision) SELECT ?,?,?,?,'pending',1 WHERE EXISTS (SELECT 1 FROM friend_invites WHERE owner=? AND code_hash=? AND expires_at>? AND revoked_at IS NULL) AND (SELECT COUNT(*) FROM friendships WHERE requester=? AND status='pending')<20 AND (SELECT COUNT(*) FROM friendships WHERE (a=? OR b=?) AND requester!=? AND status='pending')<100 ON CONFLICT(a,b) DO NOTHING").bind(crypto.randomUUID(),a,b,owner,invite.owner,codeHash,now,owner,invite.owner,invite.owner,invite.owner).run();
    if(!result.meta.changes&&!await db.prepare("SELECT 1 FROM friendships WHERE a=? AND b=?").bind(a,b).first())throw new PlanError("Request unavailable. You can have up to 20 sent requests; your friend can have up to 100 incoming requests. Clear pending requests or ask for a fresh invitation.",409);
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
