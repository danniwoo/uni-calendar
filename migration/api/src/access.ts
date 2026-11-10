import {ApiError} from "./auth.ts";
import {requireNewEnrolmentPolicy} from "./growth-policy.ts";
import type {SqlDatabase} from "./store.ts";

export type AccessState = "none"|"active"|"suspended"|"deletion_pending"|"deleted";
export type AccessStatus = {state:AccessState; enrolled:boolean; source:string|null; enrolledAt:string|null};

const tokenPattern=/^[A-Za-z0-9_-]{43}$/;

export function invitationToken(value:unknown):string|null {
  return typeof value==="string" && tokenPattern.test(value) ? value : null;
}

export async function invitationHash(token:string):Promise<string> {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

type AccessRow={state:Exclude<AccessState,"none">;source:string;enrolled_at:string};

// backup_trial_members used to be the pilot allowlist. Lazily mirror it so an
// account added before this migration (or during a rollback window) is never
// locked out. An explicit non-active account_access row always wins.
export async function accessStatus(db:SqlDatabase,accountId:string):Promise<AccessStatus> {
  await db.prepare(`INSERT INTO account_access(account_id,state,source,invitation_id,enrolled_at,updated_at)
    SELECT account_id,'active','legacy_pilot',NULL,?2,?2 FROM backup_trial_members WHERE account_id=?1
    ON CONFLICT(account_id) DO NOTHING`).bind(accountId,new Date().toISOString()).run();
  await db.prepare(`INSERT INTO account_attribution(account_id,direct_channel,acquired_at)
    SELECT account_id,CASE source WHEN 'private_invitation' THEN 'private_invitation' ELSE 'legacy_pilot' END,enrolled_at
    FROM account_access WHERE account_id=?1 ON CONFLICT(account_id) DO NOTHING`).bind(accountId).run();
  const row=await db.prepare("SELECT state,source,enrolled_at FROM account_access WHERE account_id=?1")
    .bind(accountId).first<AccessRow>();
  return row ? {state:row.state,enrolled:row.state==="active",source:row.source,enrolledAt:row.enrolled_at}
    : {state:"none",enrolled:false,source:null,enrolledAt:null};
}

export async function requireAccess(db:SqlDatabase,accountId:string):Promise<AccessStatus> {
  const access=await accessStatus(db,accountId);
  if(access.state==="none")throw new ApiError(403,"invitation_required","A valid Semester invitation is required for this account.");
  if(access.state!=="active")throw new ApiError(403,"access_disabled","Semester access is currently disabled for this account.");
  return access;
}

type InvitationKind="private"|"campaign"|"friend_referral";
type InvitationRow={id:string;kind:InvitationKind;expires_at:string;revoked_at:string|null;max_redemptions:number;redemption_count:number;
  campaign_id:string|null;campaign_key:string|null;campaign_revoked_at:string|null;campaign_max_redemptions:number|null;
  campaign_redemption_count:number|null;inviter_account_id:string|null;inviter_name:string|null};

async function invitationRow(db:SqlDatabase,token:string) {
  return db.prepare(`SELECT i.id,i.kind,i.expires_at,i.revoked_at,i.max_redemptions,i.redemption_count,
      c.id AS campaign_id,c.campaign_key,c.revoked_at AS campaign_revoked_at,c.max_redemptions AS campaign_max_redemptions,
      c.redemption_count AS campaign_redemption_count,
      x.inviter_account_id,p.display_name AS inviter_name
    FROM access_invitations i
    LEFT JOIN invitation_contexts x ON x.invitation_id=i.id
    LEFT JOIN growth_campaigns c ON c.id=x.campaign_id
    LEFT JOIN friend_profiles p ON p.account_id=x.inviter_account_id
    WHERE i.token_hash=?1`).bind(await invitationHash(token)).first<InvitationRow>();
}

function invitationError(row:InvitationRow|null,now:string):ApiError|null {
  if(!row)return new ApiError(404,"invitation_invalid","This invitation link is not valid.");
  if(row.revoked_at||row.campaign_revoked_at)return new ApiError(410,"invitation_revoked","This invitation has been revoked.");
  if(row.expires_at<=now)return new ApiError(410,"invitation_expired","This invitation has expired.");
  if(row.kind==="campaign"&&(row.campaign_redemption_count??0)>=(row.campaign_max_redemptions??0))
    return new ApiError(409,"invitation_exhausted","This campaign has reached its enrolment limit.");
  // A full friend-referral acquisition quota still permits already-enrolled
  // students to request friendship; the authenticated redemption path decides.
  if(row.redemption_count>=row.max_redemptions&&row.kind!=="friend_referral")return new ApiError(409,"invitation_exhausted","This invitation has already been used.");
  if(row.kind==="campaign"&&!row.campaign_id||row.kind==="friend_referral"&&(!row.inviter_account_id||!row.inviter_name))
    return new ApiError(409,"invitation_unavailable","This invitation is not available.");
  return null;
}

export async function previewInvitation(db:SqlDatabase,raw:unknown) {
  const token=invitationToken(raw);
  if(!token)throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
  const now=new Date().toISOString(),row=await invitationRow(db,token),problem=invitationError(row,now);
  if(problem)throw problem;
  return {valid:true,kind:row!.kind,expiresAt:row!.expires_at,remaining:row!.max_redemptions-row!.redemption_count,
    ...(row!.kind==="friend_referral"?{referrer:{name:row!.inviter_name}}:{}),
    ...(row!.kind==="campaign"?{campaign:{key:row!.campaign_key}}:{})};
}

export async function redeemInvitation(db:SqlDatabase,accountId:string,raw:unknown) {
  const token=invitationToken(raw);
  if(!token)throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
  const now=new Date().toISOString();
  const current=await accessStatus(db,accountId);
  const invitation=await invitationRow(db,token),problem=invitationError(invitation,now);
  if(problem&&!(current.state==="active"&&problem.code==="invitation_exhausted"))throw problem;
  if(invitation!.inviter_account_id===accountId)throw new ApiError(409,"self_referral","You cannot use your own friend invitation.");
  const context={kind:invitation!.kind,
    ...(invitation!.kind==="friend_referral"?{referrer:{name:invitation!.inviter_name}}:{}),
    ...(invitation!.kind==="campaign"?{campaign:{key:invitation!.campaign_key}}:{})};
  if(current.state==="active")return {access:current,alreadyEnrolled:true,invitation:context};
  if(current.state!=="none")throw new ApiError(403,"access_disabled","Semester access is currently disabled for this account.");
  const published=await requireNewEnrolmentPolicy(db,invitation!.kind);
  if(invitation!.redemption_count>=invitation!.max_redemptions)
    throw new ApiError(409,"invitation_exhausted","This invitation has no new-account places remaining.");
  const hash=await invitationHash(token),claim=crypto.randomUUID();

  // The batch is one D1 transaction. last_claim_id lets only the request which
  // obtained the final slot mark its redemption as counted. A losing pending
  // row is removed before commit, so a later valid invitation can still work.
  await db.batch([
    db.prepare(`INSERT INTO invitation_redemptions(invitation_id,account_id,claim_id,counted,redeemed_at)
      SELECT id,?2,?3,0,?4 FROM access_invitations
      WHERE token_hash=?1 AND revoked_at IS NULL AND expires_at>?4
      AND (kind='private' OR kind='campaign' AND EXISTS(
        SELECT 1 FROM invitation_contexts x JOIN growth_campaigns c ON c.id=x.campaign_id
        WHERE x.invitation_id=access_invitations.id AND c.revoked_at IS NULL)
      OR kind='friend_referral' AND EXISTS(
        SELECT 1 FROM invitation_contexts x JOIN friend_profiles p ON p.account_id=x.inviter_account_id
        WHERE x.invitation_id=access_invitations.id AND x.inviter_account_id!=?2))
      AND NOT EXISTS(SELECT 1 FROM account_access WHERE account_id=?2)
      AND (?5 IS NULL OR (SELECT COUNT(*) FROM account_access WHERE state!='deleted')<?5)
      ON CONFLICT DO NOTHING`).bind(hash,accountId,claim,now,published.policy.totalEnrolmentCap),
    db.prepare(`UPDATE growth_campaigns SET redemption_count=redemption_count+1,last_claim_id=?3,updated_at=?4
      WHERE id=(SELECT x.campaign_id FROM access_invitations i JOIN invitation_contexts x ON x.invitation_id=i.id WHERE i.token_hash=?1)
      AND revoked_at IS NULL AND redemption_count<max_redemptions
      AND EXISTS(SELECT 1 FROM invitation_redemptions r JOIN invitation_contexts x ON x.invitation_id=r.invitation_id
        WHERE r.account_id=?2 AND r.claim_id=?3 AND r.counted=0 AND x.campaign_id=growth_campaigns.id)`)
      .bind(hash,accountId,claim,now),
    db.prepare(`UPDATE access_invitations SET redemption_count=redemption_count+1,last_claim_id=?3
      WHERE token_hash=?1 AND revoked_at IS NULL AND expires_at>?4
      AND redemption_count<max_redemptions
      AND (kind!='campaign' OR EXISTS(SELECT 1 FROM invitation_contexts x JOIN growth_campaigns c ON c.id=x.campaign_id
        WHERE x.invitation_id=access_invitations.id AND c.last_claim_id=?3))
      AND EXISTS(SELECT 1 FROM invitation_redemptions WHERE invitation_id=access_invitations.id AND account_id=?2 AND claim_id=?3 AND counted=0)`)
      .bind(hash,accountId,claim,now),
    db.prepare(`UPDATE invitation_redemptions SET counted=1 WHERE account_id=?1 AND claim_id=?2 AND counted=0
      AND EXISTS(SELECT 1 FROM access_invitations WHERE id=invitation_id AND last_claim_id=?2)`).bind(accountId,claim),
    db.prepare(`INSERT INTO account_access(account_id,state,source,invitation_id,enrolled_at,updated_at)
      SELECT r.account_id,'active',CASE i.kind WHEN 'campaign' THEN 'campaign' WHEN 'friend_referral' THEN 'friend_referral' ELSE 'private_invitation' END,r.invitation_id,?3,?3
      FROM invitation_redemptions r JOIN access_invitations i ON i.id=r.invitation_id
      WHERE account_id=?1 AND claim_id=?2 AND counted=1 ON CONFLICT(account_id) DO NOTHING`).bind(accountId,claim,now),
    db.prepare(`INSERT INTO account_attribution(account_id,direct_channel,campaign_id,acquisition_invitation_id,referrer_account_id,root_campaign_id,root_acquisition_invitation_id,acquired_at)
      SELECT r.account_id,
        CASE i.kind WHEN 'campaign' THEN COALESCE(l.channel,'society') WHEN 'friend_referral' THEN 'friend_referral' ELSE 'private_invitation' END,
        CASE WHEN i.kind='campaign' THEN x.campaign_id END,
        r.invitation_id,
        CASE WHEN i.kind='friend_referral' THEN x.inviter_account_id END,
        CASE WHEN i.kind='campaign' THEN x.campaign_id WHEN i.kind='friend_referral' THEN COALESCE(a.root_campaign_id,a.campaign_id) END,
        CASE WHEN i.kind='friend_referral' THEN COALESCE(a.root_acquisition_invitation_id,a.acquisition_invitation_id) ELSE r.invitation_id END,
        ?3
      FROM invitation_redemptions r JOIN access_invitations i ON i.id=r.invitation_id
      LEFT JOIN invitation_contexts x ON x.invitation_id=i.id
      LEFT JOIN campaign_distribution_links l ON l.invitation_id=i.id
      LEFT JOIN account_attribution a ON a.account_id=x.inviter_account_id
      WHERE r.account_id=?1 AND r.claim_id=?2 AND r.counted=1
      ON CONFLICT(account_id) DO NOTHING`).bind(accountId,claim,now),
    // Retain the legacy table as a storage parent, not as the authorization source.
    db.prepare(`INSERT INTO backup_trial_members(account_id) SELECT account_id FROM account_access
      WHERE account_id=?1 AND state='active' ON CONFLICT(account_id) DO NOTHING`).bind(accountId),
    db.prepare("DELETE FROM invitation_redemptions WHERE account_id=?1 AND claim_id=?2 AND counted=0").bind(accountId,claim),
  ]);
  const access=await accessStatus(db,accountId);
  if(access.state==="active")return {access,alreadyEnrolled:false,invitation:context};
  // Re-read the published policy so a transaction which lost the final global
  // place reports the configured limit instead of a generic invitation race.
  await requireNewEnrolmentPolicy(db,invitation!.kind);
  const finalProblem=invitationError(await invitationRow(db,token),now);
  throw finalProblem ?? new ApiError(409,"invitation_unavailable","This invitation could not be redeemed. Please retry once.");
}
