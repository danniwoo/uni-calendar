import {ApiError} from "./auth.ts";
import {invitationHash,invitationToken,previewInvitation} from "./access.ts";
import {requireAdmin} from "./admin.ts";
import type {SqlDatabase} from "./store.ts";

export const analyticsTaxonomyVersion=1;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const visitPattern=/^[A-Za-z0-9_-]{22,64}$/;
export type AnalyticsFeature="semester_import"|"semester_board"|"today_plan"|"task_completion"|"assessment_view"|"friends";
export type ActivityKind="meaningful"|"passive"|"social";
type EventName="semester_imported"|"semester_board_saved"|"today_plan_saved"|"task_completion_saved"|
  "friend_link_created"|"friend_request_sent"|"friend_request_accepted";

const now=()=>new Date().toISOString();
const day=(timestamp:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timestamp));
const sydneyDateTime=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
const sydneyStart=(date:string)=>{
  const [year,month,dateOfMonth]=date.split("-").map(Number),target=Date.UTC(year,month-1,dateOfMonth);let guess=target;
  for(let attempt=0;attempt<4;attempt++) {
    const parts=Object.fromEntries(sydneyDateTime.formatToParts(new Date(guess)).filter(part=>part.type!=="literal").map(part=>[part.type,Number(part.value)]));
    const observed=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second),adjustment=target-observed;
    guess+=adjustment;if(adjustment===0)break;
  }
  return new Date(guess).toISOString();
};
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),
  byte=>byte.toString(16).padStart(2,"0")).join("");
const exact=(body:Record<string,unknown>,keys:string[])=>{
  if(Object.keys(body).some(key=>!keys.includes(key)))throw new ApiError(400,"analytics_event_invalid","The analytics event is invalid.");
};

async function prune(db:SqlDatabase,timestamp:string) {
  const state=await db.prepare("SELECT retention_days,last_pruned_at FROM analytics_state WHERE id=1")
    .first<{retention_days:number;last_pruned_at:string|null}>();
  if(!state||state.last_pruned_at&&Date.parse(timestamp)-Date.parse(state.last_pruned_at)<86_400_000)return;
  const cutoff=new Date(Date.parse(timestamp)-state.retention_days*86_400_000).toISOString(),cutoffDay=day(cutoff);
  await db.batch([
    db.prepare("DELETE FROM analytics_events WHERE received_at<?1").bind(cutoff),
    db.prepare("DELETE FROM analytics_activity_days WHERE activity_date<?1").bind(cutoffDay),
    db.prepare("DELETE FROM analytics_semester_usage WHERE last_at<?1").bind(cutoff),
    db.prepare("UPDATE analytics_state SET last_pruned_at=?1 WHERE id=1").bind(timestamp),
  ]);
}

export async function recordLanding(db:SqlDatabase,body:Record<string,unknown>) {
  exact(body,["token","visitId","eventId"]);
  const token=invitationToken(body.token),visitId=typeof body.visitId==="string"?body.visitId:"",eventId=typeof body.eventId==="string"?body.eventId:"";
  if(!token||!visitPattern.test(visitId)||!uuid.test(eventId))throw new ApiError(400,"analytics_event_invalid","The landing event is invalid.");
  await previewInvitation(db,token);
  const timestamp=now(),visitorHash=await sha256(visitId),hash=await invitationHash(token),hour=new Date(Math.floor(Date.parse(timestamp)/3_600_000)*3_600_000).toISOString();
  const invitation=await db.prepare(`SELECT i.id,x.campaign_id FROM access_invitations i
    LEFT JOIN invitation_contexts x ON x.invitation_id=i.id WHERE i.token_hash=?1`).bind(hash).first<{id:string;campaign_id:string|null}>();
  if(!invitation)throw new ApiError(404,"invitation_invalid","This invitation link is not valid.");
  const result=await db.prepare(`INSERT INTO analytics_events(id,taxonomy_version,event_name,event_source,visitor_hash,invitation_id,campaign_id,
      occurred_at,received_at,dedupe_key)
    SELECT ?1,1,'invitation_landing','browser',?2,?3,?4,?5,?5,?6
    WHERE (SELECT COUNT(*) FROM analytics_events WHERE invitation_id=?3 AND event_name='invitation_landing' AND received_at>=?7)<500
    ON CONFLICT(dedupe_key) DO NOTHING`).bind(eventId,visitorHash,invitation.id,invitation.campaign_id,timestamp,
      `landing:${invitation.id}:${visitorHash}`,hour).run();
  await prune(db,timestamp);
  return {accepted:result.meta.changes===1,taxonomyVersion:analyticsTaxonomyVersion,visitor:"tab-scoped"};
}

