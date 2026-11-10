import {ApiError} from "./auth.ts";
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

type InvitationRow={id:string;expires_at:string;revoked_at:string|null;max_redemptions:number;redemption_count:number};

async function invitationRow(db:SqlDatabase,token:string) {
  return db.prepare(`SELECT id,expires_at,revoked_at,max_redemptions,redemption_count
    FROM access_invitations WHERE kind='private' AND token_hash=?1`).bind(await invitationHash(token)).first<InvitationRow>();
}

function invitationError(row:InvitationRow|null,now:string):ApiError|null {
  if(!row)return new ApiError(404,"invitation_invalid","This invitation link is not valid.");
  if(row.revoked_at)return new ApiError(410,"invitation_revoked","This invitation has been revoked.");
  if(row.expires_at<=now)return new ApiError(410,"invitation_expired","This invitation has expired.");
  if(row.redemption_count>=row.max_redemptions)return new ApiError(409,"invitation_exhausted","This invitation has already been used.");
  return null;
}

export async function previewInvitation(db:SqlDatabase,raw:unknown) {
  const token=invitationToken(raw);
  if(!token)throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
  const now=new Date().toISOString(),row=await invitationRow(db,token),problem=invitationError(row,now);
  if(problem)throw problem;
  return {valid:true,expiresAt:row!.expires_at,remaining:row!.max_redemptions-row!.redemption_count};
}

export async function redeemInvitation(db:SqlDatabase,accountId:string,raw:unknown) {
  const current=await accessStatus(db,accountId);
  if(current.state==="active")return {access:current,alreadyEnrolled:true};
  if(current.state!=="none")throw new ApiError(403,"access_disabled","Semester access is currently disabled for this account.");
  const token=invitationToken(raw);
  if(!token)throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
  const hash=await invitationHash(token),now=new Date().toISOString(),claim=crypto.randomUUID();

  // The batch is one D1 transaction. last_claim_id lets only the request which
  // obtained the final slot mark its redemption as counted. A losing pending
  // row is removed before commit, so a later valid invitation can still work.
  await db.batch([
    db.prepare(`INSERT INTO invitation_redemptions(invitation_id,account_id,claim_id,counted,redeemed_at)
      SELECT id,?2,?3,0,?4 FROM access_invitations
      WHERE kind='private' AND token_hash=?1 AND NOT EXISTS(SELECT 1 FROM account_access WHERE account_id=?2)
      ON CONFLICT DO NOTHING`).bind(hash,accountId,claim,now),
    db.prepare(`UPDATE access_invitations SET redemption_count=redemption_count+1,last_claim_id=?3
      WHERE kind='private' AND token_hash=?1 AND revoked_at IS NULL AND expires_at>?4
      AND redemption_count<max_redemptions
      AND EXISTS(SELECT 1 FROM invitation_redemptions WHERE invitation_id=access_invitations.id AND account_id=?2 AND claim_id=?3 AND counted=0)`)
      .bind(hash,accountId,claim,now),
    db.prepare(`UPDATE invitation_redemptions SET counted=1 WHERE account_id=?1 AND claim_id=?2 AND counted=0
      AND EXISTS(SELECT 1 FROM access_invitations WHERE id=invitation_id AND last_claim_id=?2)`).bind(accountId,claim),
    db.prepare(`INSERT INTO account_access(account_id,state,source,invitation_id,enrolled_at,updated_at)
      SELECT account_id,'active','private_invitation',invitation_id,?3,?3 FROM invitation_redemptions
      WHERE account_id=?1 AND claim_id=?2 AND counted=1 ON CONFLICT(account_id) DO NOTHING`).bind(accountId,claim,now),
    // Retain the legacy table as a storage parent, not as the authorization source.
    db.prepare(`INSERT INTO backup_trial_members(account_id) SELECT account_id FROM account_access
      WHERE account_id=?1 AND state='active' ON CONFLICT(account_id) DO NOTHING`).bind(accountId),
    db.prepare("DELETE FROM invitation_redemptions WHERE account_id=?1 AND claim_id=?2 AND counted=0").bind(accountId,claim),
  ]);
  const access=await accessStatus(db,accountId);
  if(access.state==="active")return {access,alreadyEnrolled:false};
  const problem=invitationError(await invitationRow(db,token),now);
  throw problem ?? new ApiError(409,"invitation_unavailable","This invitation could not be redeemed. Please retry once.");
}
