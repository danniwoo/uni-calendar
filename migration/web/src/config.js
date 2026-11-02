export function readConfig(env) {
  const values = {
    supabaseUrl: env.VITE_SUPABASE_URL?.trim() || "",
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "",
    apiUrl: env.VITE_SEMESTER_API_URL?.trim() || "",
  };
  const problems = [];
  for (const [field, label] of [["supabaseUrl", "Supabase project URL"], ["apiUrl", "Semester API URL"]]) {
    try {
      const url = new URL(values[field]);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
      values[field] = url.origin;
    } catch { problems.push(`Set a valid ${label} (HTTPS, or local HTTP).`); }
  }
  // Require the modern publishable key; reject secret/admin JWTs rather than
  // accepting an arbitrary string that could be bundled into the browser.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(values.publishableKey)) {
    problems.push("Set the Supabase publishable key (starts with sb_publishable_). Never use a secret key.");
  }
  return { ...values, problems, ready: problems.length === 0 };
}

export function takeAuthCallback(href) {
  const url = new URL(href);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const failed = url.searchParams.has("error") || url.searchParams.has("error_code") || url.searchParams.has("access_token") || url.searchParams.has("refresh_token");
  const fragment = new URLSearchParams(url.hash.slice(1));
  const implicit = fragment.has("access_token") || fragment.has("refresh_token");
  const authFragment = implicit || fragment.has("error") || fragment.has("error_code");
  for (const key of ["code", "sb_flow_id", "error", "error_code", "error_description", "access_token", "refresh_token", "token_type", "expires_in", "expires_at"]) url.searchParams.delete(key);
  if (authFragment) url.hash = "";
  return { code, flowId, failed: failed || authFragment, cleanUrl: url.pathname + url.search + url.hash };
}
