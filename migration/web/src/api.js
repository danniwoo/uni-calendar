export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validBoard(value) {
  const s = value?.semester;
  const string = x => typeof x === "string";
  return Number.isSafeInteger(value?.revision) && value.revision > 0 && s &&
    string(s.id) && string(s.title) && string(s.weekLabel) &&
    Array.isArray(s.assessments) && s.assessments.every(a => a && [a.id, a.unitCode, a.title, a.dueAt, a.weightLabel].every(string)) &&
    Array.isArray(s.tasks) && s.tasks.every(t => t && [t.id, t.title, t.unitCode].every(string) && typeof t.completed === "boolean");
}

export function createApi(baseUrl, fetcher = fetch) {
  const request = async (path, session, { method = "GET", body, signal } = {}) => {
    if (!session?.access_token || !session?.user?.id) throw new ApiError(401, "signed_out", "Sign in to continue.");
    const response = await fetcher(`${baseUrl}${path}`, {
      method, signal, cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let payload;
    try { payload = await response.json(); } catch { throw new ApiError(response.status, "invalid_response", "The API returned an unreadable response."); }
    if (!response.ok) throw new ApiError(response.status, payload?.error?.code || "request_failed", safeMessage(response.status));
    return payload;
  };
  const boardRequest = async (...args) => {
    const value = await request(...args);
    if (!validBoard(value)) throw new ApiError(502, "invalid_board", "The API returned an unexpected semester format.");
    return value;
  };
  return {
    async session(session, signal) {
      const value = await request("/v1/session", session, { signal });
      if (typeof value?.accountId !== "string" || !value.accountId) throw new ApiError(502, "invalid_account", "The API returned an unexpected account format.");
      return value;
    },
    get: (session, signal) => boardRequest("/v1/semester", session, { signal }),
    seed: (session, signal) => boardRequest("/v1/semester/sample", session, { method: "POST", signal }),
    update: (session, taskId, completed, expectedRevision, signal) => boardRequest(`/v1/tasks/${encodeURIComponent(taskId)}`, session, { method: "PATCH", body: { completed, expectedRevision }, signal }),
  };
}

function safeMessage(status) {
  if (status === 401) return "Your API session was rejected. Sign out and sign in again.";
  if (status === 403) return "This account is not allowed to use the test API.";
  if (status === 404) return "No test semester was found.";
  if (status === 409) return "This semester changed on another device.";
  if (status === 429) return "Too many requests. Please try again shortly.";
  return "The request did not succeed. Please try again.";
}
