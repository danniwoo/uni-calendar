import { ApiError, authenticate } from "./auth.ts";
import { readTodayPlan, saveTodayPlan } from "./today-plan.ts";
import { currentRecovery, restoreRecovery } from "./recovery.ts";
import { maxRecoveryBytes } from "../../recovery.ts";
import { exportBackup, getImportedAssessments, setImportedCompletion, maxBackupBytes, requireMember, storeBackup } from "./backup.ts";
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
        const methods = ["/health", "/v1/session", "/v1/semester", "/v1/imported/assessments"].includes(path) ? ["GET"]
          : path === "/v1/imported/completion" ? ["PATCH"] : path === "/v1/today/plan" ? ["GET", "PATCH"] : backup || recovery ? ["GET", "POST"] : path === "/v1/semester/sample" ? ["POST"] : taskMatch ? ["PATCH"] : [];
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
        const identity = await authenticate(request, env.SUPABASE_URL, testKey);
        const accountId = await resolveAccount(env.DB, identity);
        if (recovery) {
          await requireMember(env.DB,accountId,recovery[1]);
          return send(request.method==="GET" ? await currentRecovery(env.DB,accountId)
            : await restoreRecovery(env.DB,accountId,await jsonBody(request,maxRecoveryBytes*2+1024)));
        }
        if (path === "/v1/today/plan") return send(request.method === "GET"
          ? await readTodayPlan(env.DB,accountId) : await saveTodayPlan(env.DB,accountId,await jsonBody(request,256_000)));
        if (path === "/v1/imported/completion") return send(await setImportedCompletion(env.DB,accountId,await jsonBody(request,8192)));
        if (path === "/v1/imported/assessments") return send(await getImportedAssessments(env.DB, accountId));
        if (backup) {
          await requireMember(env.DB, accountId, backup[1]);
          if (request.method === "GET") return new Response(await exportBackup(env.DB, accountId), { headers });
          if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
            throw new ApiError(415, "json_required", "Choose a JSON backup.");
          const result = await storeBackup(env.DB, accountId, await boundedText(request, maxBackupBytes));
          return send(result, result.created ? 201 : 200);
        }
        if (path === "/v1/session") return send({ accountId });
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
        return send(await updateTask(env.DB, accountId, taskMatch![1], body.completed, Number(body.expectedRevision)));
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
