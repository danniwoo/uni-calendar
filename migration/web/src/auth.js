import { createClient } from "@supabase/supabase-js";

export function pilotClient(config) {
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: { flowType:"pkce", detectSessionInUrl:false, persistSession:true, autoRefreshToken:true,
      storageKey:`semester-staging-auth-${new URL(config.supabaseUrl).hostname}` },
  });
}
