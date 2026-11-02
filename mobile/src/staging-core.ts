export const STAGING_AUTH_REDIRECT = "semester-preview://auth/callback";

export type StagingConfig = { supabaseUrl: string; publishableKey: string; apiUrl: string };
export type StagingSemester = {
  semester: {
    id: string;
    title: string;
    weekLabel: string;
    assessments: { id: string; unitCode: string; title: string; dueAt: string; weightLabel: string }[];
    tasks: { id: string; title: string; unitCode: string; completed: boolean }[];
  };
  revision: number;
};

export function stagingConfig(values: { supabaseUrl?: string; publishableKey?: string; apiUrl?: string }):
  { config: StagingConfig; error?: never } | { config?: never; error: string } {
  if (!values.supabaseUrl || !values.publishableKey || !values.apiUrl)
    return { error: "The staging environment is not configured in this build yet." };
  try {
    const auth = new URL(values.supabaseUrl), api = new URL(values.apiUrl);
    const originOnly = (url: URL) => !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
    if (!originOnly(auth) || auth.protocol !== "https:" || !originOnly(api)
      || (api.protocol !== "https:" && !(api.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)))
      || !values.publishableKey.startsWith("sb_publishable_"))
      return { error: "Staging configuration needs valid service origins and a Supabase publishable key." };
    return { config: { supabaseUrl: auth.origin, publishableKey: values.publishableKey, apiUrl: api.origin } };
  } catch { return { error: "Staging configuration contains an invalid URL." }; }
}

// A callback code alone never establishes identity; exchange it with the SDK's
// locally stored PKCE verifier. Never accept access tokens from a URL fragment.
export function callbackCode(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "semester-preview:" || parsed.hostname !== "auth" || parsed.pathname !== "/callback"
    || parsed.username || parsed.password || parsed.port || parsed.hash)
    throw new Error("The sign-in return address was not recognised.");
  if (parsed.searchParams.has("error")) throw new Error("Google sign-in was not completed. Please try again.");
  const codes = parsed.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) throw new Error("The sign-in response did not include a valid code.");
  return codes[0];
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 2000;
export function readStagingSemester(value: unknown): StagingSemester {
  if (!record(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !record(value.semester))
    throw new Error("The API returned an unsupported semester response.");
  const s = value.semester;
  if (![s.id, s.title, s.weekLabel].every(text) || !Array.isArray(s.assessments) || s.assessments.length > 100
    || !s.assessments.every(a => record(a) && [a.id,a.unitCode,a.title,a.dueAt,a.weightLabel].every(text) && Number.isFinite(Date.parse(a.dueAt as string)))
    || !Array.isArray(s.tasks) || s.tasks.length > 100 || !s.tasks.every(t => record(t) && [t.id,t.title,t.unitCode].every(text) && typeof t.completed === "boolean")
    || new Set(s.tasks.map(t => t.id)).size !== s.tasks.length || new Set(s.assessments.map(a => a.id)).size !== s.assessments.length)
    throw new Error("The API returned an unsupported semester response.");
  return value as StagingSemester;
}

export class StagingApiError extends Error {
  constructor(public status: number) {
    super(status === 401 ? "Your session expired. Sign in again." : status === 403 ? "This account does not have access to the staging pilot."
      : status === 409 ? "This task changed on another device. Refresh before trying again."
      : status === 404 ? "No test semester has been created for this account yet."
      : "The staging API could not complete this request. Please try again.");
  }
}

export async function stagingRequest(config: StagingConfig, token: string, path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<unknown> {
  if (!token || !/^\/v1\/[a-zA-Z0-9/_%-]+$/.test(path)) throw new Error("A valid session and API route are required.");
  const response = await (options.fetcher ?? fetch)(`${config.apiUrl}${path}`, {
    method: options.method ?? "GET", signal: options.signal,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store", redirect: "error",
  });
  if (!response.ok) throw new StagingApiError(response.status);
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The staging API did not return JSON.");
  return response.json();
}

// All asynchronous work belongs to the current account generation. Even a
// request which ignores AbortSignal cannot publish a result after sign-out.
export class AccountRequestGate {
  private generation = 0;
  private account: string | null = null;
  private controllers = new Set<AbortController>();
  change(account: string | null) {
    if (account === this.account) return;
    this.invalidate(); this.account = account;
  }
  invalidate() { this.generation++; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  start() {
    const generation = this.generation, account = this.account, controller = new AbortController();
    this.controllers.add(controller);
    return { signal: controller.signal, current: () => generation === this.generation && account === this.account && account !== null,
      cancel: () => controller.abort(),
      finish: () => this.controllers.delete(controller) };
  }
}