export async function recordAuthenticatedSession(db:SqlDatabase,accountId:string,body:Record<string,unknown>) {
  exact(body,["visitId"]);const visitId=body.visitId===null||body.visitId===undefined?null:String(body.visitId);
  if(visitId!==null&&!visitPattern.test(visitId))throw new ApiError(400,"analytics_event_invalid","The analytics session is invalid.");
  const timestamp=now(),visitorHash=visitId?await sha256(visitId):null;
  const landing=visitorHash?await db.prepare(`SELECT invitation_id,campaign_id FROM analytics_events
    WHERE visitor_hash=?1 AND event_name='invitation_landing' ORDER BY occurred_at DESC LIMIT 1`).bind(visitorHash)
    .first<{invitation_id:string|null;campaign_id:string|null}>():null;
  const result=await db.prepare(`INSERT INTO analytics_events(id,taxonomy_version,event_name,event_source,account_id,visitor_hash,invitation_id,campaign_id,
      occurred_at,received_at,dedupe_key) VALUES (?1,1,'auth_completed','server',?2,?3,?4,?5,?6,?6,?7)
    ON CONFLICT(dedupe_key) DO NOTHING`).bind(crypto.randomUUID(),accountId,visitorHash,landing?.invitation_id??null,landing?.campaign_id??null,
      timestamp,`auth:${accountId}`).run();
  await prune(db,timestamp);
  return {accepted:result.meta.changes===1,taxonomyVersion:analyticsTaxonomyVersion};
}

export async function recordActivity(db:SqlDatabase,accountId:string,feature:AnalyticsFeature,kind:ActivityKind,
  eventName:EventName|null,dedupeKey:string|null,periodKey:string|null=null) {
  const timestamp=now(),activityDate=day(timestamp),activity=eventName&&dedupeKey
    ? db.prepare(`INSERT INTO analytics_activity_days(account_id,activity_date,feature,activity_kind,first_at,last_at,event_count)
      SELECT ?1,?2,?3,?4,?5,?5,1 WHERE NOT EXISTS(SELECT 1 FROM analytics_events WHERE dedupe_key=?6)
      ON CONFLICT(account_id,activity_date,feature) DO UPDATE SET
      last_at=excluded.last_at,event_count=analytics_activity_days.event_count+1,
      activity_kind=CASE WHEN analytics_activity_days.activity_kind='meaningful' THEN 'meaningful' ELSE excluded.activity_kind END`)
      .bind(accountId,activityDate,feature,kind,timestamp,dedupeKey)
    : db.prepare(`INSERT INTO analytics_activity_days(account_id,activity_date,feature,activity_kind,first_at,last_at,event_count)
      VALUES (?1,?2,?3,?4,?5,?5,1) ON CONFLICT(account_id,activity_date,feature) DO UPDATE SET
      last_at=excluded.last_at,event_count=analytics_activity_days.event_count+1,
      activity_kind=CASE WHEN analytics_activity_days.activity_kind='meaningful' THEN 'meaningful' ELSE excluded.activity_kind END`)
      .bind(accountId,activityDate,feature,kind,timestamp),statements=[activity];
  if(eventName&&dedupeKey)statements.push(db.prepare(`INSERT INTO analytics_events(id,taxonomy_version,event_name,event_source,account_id,feature,
      occurred_at,received_at,dedupe_key) VALUES (?1,1,?2,'server',?3,?4,?5,?5,?6) ON CONFLICT(dedupe_key) DO NOTHING`)
    .bind(crypto.randomUUID(),eventName,accountId,feature,timestamp,dedupeKey));
  if(periodKey&&/^[0-9]{4}:[A-Za-z0-9_-]{1,20}$/.test(periodKey))statements.push(db.prepare(`INSERT INTO analytics_semester_usage(account_id,period_key,first_at,last_at)
      VALUES (?1,?2,?3,?3) ON CONFLICT(account_id,period_key) DO UPDATE SET last_at=excluded.last_at`).bind(accountId,periodKey,timestamp));
  await db.batch(statements);await prune(db,timestamp);
}

