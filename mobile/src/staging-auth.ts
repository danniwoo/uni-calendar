import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { chunkedSessionStorage } from "./secure-session-storage";
import { callbackCode, STAGING_AUTH_REDIRECT, stagingConfig } from "./staging-core";

export const stagingSetup = stagingConfig({
  // Expo substitutes only explicit process.env.EXPO_PUBLIC_* references.
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  apiUrl: process.env.EXPO_PUBLIC_SEMESTER_API_URL,
});

function enableNativePkceCrypto() {
  // Supabase otherwise falls back to a plain PKCE challenge on Hermes. Supply
  // native secure randomness and SHA-256, leaving existing WebCrypto intact.
  const crypto = globalThis.crypto ?? ({} as Crypto);
  if (!crypto.getRandomValues) Object.defineProperty(crypto, "getRandomValues", { value: ExpoCrypto.getRandomValues });
  if (!crypto.subtle) Object.defineProperty(crypto, "subtle", { value: {
    async digest(algorithm: string | { name: string }, input: BufferSource) {
      if ((typeof algorithm === "string" ? algorithm : algorithm.name) !== "SHA-256") throw new Error("Unsupported digest.");
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input);
    },
  }});
  if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: crypto });
  if (typeof TextEncoder === "undefined") throw new Error("This app build does not support secure sign-in. Rebuild the native app.");
}

// SDK flow-storage keys can contain ':'; Keychain keys cannot. Hex encoding
// avoids collisions and retains one private namespace for this staging client.
const nativeKey = (key: string) => `semester.staging.${Array.from(key).map(c=>c.codePointAt(0)!.toString(16)).join("-")}`;
const storage = chunkedSessionStorage({
  getItem: key => SecureStore.getItemAsync(nativeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(nativeKey(key), value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: key => SecureStore.deleteItemAsync(nativeKey(key)),
}, () => ExpoCrypto.randomUUID());
let client: SupabaseClient | undefined;
export function getStagingClient(): SupabaseClient {
  if (!stagingSetup.config) throw new Error(stagingSetup.error);
  if (Platform.OS !== "ios" && Platform.OS !== "android") throw new Error("Use the separate web proof for browser testing.");
  if (!client) {
    enableNativePkceCrypto();
    client = createClient(stagingSetup.config.supabaseUrl, stagingSetup.config.publishableKey, {
      auth: { storage, storageKey: `semester-staging-${new URL(stagingSetup.config.supabaseUrl).hostname}`,
        flowType: "pkce", autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

let signInInProgress = false;
export async function signInStagingGoogle(isCurrent: () => boolean): Promise<"signed-in" | "cancelled"> {
  // Closing/reopening the proof screen cannot start competing exchanges on the
  // singleton client while its previous system browser is still completing.
  if (signInInProgress) throw new Error("A sign-in attempt is still finishing. Please retry shortly.");
  signInInProgress = true;
  try { return await runGoogleSignIn(isCurrent); }
  finally { signInInProgress = false; }
}

async function runGoogleSignIn(isCurrent: () => boolean): Promise<"signed-in" | "cancelled"> {
  const auth = getStagingClient().auth;
  const { data, error } = await auth.signInWithOAuth({ provider: "google", options: {
    redirectTo: STAGING_AUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: "select_account" },
  }});
  if (error || !data.url) throw new Error("Google sign-in is not available. Check the staging provider setup and try again.");
  if (!isCurrent()) return "cancelled";
  // Fail closed if a future SDK/native runtime loses S256 support.
  if (new URL(data.url).searchParams.get("code_challenge_method")?.toLowerCase() !== "s256")
    throw new Error("Secure sign-in is unavailable in this app build.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, STAGING_AUTH_REDIRECT);
  if (!isCurrent() || result.type !== "success") return "cancelled";
  const code = callbackCode(result.url);
  // Pin the exchange to this flow's verifier (SDK 2.118.0 supports per-flow PKCE).
  const exchanged = await auth.exchangeCodeForSession(code, data.flowId ? { flowId: data.flowId } : undefined);
  if (exchanged.error || !exchanged.data.session) throw new Error("Sign-in could not be completed. Please try again.");
  if (!isCurrent()) { await auth.signOut({ scope: "local" }); return "cancelled"; }
  return "signed-in";
}
