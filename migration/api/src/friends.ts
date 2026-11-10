import {ApiError} from "./auth.ts";
import {invitationHash,invitationToken} from "./access.ts";
import {readPublishedPolicy} from "./growth-policy.ts";
import type {SqlDatabase} from "./store.ts";

const idPattern=/^[0-9a-f-]{36}$/;
const pair=(a:string,b:string):[string,string]=>a<b?[a,b]:[b,a];
const now=()=>new Date().toISOString();

function cleanName(value:unknown) {
  const name=typeof value==="string"?value.trim():"";
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))
    throw new ApiError(400,"profile_invalid","Enter a display name of 1–60 characters.");
  return name;
}

async function rateLimit(db:SqlDatabase,accountId:string,action:string,max:number,seconds:number) {
  const epoch=Math.floor(Date.now()/1000),window=Math.floor(epoch/seconds)*seconds;
  const row=await db.prepare(`INSERT INTO friend_rate_limits(account_id,action,window_start,count) VALUES (?1,?2,?3,1)
    ON CONFLICT(account_id,action) DO UPDATE SET window_start=excluded.window_start,
      count=CASE WHEN friend_rate_limits.window_start!=excluded.window_start THEN 1 ELSE friend_rate_limits.count+1 END
    WHERE friend_rate_limits.window_start!=excluded.window_start OR friend_rate_limits.count<?4 RETURNING count`)
    .bind(accountId,action,window,max).first<{count:number}>();
  if(!row)throw new ApiError(429,"friend_rate_limited","Too many friend actions. Please try again later.");
}

export async function readFriends(db:SqlDatabase,accountId:string) {
  const profile=await db.prepare("SELECT public_id,display_name,revision FROM friend_profiles WHERE account_id=?1")
    .bind(accountId).first<{public_id:string;display_name:string;revision:number}>();
  const invite=await db.prepare(`SELECT i.id,i.expires_at,i.revoked_at,i.max_redemptions,i.redemption_count
    FROM invitation_contexts x JOIN access_invitations i ON i.id=x.invitation_id
    WHERE x.inviter_account_id=?1 ORDER BY i.created_at DESC LIMIT 1`).bind(accountId)
    .first<{id:string;expires_at:string;revoked_at:string|null;max_redemptions:number;redemption_count:number}>();
  const rows=await db.prepare(`SELECT f.id,f.requester_account_id,f.status,f.blocked_by_account_id,f.revision,
      p.public_id,p.display_name
    FROM friendships f JOIN friend_profiles p ON p.account_id=CASE WHEN f.account_a=?1 THEN f.account_b ELSE f.account_a END
    WHERE f.account_a=?1 OR f.account_b=?1
    ORDER BY CASE WHEN f.status='pending' AND f.requester_account_id!=?1 THEN 0 WHEN f.status='accepted' THEN 1 ELSE 2 END,
      f.updated_at DESC LIMIT 101`).bind(accountId).all<{id:string;requester_account_id:string;status:string;blocked_by_account_id:string|null;
        revision:number;public_id:string;display_name:string}>();
  return {profile:profile?{id:profile.public_id,name:profile.display_name,revision:profile.revision}:null,
    invitation:invite?{id:invite.id,state:invite.revoked_at?"revoked":invite.expires_at<=now()?"expired":"active",
      expiresAt:invite.expires_at,remaining:Math.max(0,invite.max_redemptions-invite.redemption_count)}:null,
    friends:rows.results.slice(0,100).map(row=>({id:row.public_id,connectionId:row.id,name:row.display_name,revision:row.revision,
      state:row.status==="pending"?(row.requester_account_id===accountId?"outgoing":"incoming"):row.status,
      canUnblock:row.status==="blocked"&&row.blocked_by_account_id===accountId})),truncated:rows.results.length>100};
}