export async function analyticsBestEffort(action:()=>Promise<unknown>) {try{await action();}catch{/* Product access must not depend on analytics. */}}

export function analyticsPeriodKey(text:string):string|null {
  try {const value=JSON.parse(text) as {year?:unknown;session?:unknown;snapshot?:{originalJson?:unknown}};
    if(Number.isSafeInteger(value.year)&&typeof value.session==="string"&&/^[A-Za-z0-9_-]{1,20}$/.test(value.session))return `${value.year}:${value.session}`;
    return typeof value.snapshot?.originalJson==="string"?analyticsPeriodKey(value.snapshot.originalJson):null;
  } catch {return null;}
}

const isoDate=(value:string|null,fallback:string)=>{
  const candidate=value??fallback;if(!/^\d{4}-\d{2}-\d{2}$/.test(candidate)||!Number.isFinite(Date.parse(candidate+"T00:00:00Z")))
    throw new ApiError(400,"analytics_filter_invalid","Choose a valid analytics date range.");
  return candidate;
};
const optional=(value:string|null,max=80)=>{
  if(value===null||value==="")return null;
  if(value.length>max||!/^[A-Za-z0-9 ._&:/-]+$/.test(value))
    throw new ApiError(400,"analytics_filter_invalid","Choose valid analytics filters.");
  return value;
};
const rate=(n:number,d:number)=>d>0?n/d:null;
const numberValue=(value:unknown)=>Number(value??0);

type PerformanceRow={invitation_id:string;campaign_id:string;campaign_key:string;campaign_name:string;label:string;channel:string;source:string;
  format:string|null;placement:string|null;creative_id:string|null;landing_visits:number;authenticated:number;direct_joins:number;activated:number;
  week2_eligible:number;week2_retained:number;direct_referrals:number;downstream_descendants:number;activated_descendants:number;avg_activation_hours:number|null};

function insights(rows:ReturnType<typeof publicPerformance>[],funnel:{enrolled:number;activated:number;landingVisits:number|null;authenticated:number|null},min:number) {
  const result:{type:string;title:string;observation:string;support:string;caveat:string;suggestion:string}[]=[];
  if(funnel.enrolled>0&&(funnel.landingVisits===null||funnel.authenticated===null||funnel.authenticated<funnel.enrolled))result.push({type:"coverage",title:"Tracking coverage is incomplete",
    observation:"Some enrolled accounts do not have a complete tracked landing and authentication path.",support:`${funnel.enrolled} enrolments in range`,
    caveat:"Tracking started prospectively; older clients and pre-tracking accounts are not reconstructed.",suggestion:"Collect a complete cohort before comparing landing conversion rates."});
  for(const row of rows) {
    if(row.privacySuppressed||numberValue(row.directJoins)<min)continue;
    if(row.activationRate!==null&&row.activationRate<0.4)result.push({type:"activation",title:"High acquisition, weak activation",
      observation:`${row.label} acquired students but fewer than 40% reached a meaningful Semester outcome.`,support:`${row.directJoins} joins · ${row.activated} activated`,
      caveat:"This is an association, not evidence that the source caused the drop-off.",suggestion:"Investigate import/setup friction and message-to-product fit before increasing promotion."});
    if(numberValue(row.week2Eligible)>=min&&row.week2RetentionRate!==null&&row.week2RetentionRate<0.3)result.push({type:"retention",title:"Activation is not carrying into Week 2",
      observation:`${row.label} has fewer than 30% of eligible activated students returning in Week 2.`,support:`${row.week2Retained}/${row.week2Eligible} retained`,
      caveat:"Academic breaks and small cohorts can depress short-window activity.",suggestion:"Compare teaching-week timing and the first feature used before changing acquisition spend."});
    if(numberValue(row.activated)>=min&&row.referralAmplification!==null&&row.referralAmplification>=0.5)result.push({type:"referral",title:"Strong referral amplification",
      observation:`${row.label} generated at least one activated descendant for every two directly activated students.`,support:`${row.activatedDescendants} activated descendants / ${row.activated} directly activated`,
      caveat:"Descendants are attributed to ancestry, not proof that the original promotion alone caused them.",suggestion:"Test whether a similar partnership or placement reproduces the pattern."});
  }
  if(!result.length)result.push({type:"insufficient",title:"Not enough mature data for a reliable recommendation",observation:"No cohort currently clears the deterministic insight thresholds.",
    support:`Minimum displayed cohort: ${min}`,caveat:"Zero and unavailable are different; immature students are not counted as churned.",suggestion:"Keep tracking and compare again after cohorts mature."});
  return result.slice(0,8);
}

