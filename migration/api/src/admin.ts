import {ApiError} from "./auth.ts";
import {invitationHash} from "./access.ts";
import {growthPresets,growthStage,parseGrowthPolicy,readPublishedPolicy,type GrowthPolicy} from "./growth-policy.ts";
import type {SqlDatabase} from "./store.ts";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const channels=["society","organic_social","paid_social","partner","direct","other"] as const;
const now=()=>new Date().toISOString();
const resultChanges=(value:unknown)=>Number((value as {meta?:{changes?:number}})?.meta?.changes??0);
const text=(value:unknown,name:string,max=80,pattern=/^[A-Za-z0-9 ._&:/-]+$/)=>{
  const result=typeof value==="string"?value.trim():"";
  if(!result||result.length>max||!pattern.test(result))throw new ApiError(400,"admin_input_invalid",`${name} is invalid.`);
  return result;
};
const optionalText=(value:unknown,name:string,max=80)=>value===null||value===undefined||value===""?null:text(value,name,max);
const integer=(value:unknown,name:string,min:number,max:number)=>{
  if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new ApiError(400,"admin_input_invalid",`${name} is outside the supported range.`);
  return Number(value);
};
const exact=(body:Record<string,unknown>,allowed:string[])=>{
  if(Object.keys(body).some(key=>!allowed.includes(key)))throw new ApiError(400,"admin_input_invalid","The admin request contains unsupported fields.");
};
const token=()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
};
const link=(base:string,value:string)=>`${base.replace(/\/$/,"")}/#invite=${value}`;
const audit=(db:SqlDatabase,adminId:string,action:string,targetType:string,targetId:string|null,before:unknown,after:unknown,timestamp:string,result="success")=>
  db.prepare(`INSERT INTO admin_audit_log(id,admin_account_id,action,target_type,target_id,before_json,after_json,result,created_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(crypto.randomUUID(),adminId,action,targetType,targetId,
      before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after),result,timestamp);
const auditIf=(db:SqlDatabase,adminId:string,action:string,targetType:string,targetId:string|null,before:unknown,after:unknown,timestamp:string,
  predicate:string,predicateValues:(string|number|null)[])=>db.prepare(`INSERT INTO admin_audit_log
    (id,admin_account_id,action,target_type,target_id,before_json,after_json,result,created_at)
    SELECT ?1,?2,?3,?4,?5,?6,?7,'success',?8 WHERE ${predicate}`).bind(crypto.randomUUID(),adminId,action,targetType,targetId,
      before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after),timestamp,...predicateValues);

export async function requireAdmin(db:SqlDatabase,accountId:string) {
  const row=await db.prepare("SELECT role FROM admin_roles WHERE account_id=?1 AND revoked_at IS NULL")
    .bind(accountId).first<{role:"owner"|"admin"}>();
  if(!row)throw new ApiError(403,"admin_required","Administrator access is required.");
  return row;
}

async function policyView(db:SqlDatabase) {
  const state=await db.prepare(`SELECT s.published_version,s.draft_stage,s.draft_policy_json,s.draft_revision,s.draft_updated_at,
      v.stage published_stage,v.policy_json published_policy_json,v.published_at
    FROM growth_policy_state s JOIN growth_policy_versions v ON v.version=s.published_version WHERE s.id=1`)
    .first<{published_version:number;draft_stage:string;draft_policy_json:string;draft_revision:number;draft_updated_at:string;
      published_stage:string;published_policy_json:string;published_at:string}>();
  if(!state)throw new ApiError(503,"policy_unavailable","Growth policy is not configured.");
  const draft=parseGrowthPolicy(JSON.parse(state.draft_policy_json)),published=parseGrowthPolicy(JSON.parse(state.published_policy_json));
  return {published:{version:state.published_version,stage:state.published_stage,policy:published,publishedAt:state.published_at},
    draft:{revision:state.draft_revision,stage:state.draft_stage,policy:draft,updatedAt:state.draft_updated_at},
    hasDraft:state.draft_stage!==state.published_stage||JSON.stringify(draft)!==JSON.stringify(published),presets:growthPresets};
}

export async function adminSession(db:SqlDatabase,accountId:string) {
  const {role}=await requireAdmin(db,accountId);
  return {admin:true,role};
}

export async function readAdminDashboard(db:SqlDatabase,accountId:string) {
  const {role}=await requireAdmin(db,accountId),timestamp=now();
  const [policy,counts,invitations,campaigns,distributionLinks,users,auditRows]=await Promise.all([
    policyView(db),
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM account_access WHERE state='active') enrolled,
      (SELECT COUNT(*) FROM account_access WHERE state='suspended') suspended,
      (SELECT COUNT(*) FROM pilot_accounts a LEFT JOIN account_access x ON x.account_id=a.id WHERE x.account_id IS NULL) pending,
      (SELECT COUNT(*) FROM access_invitations WHERE revoked_at IS NULL AND expires_at>?1 AND redemption_count<max_redemptions) active_invitations,
      (SELECT COUNT(*) FROM growth_campaigns c WHERE c.revoked_at IS NULL AND c.redemption_count<c.max_redemptions AND EXISTS(
        SELECT 1 FROM invitation_contexts x JOIN access_invitations i ON i.id=x.invitation_id
        WHERE x.campaign_id=c.id AND i.revoked_at IS NULL AND i.expires_at>?1 AND i.redemption_count<i.max_redemptions)) active_campaigns`)
      .bind(timestamp).first<Record<string,number>>(),
    db.prepare(`SELECT i.id,i.kind,i.label,i.max_redemptions,i.redemption_count,i.expires_at,i.revoked_at,i.created_at,
      c.campaign_key,p.display_name inviter_name,l.label distribution_label,l.channel,l.source,l.format,l.placement,l.creative_id
      FROM access_invitations i LEFT JOIN invitation_contexts x ON x.invitation_id=i.id
      LEFT JOIN growth_campaigns c ON c.id=x.campaign_id LEFT JOIN friend_profiles p ON p.account_id=x.inviter_account_id
      LEFT JOIN campaign_distribution_links l ON l.invitation_id=i.id ORDER BY i.created_at DESC LIMIT 200`).all<Record<string,unknown>>(),
    db.prepare(`SELECT id,campaign_key,name,society_id,starts_at,max_redemptions,redemption_count,revoked_at,created_at,updated_at
      FROM growth_campaigns ORDER BY created_at DESC LIMIT 100`).all<Record<string,unknown>>(),
    db.prepare(`SELECT l.invitation_id,l.campaign_id,l.label,l.channel,l.source,l.format,l.placement,l.creative_id,l.created_at,
      i.max_redemptions,i.redemption_count,i.expires_at,i.revoked_at
      FROM campaign_distribution_links l JOIN access_invitations i ON i.id=l.invitation_id
      ORDER BY l.created_at DESC LIMIT 300`).all<Record<string,unknown>>(),
    db.prepare(`SELECT a.id account_id,a.created_at,x.state,x.source,x.enrolled_at,x.updated_at,
      t.direct_channel,t.acquired_at,i.label acquisition_label,c.campaign_key,rp.display_name referrer_name,ar.role admin_role
      FROM pilot_accounts a LEFT JOIN account_access x ON x.account_id=a.id
      LEFT JOIN account_attribution t ON t.account_id=a.id LEFT JOIN growth_campaigns c ON c.id=t.campaign_id
      LEFT JOIN access_invitations i ON i.id=t.acquisition_invitation_id
      LEFT JOIN friend_profiles rp ON rp.account_id=t.referrer_account_id LEFT JOIN admin_roles ar ON ar.account_id=a.id AND ar.revoked_at IS NULL
      ORDER BY COALESCE(x.enrolled_at,a.created_at) DESC LIMIT 200`).all<Record<string,unknown>>(),
    db.prepare(`SELECT id,admin_account_id,action,target_type,target_id,before_json,after_json,result,created_at
      FROM admin_audit_log ORDER BY created_at DESC LIMIT 200`).all<Record<string,unknown>>(),
  ]);
  const invitationList=invitations.results.map(row=>({...row,status:row.revoked_at?"revoked":String(row.expires_at)<=timestamp?"expired":
    Number(row.redemption_count)>=Number(row.max_redemptions)?"exhausted":"active",recoverableLink:false}));
  const linksByCampaign=new Map<string,Record<string,unknown>[]>();
  for(const item of distributionLinks.results){const key=String(item.campaign_id),items=linksByCampaign.get(key)??[];items.push(item);linksByCampaign.set(key,items);}
  const campaignList=campaigns.results.map(row=>{const links=linksByCampaign.get(String(row.id))??[];
    const active=links.some(item=>!item.revoked_at&&String(item.expires_at)>timestamp&&Number(item.redemption_count)<Number(item.max_redemptions));
    const status=row.revoked_at?"revoked":Number(row.redemption_count)>=Number(row.max_redemptions)?"exhausted":active?"active":"expired";
    return {...row,status,links};});
  return {session:{admin:true,role},overview:{enrolled:Number(counts?.enrolled??0),suspended:Number(counts?.suspended??0),
      pending:Number(counts?.pending??0),activeInvitations:Number(counts?.active_invitations??0),activeCampaigns:Number(counts?.active_campaigns??0)},
    policy,invitations:invitationList,campaigns:campaignList,
    users:users.results.map(row=>({...row,account_ref:String(row.account_id).slice(0,8)})),
    audit:auditRows.results.map(row=>({...row,before:row.before_json?JSON.parse(String(row.before_json)):null,
      after:row.after_json?JSON.parse(String(row.after_json)):null,before_json:undefined,after_json:undefined})),
    analytics:{implemented:false,stage:"Stage 4",message:"Activation, retention, conversion tables and decision insights are not yet instrumented."}};
}