export async function saveFriendProfile(db:SqlDatabase,accountId:string,body:Record<string,unknown>) {
  if(Object.keys(body).some(key=>!["name","expectedRevision"].includes(key)))throw new ApiError(400,"profile_invalid","Send only a display name and revision.");
  const name=cleanName(body.name),expected=body.expectedRevision;
  if(!Number.isSafeInteger(expected)||Number(expected)<0)throw new ApiError(400,"profile_invalid","Refresh your profile and try again.");
  const timestamp=now();
  const result=Number(expected)===0
    ? await db.prepare(`INSERT INTO friend_profiles(account_id,public_id,display_name,revision,updated_at)
        VALUES (?1,?2,?3,1,?4) ON CONFLICT(account_id) DO NOTHING`).bind(accountId,crypto.randomUUID(),name,timestamp).run()
    : await db.prepare(`UPDATE friend_profiles SET display_name=?1,revision=revision+1,updated_at=?2
        WHERE account_id=?3 AND revision=?4`).bind(name,timestamp,accountId,Number(expected)).run();
  if(!result.meta.changes)throw new ApiError(409,"revision_conflict","This profile changed in another tab. Refresh and try again.");
  return readFriends(db,accountId);
}

export async function createFriendInvitation(db:SqlDatabase,accountId:string,webUrl:string) {
  const profile=await db.prepare("SELECT 1 ok FROM friend_profiles WHERE account_id=?1").bind(accountId).first();
  if(!profile)throw new ApiError(409,"profile_required","Choose a display name before sharing a friend invitation.");
  const {policy}=await readPublishedPolicy(db);
  if(!policy.allowExistingFriendRequests)throw new ApiError(403,"friend_programme_disabled","New friend connections are currently disabled.");
  await rateLimit(db,accountId,"create_invitation",policy.friendInvitationsPerHour,3600);
  const tokenBytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...tokenBytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,""),timestamp=now();
  const invitationId=crypto.randomUUID(),expiresAt=new Date(Date.now()+policy.friendReferralExpiryHours*3_600_000).toISOString();
  await db.batch([
    db.prepare(`UPDATE access_invitations SET revoked_at=?2 WHERE id IN
      (SELECT invitation_id FROM invitation_contexts WHERE inviter_account_id=?1) AND revoked_at IS NULL`).bind(accountId,timestamp),
    db.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
      VALUES (?1,'friend_referral',?2,'Personal friend referral',?3,0,?4,?5)`)
      .bind(invitationId,await invitationHash(token),policy.friendReferralMaxRedemptions,expiresAt,timestamp),
    db.prepare("INSERT INTO invitation_contexts(invitation_id,inviter_account_id) VALUES (?1,?2)").bind(invitationId,accountId),
  ]);
  return {id:invitationId,url:`${webUrl.replace(/\/$/,"")}/#invite=${token}`,expiresAt,maxNewAccounts:policy.friendReferralMaxRedemptions};
}

export async function revokeFriendInvitation(db:SqlDatabase,accountId:string,body:Record<string,unknown>) {
  if(Object.keys(body).some(key=>key!=="id")||typeof body.id!=="string"||!idPattern.test(body.id))
    throw new ApiError(400,"invitation_invalid","This invitation is not valid.");
  await db.prepare(`UPDATE access_invitations SET revoked_at=?3 WHERE id=?1 AND revoked_at IS NULL AND EXISTS(
    SELECT 1 FROM invitation_contexts WHERE invitation_id=?1 AND inviter_account_id=?2)`)
    .bind(body.id,accountId,now()).run();
  return {revoked:true};
}

export async function requestFriend(db:SqlDatabase,accountId:string,body:Record<string,unknown>) {
  if(Object.keys(body).some(key=>key!=="token"))throw new ApiError(400,"invitation_invalid","This invitation is not valid.");
  const token=invitationToken(body.token);
  if(!token)throw new ApiError(400,"invitation_invalid","This invitation is not valid.");
  const profile=await db.prepare("SELECT 1 ok FROM friend_profiles WHERE account_id=?1").bind(accountId).first();
  if(!profile)throw new ApiError(409,"profile_required","Choose a display name before sending the friend request.");
  const {policy}=await readPublishedPolicy(db);
  if(!policy.allowExistingFriendRequests)throw new ApiError(403,"friend_programme_disabled","New friend connections are currently disabled.");
  await rateLimit(db,accountId,"request_friend",policy.friendRequestsPerHour,3600);
  const timestamp=now(),hash=await invitationHash(token);
  const invite=await db.prepare(`SELECT x.inviter_account_id FROM access_invitations i JOIN invitation_contexts x ON x.invitation_id=i.id
    JOIN friend_profiles p ON p.account_id=x.inviter_account_id
    WHERE i.kind='friend_referral' AND i.token_hash=?1 AND i.revoked_at IS NULL AND i.expires_at>?2`)
    .bind(hash,timestamp).first<{inviter_account_id:string}>();
  if(!invite)throw new ApiError(410,"invitation_unavailable","This friend invitation is expired or unavailable.");
  if(invite.inviter_account_id===accountId)throw new ApiError(409,"self_referral","You cannot send a friend request to yourself.");
  const [a,b]=pair(accountId,invite.inviter_account_id),connectionId=crypto.randomUUID();
  const result=await db.prepare(`INSERT INTO friendships(id,account_a,account_b,requester_account_id,status,revision,created_at,updated_at)
    SELECT ?1,?2,?3,?4,'pending',1,?5,?5
    WHERE EXISTS(SELECT 1 FROM access_invitations i JOIN invitation_contexts x ON x.invitation_id=i.id
      WHERE i.token_hash=?6 AND i.revoked_at IS NULL AND i.expires_at>?5 AND x.inviter_account_id=?7)
    AND (SELECT COUNT(*) FROM friendships WHERE requester_account_id=?4 AND status='pending')<20
    AND (SELECT COUNT(*) FROM friendships WHERE (account_a=?7 OR account_b=?7) AND requester_account_id!=?7 AND status='pending')<100
    ON CONFLICT(account_a,account_b) DO NOTHING`).bind(connectionId,a,b,accountId,timestamp,hash,invite.inviter_account_id).run();
  const relation=await db.prepare("SELECT id,status,requester_account_id FROM friendships WHERE account_a=?1 AND account_b=?2")
    .bind(a,b).first<{id:string;status:string;requester_account_id:string}>();
  if(!result.meta.changes&&!relation)throw new ApiError(409,"friend_limit","The friend request is unavailable. Clear pending requests and try again.");
  if(relation?.status==="blocked")throw new ApiError(409,"friend_unavailable","This friend invitation is unavailable.");
  return {connectionId:relation?.id??connectionId,state:relation?.status==="accepted"?"accepted":relation?.requester_account_id===accountId?"outgoing":"incoming"};
}

export async function changeFriendship(db:SqlDatabase,accountId:string,body:Record<string,unknown>) {
  if(Object.keys(body).some(key=>!["connectionId","expectedRevision","operation"].includes(key))||
    typeof body.connectionId!=="string"||!idPattern.test(body.connectionId)||!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1||
    !["accept","decline","remove","block","unblock"].includes(String(body.operation)))
    throw new ApiError(400,"friend_action_invalid","Refresh the Friends list and try again.");
  const row=await db.prepare(`SELECT * FROM friendships WHERE id=?1 AND (account_a=?2 OR account_b=?2)`)
    .bind(body.connectionId,accountId).first<{account_a:string;account_b:string;requester_account_id:string;status:string;blocked_by_account_id:string|null;revision:number}>();
  if(!row||row.revision!==Number(body.expectedRevision))throw new ApiError(409,"revision_conflict","This friendship changed. Refresh and try again.");
  const operation=String(body.operation),timestamp=now();let result;
  if(operation==="accept"&&row.status==="pending"&&row.requester_account_id!==accountId)
    result=await db.prepare("UPDATE friendships SET status='accepted',revision=revision+1,updated_at=?1 WHERE id=?2 AND revision=?3").bind(timestamp,body.connectionId,row.revision).run();
  else if(operation==="block"&&row.status!=="blocked")
    result=await db.prepare("UPDATE friendships SET status='blocked',blocked_by_account_id=?1,revision=revision+1,updated_at=?2 WHERE id=?3 AND revision=?4").bind(accountId,timestamp,body.connectionId,row.revision).run();
  else if((operation==="decline"&&row.status==="pending"&&row.requester_account_id!==accountId)||(operation==="remove"&&row.status!=="blocked")||
    (operation==="unblock"&&row.status==="blocked"&&row.blocked_by_account_id===accountId))
    result=await db.prepare("DELETE FROM friendships WHERE id=?1 AND revision=?2").bind(body.connectionId,row.revision).run();
  else throw new ApiError(403,"friend_action_unavailable","This action is not available.");
  if(!result.meta.changes)throw new ApiError(409,"revision_conflict","This friendship changed. Refresh and try again.");
  return {ok:true};
}
