import { getWebBoard, saveWebBoard } from "./web-board.ts";
import { ApiError, authenticate } from "./auth.ts";
import { readTodayPlan, saveTodayPlan } from "./today-plan.ts";
import { currentRecovery, restoreRecovery } from "./recovery.ts";
import { maxRecoveryBytes } from "../../recovery.ts";
import { exportBackup, getImportedAssessments, setImportedCompletion, maxBackupBytes, requireMember, storeBackup } from "./backup.ts";
import {accessStatus,previewInvitation,redeemInvitation,requireAccess} from "./access.ts";
import {changeFriendship,createFriendInvitation,readFriends,requestFriend,revokeFriendInvitation,saveFriendProfile} from "./friends.ts";
import {adminSession,changeAccountAccess,createCampaign,createCampaignLink,createPrivateInvitation,publishPolicy,
  readAdminDashboard,revokeAdminInvitation,revokeCampaign,savePolicyDraft} from "./admin.ts";
import {analyticsBestEffort,analyticsPeriodKey,readAdminAnalytics,recordActivity,recordAuthenticatedSession,recordLanding} from "./analytics.ts";
import { createSample, getSemester, resolveAccount, updateTask, type SqlDatabase } from "./store.ts";
import type { JWTVerifyGetKey } from "jose";

export interface Env {
  DB: SqlDatabase;
  SUPABASE_URL: string;
  ALLOWED_ORIGINS: string;
  PILOT_WEB_URL?: string;
}

function origins(value: string): Set<string> {
  const result = new Set<string>();
  for (const item of value.split(",").map(value => value.trim()).filter(Boolean)) {
    let url: URL;
    try { url = new URL(item); } catch { throw new ApiError(503, "not_configured", "The test service is not configured yet."); }
    if (url.origin !== item || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new ApiError(503, "not_configured", "The test service is not configured yet.");
    }
    result.add(item);
  }
  return result;
}

async function boundedText(request: Request, limit = 2048): Promise<string> {
  // Bound streamed bytes as well as Content-Length; the header is untrusted.
  let length = 0;
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ApiError(413, "body_too_large", "This update is too large."); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new ApiError(400, "invalid_json", "Send valid UTF-8 text."); }
}

async function jsonBody(request: Request, limit = 2048): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new ApiError(415, "json_required", "Send an application/json request.");
  }
  const text = await boundedText(request,limit);
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new ApiError(400, "invalid_json", "Send a valid JSON object."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "invalid_json", "Send a valid JSON object.");
  return value as Record<string, unknown>;
}