export async function savePolicyDraft(db:SqlDatabase,adminId:string,body:Record<string,unknown>) {
  exact(body,["stage","policy","expectedRevision"]);const stage=growthStage(body.stage),policy=parseGrowthPolicy(body.policy);
  const expected=integer(body.expectedRevision,"Draft revision",1,1_000_000),timestamp=now(),json=JSON.stringify(policy);
  const results=await db.batch([
    db.prepare(`UPDATE growth_policy_state SET draft_stage=?1,draft_policy_json=?2,draft_revision=draft_revision+1,
      draft_updated_by_account_id=?3,draft_updated_at=?4 WHERE id=1 AND draft_revision=?5`).bind(stage,json,adminId,timestamp,expected),
    auditIf(db,adminId,"policy.draft_saved","growth_policy","draft",{revision:expected},{revision:expected+1,stage,policy},timestamp,
      "EXISTS(SELECT 1 FROM growth_policy_state WHERE id=1 AND draft_revision=?9 AND draft_updated_by_account_id=?10 AND draft_updated_at=?11)",[expected+1,adminId,timestamp]),
  ]);
  if(!resultChanges(results[0]))throw new ApiError(409,"revision_conflict","The draft changed in another admin session. Refresh before editing again.");
  return policyView(db);
}

export async function publishPolicy(db:SqlDatabase,adminId:string,body:Record<string,unknown>) {
  exact(body,["expectedDraftRevision","expectedPublishedVersion","confirm"]);
  if(body.confirm!==true)throw new ApiError(400,"publish_confirmation_required","Review and explicitly confirm the policy before publishing.");
  const draftRevision=integer(body.expectedDraftRevision,"Draft revision",1,1_000_000),publishedVersion=integer(body.expectedPublishedVersion,"Published version",1,1_000_000);
  const current=await policyView(db);
  if(current.draft.revision!==draftRevision||current.published.version!==publishedVersion)
    throw new ApiError(409,"revision_conflict","The policy changed in another admin session. Refresh before publishing.");
  parseGrowthPolicy(current.draft.policy);const next=publishedVersion+1,timestamp=now();
  const results=await db.batch([
    db.prepare(`INSERT INTO growth_policy_versions(version,stage,policy_json,published_by_account_id,published_at)
      SELECT ?1,draft_stage,draft_policy_json,?2,?3 FROM growth_policy_state
      WHERE id=1 AND published_version=?4 AND draft_revision=?5`).bind(next,adminId,timestamp,publishedVersion,draftRevision),
    db.prepare(`UPDATE growth_policy_state SET published_version=?1,draft_revision=draft_revision+1,
      draft_updated_by_account_id=?2,draft_updated_at=?3 WHERE id=1 AND published_version=?4 AND draft_revision=?5`)
      .bind(next,adminId,timestamp,publishedVersion,draftRevision),
    auditIf(db,adminId,"policy.published","growth_policy",String(next),current.published,{version:next,stage:current.draft.stage,policy:current.draft.policy},timestamp,
      "EXISTS(SELECT 1 FROM growth_policy_versions WHERE version=?9 AND published_by_account_id=?10 AND published_at=?11)",[next,adminId,timestamp]),
  ]);
  if(!resultChanges(results[0])||!resultChanges(results[1]))throw new ApiError(409,"revision_conflict","The policy changed in another admin session. Refresh before publishing.");
  return policyView(db);
}