function publicPerformance(row:PerformanceRow,total:number,min:number) {
  const joins=numberValue(row.direct_joins),suppressed=joins>0&&joins<min,activated=numberValue(row.activated),eligible=numberValue(row.week2_eligible);
  return {invitationId:row.invitation_id,campaignId:row.campaign_id,campaignKey:row.campaign_key,campaign:row.campaign_name,label:row.label,
    channel:row.channel,source:row.source,format:row.format,placement:row.placement,creativeId:row.creative_id,
    privacySuppressed:suppressed,directJoins:suppressed?null:joins,directJoinsBand:suppressed?`<${min}`:null,
    landingVisits:suppressed?null:numberValue(row.landing_visits),authenticated:suppressed?null:numberValue(row.authenticated),
    shareOfJoins:suppressed?null:rate(joins,total),activated:suppressed?null:activated,activationRate:suppressed?null:rate(activated,joins),
    week2Eligible:suppressed?null:eligible,week2Retained:suppressed?null:numberValue(row.week2_retained),
    week2RetentionRate:suppressed?null:rate(numberValue(row.week2_retained),eligible),directReferrals:suppressed?null:numberValue(row.direct_referrals),
    downstreamDescendants:suppressed?null:numberValue(row.downstream_descendants),activatedDescendants:suppressed?null:numberValue(row.activated_descendants),
    referralAmplification:suppressed?null:rate(numberValue(row.activated_descendants),activated),avgActivationHours:suppressed?null:row.avg_activation_hours};
}

