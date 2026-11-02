import { createRemoteJWKSet, jwtVerify, errors, type JWTVerifyGetKey } from "jose";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function configuredIssuer(supabaseUrl: string): string {
  let url: URL;
  try { url = new URL(supabaseUrl); } catch { throw new ApiError(503, "not_configured", "The test service is not configured yet."); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new ApiError(503, "not_configured", "The test service is not configured yet.");
  }
  return `${url.origin}/auth/v1`;
}

export async function authenticate(request: Request, supabaseUrl: string, testKey?: JWTVerifyGetKey) {
  const issuer = configuredIssuer(supabaseUrl);
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s]+$/i.test(header) || header.length > 16_384) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }
  let key = testKey ?? keySets.get(issuer);
  if (!key) {
    key = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
      cacheMaxAge: 600_000,
      cooldownDuration: 30_000,
      timeoutDuration: 5_000,
    });
    keySets.set(issuer, key as ReturnType<typeof createRemoteJWKSet>);
  }
  try {
    const { payload } = await jwtVerify(header.slice(7), key, {
      issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
      requiredClaims: ["sub", "exp", "iat", "session_id", "role"],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || !uuid.test(payload.sub)
        || typeof payload.session_id !== "string" || !uuid.test(payload.session_id)
        || payload.role !== "authenticated" || payload.is_anonymous !== false) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }
    // Identity comes only from verified issuer+sub, never email/user_metadata.
    return { issuer, subject: payload.sub };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
      throw new ApiError(401, "unauthorized", "Your session could not be verified. Sign in again.");
    }
    throw new ApiError(503, "auth_unavailable", "Sign-in verification is temporarily unavailable. Try again.");
  }
}