// Key injection is available to local tests only through code, never an HTTP
// input, env variable, test bypass header or production configuration setting.
export function createApi(testKey?: JWTVerifyGetKey) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff" });
      const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
      try {
        const origin = request.headers.get("origin");
        if (origin) {
          if (!origins(env.ALLOWED_ORIGINS ?? "").has(origin)) throw new ApiError(403, "origin_not_allowed", "This website is not allowed to access the test service.");
          headers.set("Access-Control-Allow-Origin", origin);
        }
        const path = new URL(request.url).pathname;
        if (env.PILOT_WEB_URL && ["/","/index.html"].includes(path) && ["GET","HEAD"].includes(request.method)) {
          // The old pilot link is a landing-page alias. Auth callbacks belong to Pages.
          return Response.redirect(env.PILOT_WEB_URL,302);
        }
        const backup = path.match(/^\/v1\/backup-trial\/([0-9a-f-]{36})$/);
        const recovery = path.match(/^\/v1\/recovery\/([0-9a-f-]{36})$/);
        const taskMatch = path.match(/^\/v1\/tasks\/([a-zA-Z0-9_-]{1,100})$/);
        const methods = ["/health", "/v1/session", "/v1/semester", "/v1/imported/assessments", "/v1/friends", "/v1/admin/session", "/v1/admin", "/v1/admin/analytics"].includes(path) ? ["GET"]
          : path === "/v1/access/invitation" || path === "/v1/access/redeem" || path === "/v1/analytics/landing" || path === "/v1/analytics/session" ? ["POST"]
          : path === "/v1/admin/policy/draft" ? ["PATCH"]
          : ["/v1/admin/policy/publish","/v1/admin/invitations","/v1/admin/invitations/revoke","/v1/admin/campaigns",
              "/v1/admin/campaign-links","/v1/admin/campaigns/revoke","/v1/admin/users/access"].includes(path) ? ["POST"]
          : path === "/v1/friends/profile" ? ["PATCH"]
          : path === "/v1/friends/invitation" ? ["POST","DELETE"]
          : path === "/v1/friends/request" || path === "/v1/friends/action" ? ["POST"]
          : path === "/v1/imported/board" ? ["GET","PUT"] : path === "/v1/imported/completion" ? ["PATCH"] : path === "/v1/today/plan" ? ["GET", "PATCH"] : backup || recovery ? ["GET", "POST"] : path === "/v1/semester/sample" ? ["POST"] : taskMatch ? ["PATCH"] : [];
        if (!methods.length) throw new ApiError(404, "not_found", "This endpoint does not exist.");
        if (request.method === "OPTIONS") {
          const wanted = request.headers.get("access-control-request-method") ?? "";
          const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "").toLowerCase().split(",").map(v => v.trim()).filter(Boolean);
          if (!origin || !methods.includes(wanted) || requestedHeaders.some(h => !["authorization", "content-type"].includes(h))) {
            throw new ApiError(403, "preflight_not_allowed", "This request is not allowed.");
          }
          headers.set("Access-Control-Allow-Methods", methods.join(", "));
          headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
          return new Response(null, { status: 204, headers });
        }
        if (!methods.includes(request.method)) { headers.set("Allow", methods.join(", ")); throw new ApiError(405, "method_not_allowed", "This method is not supported."); }
        if (path === "/health") return send({ status: "ok", mode: "synthetic-pilot" });
        if(path==="/v1/analytics/landing")return send(await recordLanding(env.DB,await jsonBody(request,1024)),202);
        if (path === "/v1/access/invitation") {
          const body=await jsonBody(request,512);
          if(Object.keys(body).some(key=>key!=="token"))throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
          return send(await previewInvitation(env.DB,body.token));
        }
        const identity = await authenticate(request, env.SUPABASE_URL, testKey);
        const accountId = await resolveAccount(env.DB, identity);
        if(path==="/v1/analytics/session")return send(await recordAuthenticatedSession(env.DB,accountId,await jsonBody(request,512)),202);
        if(path === "/v1/session")return send({accountId,access:await accessStatus(env.DB,accountId)});
        if(path === "/v1/access/redeem") {
          const body=await jsonBody(request,512);
          if(Object.keys(body).some(key=>key!=="token"))throw new ApiError(400,"invitation_invalid","This invitation link is not valid.");
          return send(await redeemInvitation(env.DB,accountId,body.token));
        }
        // Authentication maps identity only. Every academic route below also
        // requires an active Semester enrolment.
        await requireAccess(env.DB,accountId);
        if(path==="/v1/admin/session")return send(await adminSession(env.DB,accountId));
        if(path==="/v1/admin")return send(await readAdminDashboard(env.DB,accountId));
        if(path==="/v1/admin/analytics")return send(await readAdminAnalytics(env.DB,accountId,new URL(request.url).searchParams));
        if(path==="/v1/admin/policy/draft")return send(await savePolicyDraft(env.DB,accountId,await jsonBody(request,16_384)));
        if(path==="/v1/admin/policy/publish")return send(await publishPolicy(env.DB,accountId,await jsonBody(request,2048)));
        if(path==="/v1/admin/invitations")return send(await createPrivateInvitation(env.DB,accountId,env.PILOT_WEB_URL??[...origins(env.ALLOWED_ORIGINS)][0]??"",await jsonBody(request,2048)),201);
        if(path==="/v1/admin/invitations/revoke")return send(await revokeAdminInvitation(env.DB,accountId,await jsonBody(request,512)));
        if(path==="/v1/admin/campaigns")return send(await createCampaign(env.DB,accountId,env.PILOT_WEB_URL??[...origins(env.ALLOWED_ORIGINS)][0]??"",await jsonBody(request,4096)),201);
        if(path==="/v1/admin/campaign-links")return send(await createCampaignLink(env.DB,accountId,env.PILOT_WEB_URL??[...origins(env.ALLOWED_ORIGINS)][0]??"",await jsonBody(request,4096)),201);
        if(path==="/v1/admin/campaigns/revoke")return send(await revokeCampaign(env.DB,accountId,await jsonBody(request,512)));
        if(path==="/v1/admin/users/access")return send(await changeAccountAccess(env.DB,accountId,await jsonBody(request,1024)));
        if(path==="/v1/friends")return send(await readFriends(env.DB,accountId));
        if(path==="/v1/friends/profile")return send(await saveFriendProfile(env.DB,accountId,await jsonBody(request,512)));
        if(path==="/v1/friends/invitation") {
          const result=request.method==="POST"?await createFriendInvitation(env.DB,accountId,env.PILOT_WEB_URL??[...origins(env.ALLOWED_ORIGINS)][0]??"")
            :await revokeFriendInvitation(env.DB,accountId,await jsonBody(request,512));
          if(request.method==="POST"&&"id" in result)await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"friends","social","friend_link_created",`friend-link:${accountId}:${result.id}`));
          return send(result);
        }
        if(path==="/v1/friends/request") {
          const result=await requestFriend(env.DB,accountId,await jsonBody(request,512));
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"friends","social","friend_request_sent",`friend-request:${accountId}:${result.connectionId}`));
          return send(result);
        }
        if(path==="/v1/friends/action") {
          const body=await jsonBody(request,512),result=await changeFriendship(env.DB,accountId,body);
          if(body.operation==="accept")await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"friends","social","friend_request_accepted",`friend-accept:${String(body.connectionId)}`));
          return send(result);
        }
        if (path === "/v1/imported/board") {
          if(request.method==="GET") {const result=await getWebBoard(env.DB,accountId);await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"semester_board","passive",null,null));return send(result);}
          const body=await jsonBody(request,1_800_000),result=await saveWebBoard(env.DB,accountId,body),period=analyticsPeriodKey(JSON.stringify(body.semester));
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"semester_board","meaningful","semester_board_saved",`board-save:${accountId}:${result.revision}`,period));
          return send(result);
        }
        if (recovery) {
          await requireMember(env.DB,accountId,recovery[1]);
          if(request.method==="GET")return send(await currentRecovery(env.DB,accountId));
          const body=await jsonBody(request,maxRecoveryBytes*2+1024),result=await restoreRecovery(env.DB,accountId,body),period=typeof body.file==="string"?analyticsPeriodKey(body.file):null;
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"semester_import","meaningful","semester_imported",`recovery-import:${accountId}:${result.sha256}`,period));
          return send(result);
        }
        if (path === "/v1/today/plan") {
          if(request.method==="GET")return send(await readTodayPlan(env.DB,accountId));
          const result=await saveTodayPlan(env.DB,accountId,await jsonBody(request,256_000));
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"today_plan","meaningful","today_plan_saved",`today-plan:${accountId}:${result.revision}`));
          return send(result);
        }
        if (path === "/v1/imported/completion") {const result=await setImportedCompletion(env.DB,accountId,await jsonBody(request,8192));
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"task_completion","meaningful","task_completion_saved",`completion:${accountId}:${result.id}:${result.revision}`));return send(result);}
        if (path === "/v1/imported/assessments") {const result=await getImportedAssessments(env.DB, accountId);
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"assessment_view","passive",null,null));return send(result);}
        if (backup) {
          await requireMember(env.DB, accountId, backup[1]);
          if (request.method === "GET") return new Response(await exportBackup(env.DB, accountId), { headers });
          if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
            throw new ApiError(415, "json_required", "Choose a JSON backup.");
          const text=await boundedText(request,maxBackupBytes),result=await storeBackup(env.DB,accountId,text);
          await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"semester_import","meaningful","semester_imported",`backup-import:${accountId}:${result.sha256}`,analyticsPeriodKey(text)));
          return send(result, result.created ? 201 : 200);
        }
        if (path === "/v1/semester") return send(await getSemester(env.DB, accountId));
        if (path === "/v1/semester/sample") {
          const body = await boundedText(request);
          if (body.trim() !== "" && body.trim() !== "{}") throw new ApiError(400, "invalid_request", "Sample creation does not accept data or an owner.");
          return send(await createSample(env.DB, accountId));
        }
        const body = await jsonBody(request);
        if (Object.keys(body).some(k => !["completed", "expectedRevision"].includes(k))
            || typeof body.completed !== "boolean" || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1) {
          throw new ApiError(400, "invalid_update", "Send completed and a positive integer expectedRevision.");
        }
        const result=await updateTask(env.DB, accountId, taskMatch![1], body.completed, Number(body.expectedRevision));
        await analyticsBestEffort(()=>recordActivity(env.DB,accountId,"task_completion","meaningful","task_completion_saved",`pilot-task:${accountId}:${taskMatch![1]}:${result.revision}`));
        return send(result);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401) headers.set("WWW-Authenticate", "Bearer");
          return send({ error: { code: error.code, message: error.message } }, error.status);
        }
        // Do not log tokens, SQL values or private records, nor expose internals.
        return send({ error: { code: "service_unavailable", message: "The test service is temporarily unavailable. Try again." } }, 503);
      }
    },
  };
}

export default createApi();