async function adminRateLimit(db:SqlDatabase,accountId:string,action:string,max:number) {
  const epoch=Math.floor(Date.now()/1000),window=Math.floor(epoch/3600)*3600;
  const row=await db.prepare(`INSERT INTO friend_rate_limits(account_id,action,window_start,count) VALUES (?1,?2,?3,1)
    ON CONFLICT(account_id,action) DO UPDATE SET window_start=excluded.window_start,
    count=CASE WHEN friend_rate_limits.window_start!=excluded.window_start THEN 1 ELSE friend_rate_limits.count+1 END
    WHERE friend_rate_limits.window_start!=excluded.window_start OR friend_rate_limits.count<?4 RETURNING count`)
    .bind(accountId,action,window,max).first();
  if(!row)throw new ApiError(429,"admin_rate_limited","Too many admin creation requests. Try again later.");
}

export async function createPrivateInvitation(db:SqlDatabase,adminId:string,baseUrl:string,body:Record<string,unknown>) {
  exact(body,["label","expiryHours","maxRedemptions"]);const {policy}=await readPublishedPolicy(db);
  if(!policy.allowPrivateInvitations)throw new ApiError(403,"enrolment_channel_disabled","Private invitations are disabled by the published policy.");
  await adminRateLimit(db,adminId,"admin_private_invitation",policy.privateInvitationsPerHour);
  const label=text(body.label,"Invitation label"),hours=integer(body.expiryHours,"Expiry",1,2160),max=integer(body.maxRedemptions,"Redemption cap",1,policy.privateInvitationMaxRedemptions);
  const raw=token(),id=crypto.randomUUID(),timestamp=now(),expiresAt=new Date(Date.now()+hours*3_600_000).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
      VALUES (?1,'private',?2,?3,?4,0,?5,?6)`).bind(id,await invitationHash(raw),label,max,expiresAt,timestamp),
    audit(db,adminId,"invitation.created","invitation",id,null,{kind:"private",label,maxRedemptions:max,expiresAt},timestamp),
  ]);
  return {id,url:link(baseUrl,raw),expiresAt,maxRedemptions:max,shownOnce:true};
}

type LinkInput={label:string;channel:typeof channels[number];source:string;format:string|null;placement:string|null;creativeId:string|null;maxRedemptions:number;expiryHours:number};
function distributionInput(raw:unknown,maxCap:number):LinkInput {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new ApiError(400,"admin_input_invalid","Provide distribution-link details.");
  const body=raw as Record<string,unknown>;exact(body,["label","channel","source","format","placement","creativeId","maxRedemptions","expiryHours"]);
  if(!channels.includes(body.channel as typeof channels[number]))throw new ApiError(400,"admin_input_invalid","Choose a supported acquisition channel.");
  return {label:text(body.label,"Link label"),channel:body.channel as typeof channels[number],source:text(body.source,"Source"),
    format:optionalText(body.format,"Format"),placement:optionalText(body.placement,"Placement"),creativeId:optionalText(body.creativeId,"Creative ID"),
    maxRedemptions:integer(body.maxRedemptions,"Link redemption cap",1,maxCap),expiryHours:integer(body.expiryHours,"Link expiry",1,2160)};
}

export async function createCampaign(db:SqlDatabase,adminId:string,baseUrl:string,body:Record<string,unknown>) {
  exact(body,["key","name","societyId","startsAt","maxRedemptions","distribution"]);const {policy}=await readPublishedPolicy(db);
  if(!policy.allowCampaignEnrolment)throw new ApiError(403,"enrolment_channel_disabled","Campaign enrolment is disabled by the published policy.");
  const key=text(body.key,"Campaign key",40,/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/),name=text(body.name,"Campaign name"),societyId=optionalText(body.societyId,"Society identifier");
  const campaignMax=integer(body.maxRedemptions,"Campaign cap",1,policy.campaignMaxRedemptions),distribution=distributionInput(body.distribution,campaignMax);
  const startsAt=body.startsAt===null||body.startsAt===""?null:String(body.startsAt);
  if(startsAt!==null&&!Number.isFinite(Date.parse(startsAt)))throw new ApiError(400,"admin_input_invalid","Campaign start time is invalid.");
  const id=crypto.randomUUID(),invitationId=crypto.randomUUID(),raw=token(),timestamp=now(),expiresAt=new Date(Date.now()+distribution.expiryHours*3_600_000).toISOString();
  const hash=await invitationHash(raw);
  await db.batch([
    db.prepare(`INSERT INTO growth_campaigns(id,campaign_key,name,channel,created_at,society_id,starts_at,max_redemptions,redemption_count,updated_at)
      VALUES (?1,?2,?3,'society',?4,?5,?6,?7,0,?4)`).bind(id,key,name,timestamp,societyId,startsAt,campaignMax),
    db.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
      VALUES (?1,'campaign',?2,?3,?4,0,?5,?6)`).bind(invitationId,hash,distribution.label,distribution.maxRedemptions,expiresAt,timestamp),
    db.prepare("INSERT INTO invitation_contexts(invitation_id,campaign_id) VALUES (?1,?2)").bind(invitationId,id),
    db.prepare(`INSERT INTO campaign_distribution_links(invitation_id,campaign_id,label,channel,source,format,placement,creative_id,created_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(invitationId,id,distribution.label,distribution.channel,distribution.source,distribution.format,distribution.placement,distribution.creativeId,timestamp),
    audit(db,adminId,"campaign.created","campaign",id,null,{key,name,societyId,startsAt,maxRedemptions:campaignMax,distribution:{...distribution,invitationId,expiresAt}},timestamp),
  ]);
  return {campaignId:id,invitationId,url:link(baseUrl,raw),expiresAt,shownOnce:true};
}

export async function createCampaignLink(db:SqlDatabase,adminId:string,baseUrl:string,body:Record<string,unknown>) {
  exact(body,["campaignId","distribution"]);if(typeof body.campaignId!=="string"||!uuid.test(body.campaignId))throw new ApiError(400,"admin_input_invalid","Campaign is invalid.");
  const {policy}=await readPublishedPolicy(db);if(!policy.allowCampaignEnrolment)throw new ApiError(403,"enrolment_channel_disabled","Campaign enrolment is disabled.");
  const campaign=await db.prepare("SELECT id,max_redemptions,redemption_count,revoked_at FROM growth_campaigns WHERE id=?1").bind(body.campaignId)
    .first<{id:string;max_redemptions:number;redemption_count:number;revoked_at:string|null}>();
  if(!campaign||campaign.revoked_at)throw new ApiError(404,"campaign_unavailable","This campaign is unavailable.");
  const remaining=campaign.max_redemptions-campaign.redemption_count;
  if(remaining<1)throw new ApiError(409,"invitation_exhausted","This campaign has reached its enrolment limit.");
  const distribution=distributionInput(body.distribution,Math.min(policy.campaignMaxRedemptions,remaining));
  const invitationId=crypto.randomUUID(),raw=token(),timestamp=now(),expiresAt=new Date(Date.now()+distribution.expiryHours*3_600_000).toISOString(),hash=await invitationHash(raw);
  await db.batch([
    db.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
      VALUES (?1,'campaign',?2,?3,?4,0,?5,?6)`).bind(invitationId,hash,distribution.label,distribution.maxRedemptions,expiresAt,timestamp),
    db.prepare("INSERT INTO invitation_contexts(invitation_id,campaign_id) VALUES (?1,?2)").bind(invitationId,campaign.id),
    db.prepare(`INSERT INTO campaign_distribution_links(invitation_id,campaign_id,label,channel,source,format,placement,creative_id,created_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(invitationId,campaign.id,distribution.label,distribution.channel,distribution.source,distribution.format,distribution.placement,distribution.creativeId,timestamp),
    audit(db,adminId,"campaign_link.created","invitation",invitationId,null,{campaignId:campaign.id,...distribution,expiresAt},timestamp),
  ]);
  return {campaignId:campaign.id,invitationId,url:link(baseUrl,raw),expiresAt,shownOnce:true};
}

export async function revokeAdminInvitation(db:SqlDatabase,adminId:string,body:Record<string,unknown>) {
  exact(body,["id"]);if(typeof body.id!=="string"||!uuid.test(body.id))throw new ApiError(400,"admin_input_invalid","Invitation is invalid.");
  const before=await db.prepare("SELECT id,kind,label,revoked_at FROM access_invitations WHERE id=?1").bind(body.id).first<Record<string,unknown>>();
  if(!before)throw new ApiError(404,"invitation_invalid","Invitation not found.");const timestamp=now();
  const results=await db.batch([
    db.prepare("UPDATE access_invitations SET revoked_at=?2 WHERE id=?1 AND revoked_at IS NULL").bind(body.id,timestamp),
    auditIf(db,adminId,"invitation.revoked","invitation",body.id,before,{...before,revoked_at:timestamp},timestamp,
      "EXISTS(SELECT 1 FROM access_invitations WHERE id=?9 AND revoked_at=?10)",[body.id,timestamp]),
  ]);
  return {revoked:resultChanges(results[0])>0};
}

export async function revokeCampaign(db:SqlDatabase,adminId:string,body:Record<string,unknown>) {
  exact(body,["id"]);if(typeof body.id!=="string"||!uuid.test(body.id))throw new ApiError(400,"admin_input_invalid","Campaign is invalid.");
  const before=await db.prepare("SELECT id,campaign_key,name,revoked_at FROM growth_campaigns WHERE id=?1").bind(body.id).first<Record<string,unknown>>();
  if(!before)throw new ApiError(404,"campaign_unavailable","Campaign not found.");const timestamp=now();
  const results=await db.batch([
    db.prepare("UPDATE growth_campaigns SET revoked_at=?2,updated_at=?2 WHERE id=?1 AND revoked_at IS NULL").bind(body.id,timestamp),
    db.prepare(`UPDATE access_invitations SET revoked_at=?2 WHERE id IN
      (SELECT invitation_id FROM invitation_contexts WHERE campaign_id=?1) AND revoked_at IS NULL`).bind(body.id,timestamp),
    auditIf(db,adminId,"campaign.revoked","campaign",body.id,before,{...before,revoked_at:timestamp},timestamp,
      "EXISTS(SELECT 1 FROM growth_campaigns WHERE id=?9 AND revoked_at=?10)",[body.id,timestamp]),
  ]);
  return {revoked:resultChanges(results[0])>0};
}

export async function changeAccountAccess(db:SqlDatabase,adminId:string,body:Record<string,unknown>) {
  exact(body,["accountId","operation","expectedUpdatedAt"]);if(typeof body.accountId!=="string"||!uuid.test(body.accountId)||body.accountId===adminId)
    throw new ApiError(400,"admin_input_invalid","Choose another valid account.");
  if(!["suspend","restore"].includes(String(body.operation))||typeof body.expectedUpdatedAt!=="string")throw new ApiError(400,"admin_input_invalid","Access action is invalid.");
  const protectedRole=await db.prepare("SELECT 1 ok FROM admin_roles WHERE account_id=?1 AND revoked_at IS NULL").bind(body.accountId).first();
  if(protectedRole)throw new ApiError(403,"admin_target_protected","Administrator access must be changed through the operator procedure.");
  const before=await db.prepare("SELECT state,source,enrolled_at,updated_at FROM account_access WHERE account_id=?1").bind(body.accountId).first<Record<string,unknown>>();
  if(!before)throw new ApiError(404,"account_access_missing","This account has no Semester enrolment.");
  const from=body.operation==="suspend"?"active":"suspended",to=body.operation==="suspend"?"suspended":"active",timestamp=now();
  const results=await db.batch([
    db.prepare("UPDATE account_access SET state=?1,updated_at=?2 WHERE account_id=?3 AND state=?4 AND updated_at=?5")
      .bind(to,timestamp,body.accountId,from,body.expectedUpdatedAt),
    auditIf(db,adminId,body.operation==="suspend"?"account.suspended":"account.restored","account",body.accountId,before,{...before,state:to,updated_at:timestamp},timestamp,
      "EXISTS(SELECT 1 FROM account_access WHERE account_id=?9 AND state=?10 AND updated_at=?11)",[body.accountId,to,timestamp]),
  ]);
  if(!resultChanges(results[0]))throw new ApiError(409,"revision_conflict","This account access changed. Refresh before trying again.");
  return {accountId:body.accountId,state:to,updatedAt:timestamp};
}
