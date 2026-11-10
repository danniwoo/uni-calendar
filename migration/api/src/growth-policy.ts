import {ApiError} from "./auth.ts";
import type {SqlDatabase} from "./store.ts";

export type GrowthStage="private_pilot"|"campus_beta"|"campus_launch"|"public_access";
export type InvitationKind="private"|"campaign"|"friend_referral";
export interface GrowthPolicy {
  enrolmentMode:"invite_only";
  pauseNewEnrolments:boolean;
  allowPrivateInvitations:boolean;
  allowCampaignEnrolment:boolean;
  allowFriendReferralEnrolment:boolean;
  allowExistingFriendRequests:boolean;
  publicEnrolmentAvailable:false;
  totalEnrolmentCap:number|null;
  defaultInvitationExpiryHours:number;
  privateInvitationMaxRedemptions:number;
  campaignDefaultMaxRedemptions:number;
  campaignMaxRedemptions:number;
  friendReferralExpiryHours:number;
  friendReferralMaxRedemptions:number;
  privateInvitationsPerHour:number;
  friendInvitationsPerHour:number;
  friendRequestsPerHour:number;
}

const base:GrowthPolicy={enrolmentMode:"invite_only",pauseNewEnrolments:false,allowPrivateInvitations:true,
  allowCampaignEnrolment:true,allowFriendReferralEnrolment:true,allowExistingFriendRequests:true,publicEnrolmentAvailable:false,
  totalEnrolmentCap:null,defaultInvitationExpiryHours:168,privateInvitationMaxRedemptions:1,campaignDefaultMaxRedemptions:100,
  campaignMaxRedemptions:1000,friendReferralExpiryHours:168,friendReferralMaxRedemptions:20,privateInvitationsPerHour:5,
  friendInvitationsPerHour:5,friendRequestsPerHour:20};

export const growthPresets:Record<GrowthStage,GrowthPolicy>={
  private_pilot:{...base,allowCampaignEnrolment:false,friendReferralMaxRedemptions:10,campaignDefaultMaxRedemptions:50},
  campus_beta:{...base,campaignDefaultMaxRedemptions:100,friendReferralMaxRedemptions:20},
  campus_launch:{...base,privateInvitationMaxRedemptions:5,campaignDefaultMaxRedemptions:500,friendReferralMaxRedemptions:50},
  // Public Semester enrolment is deliberately unavailable in Stage 3. This
  // preset expands invitations but cannot silently turn Google auth into access.
  public_access:{...base,privateInvitationMaxRedemptions:10,campaignDefaultMaxRedemptions:1000,friendReferralMaxRedemptions:100},
};

const keys=Object.keys(base).sort();
const integer=(value:unknown,min:number,max:number,name:string)=>{
  if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new ApiError(400,"policy_invalid",`${name} is outside the supported range.`);
  return Number(value);
};

export function growthStage(value:unknown):GrowthStage {
  if(!["private_pilot","campus_beta","campus_launch","public_access"].includes(String(value)))
    throw new ApiError(400,"policy_invalid","Choose a supported growth stage.");
  return value as GrowthStage;
}

export function parseGrowthPolicy(value:unknown):GrowthPolicy {
  if(!value||typeof value!=="object"||Array.isArray(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify(keys))
    throw new ApiError(400,"policy_invalid","Send the complete supported growth policy.");
  const p=value as Record<string,unknown>;
  if(p.enrolmentMode!=="invite_only"||p.publicEnrolmentAvailable!==false)
    throw new ApiError(400,"public_enrolment_unavailable","Public Semester enrolment is not safely implemented in Stage 3.");
  for(const key of ["pauseNewEnrolments","allowPrivateInvitations","allowCampaignEnrolment","allowFriendReferralEnrolment","allowExistingFriendRequests"])
    if(typeof p[key]!=="boolean")throw new ApiError(400,"policy_invalid",`${key} must be on or off.`);
  const total=p.totalEnrolmentCap===null?null:integer(p.totalEnrolmentCap,1,1_000_000,"Total enrolment cap");
  const result:GrowthPolicy={
    enrolmentMode:"invite_only",pauseNewEnrolments:p.pauseNewEnrolments as boolean,
    allowPrivateInvitations:p.allowPrivateInvitations as boolean,allowCampaignEnrolment:p.allowCampaignEnrolment as boolean,
    allowFriendReferralEnrolment:p.allowFriendReferralEnrolment as boolean,allowExistingFriendRequests:p.allowExistingFriendRequests as boolean,
    publicEnrolmentAvailable:false,totalEnrolmentCap:total,
    defaultInvitationExpiryHours:integer(p.defaultInvitationExpiryHours,1,2160,"Default expiry"),
    privateInvitationMaxRedemptions:integer(p.privateInvitationMaxRedemptions,1,1000,"Private invitation cap"),
    campaignDefaultMaxRedemptions:integer(p.campaignDefaultMaxRedemptions,1,100_000,"Campaign default cap"),
    campaignMaxRedemptions:integer(p.campaignMaxRedemptions,1,1_000_000,"Campaign maximum cap"),
    friendReferralExpiryHours:integer(p.friendReferralExpiryHours,1,2160,"Friend referral expiry"),
    friendReferralMaxRedemptions:integer(p.friendReferralMaxRedemptions,1,1000,"Friend referral cap"),
    privateInvitationsPerHour:integer(p.privateInvitationsPerHour,1,100,"Private invitation rate"),
    friendInvitationsPerHour:integer(p.friendInvitationsPerHour,1,100,"Friend invitation rate"),
    friendRequestsPerHour:integer(p.friendRequestsPerHour,1,100,"Friend request rate"),
  };
  if(result.campaignDefaultMaxRedemptions>result.campaignMaxRedemptions)
    throw new ApiError(400,"policy_invalid","The default campaign cap cannot exceed the maximum campaign cap.");
  return result;
}

export interface PublishedPolicy {version:number;stage:GrowthStage;policy:GrowthPolicy;publishedAt:string}
export async function readPublishedPolicy(db:SqlDatabase):Promise<PublishedPolicy> {
  const row=await db.prepare(`SELECT v.version,v.stage,v.policy_json,v.published_at FROM growth_policy_state s
    JOIN growth_policy_versions v ON v.version=s.published_version WHERE s.id=1`)
    .first<{version:number;stage:GrowthStage;policy_json:string;published_at:string}>();
  if(!row)throw new ApiError(503,"policy_unavailable","Growth policy is not configured.");
  return {version:row.version,stage:row.stage,policy:parseGrowthPolicy(JSON.parse(row.policy_json)),publishedAt:row.published_at};
}

export async function requireNewEnrolmentPolicy(db:SqlDatabase,kind:InvitationKind) {
  const published=await readPublishedPolicy(db),policy=published.policy;
  if(policy.pauseNewEnrolments)throw new ApiError(403,"enrolments_paused","New Semester enrolments are temporarily paused.");
  if(kind==="private"&&!policy.allowPrivateInvitations||kind==="campaign"&&!policy.allowCampaignEnrolment||
      kind==="friend_referral"&&!policy.allowFriendReferralEnrolment)
    throw new ApiError(403,"enrolment_channel_disabled","This enrolment channel is currently disabled.");
  if(policy.totalEnrolmentCap!==null) {
    const row=await db.prepare("SELECT COUNT(*) n FROM account_access WHERE state!='deleted'").first<{n:number}>();
    if((row?.n??0)>=policy.totalEnrolmentCap)throw new ApiError(409,"enrolment_limit_reached","Semester's current enrolment limit has been reached.");
  }
  return published;
}