export async function readAdminAnalytics(db:SqlDatabase,adminId:string,params:URLSearchParams) {
  await requireAdmin(db,adminId);
  const today=day(now()),defaultFrom=new Date(Date.parse(today+"T00:00:00Z")-89*86_400_000).toISOString().slice(0,10);
  const from=isoDate(params.get("from"),defaultFrom),to=isoDate(params.get("to"),today);
  if(from>to||Date.parse(to)-Date.parse(from)>366*86_400_000)throw new ApiError(400,"analytics_filter_invalid","Analytics ranges are limited to 367 days.");
  const campaign=optional(params.get("campaign")),channel=optional(params.get("channel")),source=optional(params.get("source"));
  const nextDate=new Date(Date.parse(to+"T00:00:00Z")+86_400_000).toISOString().slice(0,10),fromAt=sydneyStart(from),toExclusive=sydneyStart(nextDate),
    asOf=new Date(Math.min(Date.now(),Date.parse(toExclusive)-1)).toISOString();
  const state=await db.prepare("SELECT taxonomy_version,tracking_started_at,retention_days,small_cohort_min FROM analytics_state WHERE id=1")
    .first<{taxonomy_version:number;tracking_started_at:string;retention_days:number;small_cohort_min:number}>();
  if(!state)throw new ApiError(503,"analytics_unavailable","Analytics tracking is not configured.");
  const performance=(await db.prepare(`WITH activation AS (
      SELECT account_id,MIN(first_at) activated_at,MIN(activity_date) activation_date FROM analytics_activity_days WHERE activity_kind='meaningful' GROUP BY account_id
    ), direct AS (
      SELECT a.account_id,a.acquisition_invitation_id,a.acquired_at,v.activated_at,v.activation_date FROM account_attribution a
      LEFT JOIN activation v ON v.account_id=a.account_id WHERE a.acquired_at>=?1 AND a.acquired_at<?2
    )
    SELECT l.invitation_id,l.campaign_id,c.campaign_key,c.name campaign_name,l.label,l.channel,l.source,l.format,l.placement,l.creative_id,
      (SELECT COUNT(*) FROM analytics_events e WHERE e.invitation_id=l.invitation_id AND e.event_name='invitation_landing' AND e.occurred_at>=?1 AND e.occurred_at<?2) landing_visits,
      (SELECT COUNT(DISTINCT e.account_id) FROM analytics_events e WHERE e.invitation_id=l.invitation_id AND e.event_name='auth_completed' AND e.occurred_at>=?1 AND e.occurred_at<?2) authenticated,
      COUNT(DISTINCT d.account_id) direct_joins,
      COUNT(DISTINCT CASE WHEN d.activated_at IS NOT NULL THEN d.account_id END) activated,
      COUNT(DISTINCT CASE WHEN d.activated_at IS NOT NULL AND datetime(d.activated_at,'+21 days')<=?3 THEN d.account_id END) week2_eligible,
      COUNT(DISTINCT CASE WHEN d.activated_at IS NOT NULL AND datetime(d.activated_at,'+21 days')<=?3 AND EXISTS(
        SELECT 1 FROM analytics_activity_days ad WHERE ad.account_id=d.account_id AND ad.activity_kind='meaningful'
        AND ad.activity_date>=date(d.activation_date,'+14 days') AND ad.activity_date<date(d.activation_date,'+21 days')) THEN d.account_id END) week2_retained,
      COUNT(DISTINCT CASE WHEN child.referrer_account_id=d.account_id THEN child.account_id END) direct_referrals,
      COUNT(DISTINCT child.account_id) downstream_descendants,
      COUNT(DISTINCT CASE WHEN childact.activated_at IS NOT NULL THEN child.account_id END) activated_descendants,
      (SELECT AVG((julianday(dx.activated_at)-julianday(dx.acquired_at))*24) FROM direct dx
        WHERE dx.acquisition_invitation_id=l.invitation_id AND dx.activated_at IS NOT NULL) avg_activation_hours
    FROM campaign_distribution_links l JOIN growth_campaigns c ON c.id=l.campaign_id
    LEFT JOIN direct d ON d.acquisition_invitation_id=l.invitation_id
    LEFT JOIN account_attribution child ON child.direct_channel='friend_referral' AND child.root_acquisition_invitation_id=l.invitation_id
    LEFT JOIN activation childact ON childact.account_id=child.account_id
    WHERE (?4 IS NULL OR c.id=?4 OR c.campaign_key=?4) AND (?5 IS NULL OR l.channel=?5) AND (?6 IS NULL OR l.source=?6)
    GROUP BY l.invitation_id ORDER BY direct_joins DESC,l.created_at DESC`).bind(fromAt,toExclusive,asOf,campaign,channel,source).all<PerformanceRow>()).results;
  const total=performance.reduce((sum,row)=>sum+numberValue(row.direct_joins),0),rows=performance.map(row=>publicPerformance(row,total,state.small_cohort_min));
  const funnelRow=await db.prepare(`WITH activation AS (
      SELECT account_id,MIN(first_at) activated_at,MIN(activity_date) activation_date FROM analytics_activity_days WHERE activity_kind='meaningful' GROUP BY account_id
    ), cohort AS (
      SELECT a.account_id,a.acquired_at,v.activated_at,v.activation_date FROM account_attribution a LEFT JOIN activation v ON v.account_id=a.account_id
      LEFT JOIN campaign_distribution_links l ON l.invitation_id=a.acquisition_invitation_id
      LEFT JOIN growth_campaigns c ON c.id=l.campaign_id
      WHERE a.acquired_at>=?1 AND a.acquired_at<?2
        AND (?4 IS NULL OR c.id=?4 OR c.campaign_key=?4) AND (?5 IS NULL OR l.channel=?5) AND (?6 IS NULL OR l.source=?6)
    ) SELECT
      (SELECT COUNT(*) FROM analytics_events e LEFT JOIN campaign_distribution_links el ON el.invitation_id=e.invitation_id
        LEFT JOIN growth_campaigns ec ON ec.id=el.campaign_id WHERE e.event_name='invitation_landing' AND e.occurred_at>=?1 AND e.occurred_at<?2
        AND (?4 IS NULL OR ec.id=?4 OR ec.campaign_key=?4) AND (?5 IS NULL OR el.channel=?5) AND (?6 IS NULL OR el.source=?6)) landing_visits,
      (SELECT COUNT(DISTINCT e.account_id) FROM analytics_events e LEFT JOIN campaign_distribution_links el ON el.invitation_id=e.invitation_id
        LEFT JOIN growth_campaigns ec ON ec.id=el.campaign_id WHERE e.event_name='auth_completed' AND e.occurred_at>=?1 AND e.occurred_at<?2
        AND (?4 IS NULL OR ec.id=?4 OR ec.campaign_key=?4) AND (?5 IS NULL OR el.channel=?5) AND (?6 IS NULL OR el.source=?6)) authenticated,
      COUNT(*) enrolled,COUNT(CASE WHEN activated_at IS NOT NULL THEN 1 END) activated,
      COUNT(CASE WHEN activated_at IS NOT NULL AND datetime(activated_at,'+21 days')<=?3 THEN 1 END) week2_eligible,
      COUNT(CASE WHEN activated_at IS NOT NULL AND datetime(activated_at,'+21 days')<=?3 AND EXISTS(
        SELECT 1 FROM analytics_activity_days ad WHERE ad.account_id=cohort.account_id AND ad.activity_kind='meaningful'
        AND ad.activity_date>=date(activation_date,'+14 days') AND ad.activity_date<date(activation_date,'+21 days')) THEN 1 END) week2_retained,
      AVG(CASE WHEN activated_at IS NOT NULL THEN (julianday(activated_at)-julianday(acquired_at))*24 END) avg_activation_hours
    FROM cohort`).bind(fromAt,toExclusive,asOf,campaign,channel,source).first<Record<string,number|null>>();
  const funnel={landingVisits:numberValue(funnelRow?.landing_visits),authenticated:numberValue(funnelRow?.authenticated),enrolled:numberValue(funnelRow?.enrolled),
    activated:numberValue(funnelRow?.activated),week2Eligible:numberValue(funnelRow?.week2_eligible),week2Retained:numberValue(funnelRow?.week2_retained),
    averageActivationHours:funnelRow?.avg_activation_hours===null?null:Number(funnelRow?.avg_activation_hours),
    landingConversionReliable:numberValue(funnelRow?.landing_visits)>=numberValue(funnelRow?.enrolled)&&numberValue(funnelRow?.landing_visits)>0};
  const cohorts=(await db.prepare(`WITH activation AS (
      SELECT account_id,MIN(first_at) activated_at,MIN(activity_date) activation_date FROM analytics_activity_days WHERE activity_kind='meaningful' GROUP BY account_id
    ) SELECT date(v.activation_date,'-' || ((CAST(strftime('%w',v.activation_date) AS INTEGER)+6)%7) || ' days') cohort_start,
      COUNT(*) cohort_size,
      SUM(datetime(v.activated_at,'+14 days')<=?3) week1_eligible,
      SUM(datetime(v.activated_at,'+14 days')<=?3 AND EXISTS(SELECT 1 FROM analytics_activity_days d WHERE d.account_id=v.account_id AND d.activity_kind='meaningful' AND d.activity_date>=date(v.activation_date,'+7 days') AND d.activity_date<date(v.activation_date,'+14 days'))) week1_retained,
      SUM(datetime(v.activated_at,'+21 days')<=?3) week2_eligible,
      SUM(datetime(v.activated_at,'+21 days')<=?3 AND EXISTS(SELECT 1 FROM analytics_activity_days d WHERE d.account_id=v.account_id AND d.activity_kind='meaningful' AND d.activity_date>=date(v.activation_date,'+14 days') AND d.activity_date<date(v.activation_date,'+21 days'))) week2_retained,
      SUM(datetime(v.activated_at,'+35 days')<=?3) week4_eligible,
      SUM(datetime(v.activated_at,'+35 days')<=?3 AND EXISTS(SELECT 1 FROM analytics_activity_days d WHERE d.account_id=v.account_id AND d.activity_kind='meaningful' AND d.activity_date>=date(v.activation_date,'+28 days') AND d.activity_date<date(v.activation_date,'+35 days'))) week4_retained
    FROM activation v JOIN account_attribution a ON a.account_id=v.account_id
    LEFT JOIN campaign_distribution_links l ON l.invitation_id=a.acquisition_invitation_id LEFT JOIN growth_campaigns c ON c.id=l.campaign_id
    WHERE v.activated_at>=?1 AND v.activated_at<?2 AND (?4 IS NULL OR c.id=?4 OR c.campaign_key=?4)
      AND (?5 IS NULL OR l.channel=?5) AND (?6 IS NULL OR l.source=?6)
    GROUP BY cohort_start ORDER BY cohort_start DESC`).bind(fromAt,toExclusive,asOf,campaign,channel,source).all<Record<string,unknown>>()).results
    .map(row=>{const cohortSize=numberValue(row.cohort_size),privacySuppressed=cohortSize>0&&cohortSize<state.small_cohort_min;
      const window=(eligible:unknown,retained:unknown)=>privacySuppressed?null:{eligible:numberValue(eligible),retained:numberValue(retained),rate:rate(numberValue(retained),numberValue(eligible))};
      return {cohortStart:String(row.cohort_start),cohortSize:privacySuppressed?null:cohortSize,cohortSizeBand:privacySuppressed?`<${state.small_cohort_min}`:null,
        privacySuppressed,week1:window(row.week1_eligible,row.week1_retained),week2:window(row.week2_eligible,row.week2_retained),week4:window(row.week4_eligible,row.week4_retained)};});
  const adoption=(await db.prepare(`WITH cohort AS (
      SELECT a.account_id FROM account_attribution a
      LEFT JOIN campaign_distribution_links l ON l.invitation_id=a.acquisition_invitation_id
      LEFT JOIN growth_campaigns c ON c.id=l.campaign_id
      WHERE a.acquired_at>=?1 AND a.acquired_at<?2
        AND (?5 IS NULL OR c.id=?5 OR c.campaign_key=?5) AND (?6 IS NULL OR l.channel=?6) AND (?7 IS NULL OR l.source=?7)
    )
    SELECT d.feature,d.activity_kind,COUNT(DISTINCT d.account_id) accounts,SUM(d.event_count) events
    FROM analytics_activity_days d JOIN cohort c USING(account_id) WHERE d.activity_date>=?3 AND d.activity_date<=?4
    GROUP BY d.feature,d.activity_kind ORDER BY accounts DESC`).bind(fromAt,toExclusive,from,to,campaign,channel,source).all<Record<string,unknown>>()).results
    .map(row=>{const accounts=numberValue(row.accounts),privacySuppressed=accounts>0&&accounts<state.small_cohort_min;
      return {feature:String(row.feature),kind:String(row.activity_kind),privacySuppressed,accounts:privacySuppressed?null:accounts,
        accountsBand:privacySuppressed?`<${state.small_cohort_min}`:null,events:privacySuppressed?null:numberValue(row.events),adoptionRate:privacySuppressed?null:rate(accounts,funnel.enrolled)};});
  const filterRows=(await db.prepare(`SELECT DISTINCT c.id campaign_id,c.campaign_key,c.name campaign,l.channel,l.source
    FROM growth_campaigns c JOIN campaign_distribution_links l ON l.campaign_id=c.id ORDER BY c.name,l.channel,l.source`).all<Record<string,string>>()).results;
  const semesterUsage=await db.prepare(`WITH selected AS (
      SELECT s.account_id,s.period_key FROM analytics_semester_usage s JOIN account_attribution a ON a.account_id=s.account_id
      LEFT JOIN campaign_distribution_links l ON l.invitation_id=a.acquisition_invitation_id LEFT JOIN growth_campaigns c ON c.id=l.campaign_id
      WHERE (?1 IS NULL OR c.id=?1 OR c.campaign_key=?1) AND (?2 IS NULL OR l.channel=?2) AND (?3 IS NULL OR l.source=?3)
    ), per_account AS (SELECT account_id,COUNT(DISTINCT period_key) periods FROM selected GROUP BY account_id)
    SELECT (SELECT COUNT(DISTINCT period_key) FROM selected) periods,
      COALESCE(SUM(CASE WHEN periods>=2 THEN 1 ELSE 0 END),0) retained_accounts FROM per_account`).bind(campaign,channel,source)
    .first<{periods:number;retained_accounts:number}>();
  const semesterPeriods=numberValue(semesterUsage?.periods),semesterAccounts=numberValue(semesterUsage?.retained_accounts),
    semesterSuppressed=semesterAccounts>0&&semesterAccounts<state.small_cohort_min,semesterAvailable=semesterPeriods>=2&&!semesterSuppressed;
  return {taxonomyVersion:state.taxonomy_version,trackingStartedAt:state.tracking_started_at,range:{from,to,asOf,timezone:"Australia/Sydney"},
    privacy:{smallCohortMinimum:state.small_cohort_min,retentionDays:state.retention_days},filters:{campaign,channel,source,options:filterRows},
    kpis:{directEnrolments:funnel.enrolled,activated:funnel.activated,activationRate:rate(funnel.activated,funnel.enrolled),
      week2Eligible:funnel.week2Eligible,week2Retained:funnel.week2Retained,week2RetentionRate:rate(funnel.week2Retained,funnel.week2Eligible),
      trackedLandingVisits:funnel.landingVisits},funnel,performance:rows,cohorts,adoption,
    crossSemester:{available:semesterAvailable,periods:semesterPeriods,accounts:semesterAvailable?semesterAccounts:null,
      accountsBand:semesterSuppressed?`<${state.small_cohort_min}`:null,privacySuppressed:semesterSuppressed,
      message:semesterSuppressed?"A returning cross-semester group exists, but its size is privacy-suppressed.":semesterPeriods>=2?"Counts accounts with activity in at least two distinct academic periods.":"Not yet measured: at least two academic periods are required."},
    insights:insights(rows,funnel,state.small_cohort_min),definitions:{
      activation:"First server-observed semester import or meaningful saved planning/task action; login and passive views do not activate an account.",
      retention:"Among activated students, meaningful activity on days 7–13 (Week 1), 14–20 (Week 2), or 28–34 (Week 4) after activation.",
      landingVisits:"Estimated distinct tab-scoped visitors. No fingerprint, IP identity or cross-session tracking is used.",
      directEnrolments:"Exact immutable first-touch D1 account attribution. Existing-user friend connections are excluded.",
      referralAmplification:"Activated downstream friend-referral descendants divided by directly activated students for the root distribution link.",
      teachingWeeks:"Not yet classified; academic breaks are not automatically interpreted as churn."},
    availability:{socialImpressions:"unavailable",copyLinkShares:"unavailable",coursePlanning:"not instrumented in staging",teachingWeekClassification:"not yet configured"}};
}
