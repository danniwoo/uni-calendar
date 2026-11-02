import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chunkedSessionStorage } from "./secure-session-storage";

test("pinned SDK exchanges the active S256 PKCE flow, persists securely and removes local session on sign-out",async()=>{
  const values=new Map<string,string>();let suffix=0,challenge="",codeExchanged=false;
  const storage=chunkedSessionStorage({getItem:async k=>values.get(k)??null,setItem:async(k,v)=>{values.set(k,v);},removeItem:async k=>{values.delete(k);}},()=>`g-${++suffix}`);
  const userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const encoded=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const token=`${encoded({alg:"RS256",typ:"JWT"})}.${encoded({sub:userId,exp:Math.floor(Date.now()/1000)+3600,role:"authenticated"})}.test-only-signature`;
  const client=createClient("https://example.supabase.co","sb_publishable_test",{
    auth:{flowType:"pkce",storage,storageKey:"test-session",autoRefreshToken:false,detectSessionInUrl:false,persistSession:true},
    global:{fetch:async(url,init)=>{
      const path=new URL(String(url)).pathname;
      if(path.endsWith("/token")){
        const body=JSON.parse(String(init?.body));
        assert.equal(body.auth_code,"test-code");
        assert.equal(createHash("sha256").update(body.code_verifier).digest("base64url"),challenge);
        codeExchanged=true;
        return Response.json({access_token:token,refresh_token:"test-refresh",expires_in:3600,token_type:"bearer",user:{id:userId,aud:"authenticated",email:"test@example.invalid",created_at:"2026-11-02T00:00:00Z",app_metadata:{},user_metadata:{}}});
      }
      if(path.endsWith("/logout")) return new Response(null,{status:204});
      throw Error(`Unexpected SDK route ${path}`);
    }},
  });
  const started=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:"semester-preview://auth/callback",skipBrowserRedirect:true}});
  assert.equal(started.error,null); assert.ok(started.data.url); assert.ok(started.data.flowId);
  const url=new URL(started.data.url!); challenge=url.searchParams.get("code_challenge")!;
  assert.equal(url.searchParams.get("code_challenge_method"),"s256");
  assert.equal(url.searchParams.get("redirect_to"),"semester-preview://auth/callback");
  const exchanged=await client.auth.exchangeCodeForSession("test-code",{flowId:started.data.flowId!});
  assert.equal(exchanged.error,null);assert.equal(codeExchanged,true);assert.equal(exchanged.data.session?.user.id,userId);
  assert.equal((await client.auth.getSession()).data.session?.access_token,token);
  assert.equal((await client.auth.signOut({scope:"local"})).error,null);
  assert.equal((await client.auth.getSession()).data.session,null);
  assert.equal(values.size,0,"secure session and PKCE chunks are removed");
});
