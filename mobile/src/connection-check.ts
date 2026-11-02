// Status-only diagnostic for the existing site. No response bodies, credentials,
// user identifiers or semester records are read or retained here.
export const SITE_ORIGIN =
  "https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
export const API_CHECK_URL = `${SITE_ORIGIN}/api/semester`;
export const SITE_SIGN_IN_URL = `${SITE_ORIGIN}/signin-with-chatgpt?return_to=%2F`;
// Used only to observe a return. The current site does not implement this handoff.
// Receiving this URL is never accepted as proof of authentication.
export const CONNECTION_RETURN_URL = "semester-preview://connection-check";

export type ConnectionResult = {
  kind:
    | "json-response"
    | "sign-in-needed"
    | "denied"
    | "head-unsupported"
    | "redirected"
    | "not-api"
    | "server-error"
    | "inconclusive"
    | "timeout"
    | "network-error"
    | "cancelled";
  status?: number;
};

export function classifyConnection(
  status: number,
  contentType: string,
  finalUrl: string,
): ConnectionResult {
  if (status === 401) return { kind: "sign-in-needed", status };
  if (status === 403) return { kind: "denied", status };
  if (status === 405 || status === 501)
    return { kind: "head-unsupported", status };
  if (status >= 500) return { kind: "server-error", status };
  if (status >= 300 && status < 400) return { kind: "redirected", status };
  if (finalUrl) {
    try {
      const url = new URL(finalUrl);
      if (url.origin !== SITE_ORIGIN || url.pathname !== "/api/semester")
        return { kind: "redirected", status };
    } catch {
      return { kind: "inconclusive", status };
    }
  }
  if (status >= 200 && status < 300) {
    if (!/^application\/json(?:\s*;|$)/i.test(contentType))
      return { kind: "not-api", status };
    return { kind: finalUrl ? "json-response" : "inconclusive", status };
  }
  return { kind: "inconclusive", status };
}

export async function checkNativeConnection({
  fetcher = fetch,
  timeoutMs = 12000,
  signal,
}: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
} = {}): Promise<ConnectionResult> {
  if (signal?.aborted) return { kind: "cancelled" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const stopped = new Promise<ConnectionResult>((resolve) => {
    cancel = () => {
      resolve({ kind: "cancelled" });
      controller.abort();
    };
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      resolve({ kind: "timeout" });
      controller.abort();
    }, timeoutMs);
  });
  const request = (async (): Promise<ConnectionResult> => {
    try {
      const response = await fetcher(API_CHECK_URL, {
        method: "HEAD",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      return classifyConnection(
        response.status,
        response.headers.get("content-type") || "",
        response.url,
      );
    } catch {
      return { kind: "network-error" };
    }
  })();
  try {
    return await Promise.race([stopped, request]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function connectionLabel(result?: ConnectionResult) {
  if (!result) return "Not checked";
  const labels: Record<ConnectionResult["kind"], string> = {
    "json-response": "API responded · identity unverified",
    "sign-in-needed": "API requires sign-in",
    denied: "API access denied · reason unverified",
    "head-unsupported": "Status-only check unsupported",
    redirected: "Request redirected · no API session confirmed",
    "not-api": "Website response · no API session confirmed",
    "server-error": "Service unavailable · try again later",
    inconclusive: "Inconclusive response",
    timeout: "Check timed out",
    "network-error": "Could not reach the service",
    cancelled: "Check cancelled",
  };
  return `${labels[result.kind]}${result.status ? ` (${result.status})` : ""}`;
}
