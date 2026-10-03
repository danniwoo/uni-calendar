import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB) throw new Error("Saved progress is temporarily unavailable.");
  return env.DB;
}
