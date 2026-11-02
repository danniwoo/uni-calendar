import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { getStagingClient, signInStagingGoogle, stagingSetup } from "./staging-auth";
import { AccountRequestGate, readStagingSemester, StagingApiError, stagingRequest, type StagingSemester } from "./staging-core";

export default function StagingConnection() {
  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<StagingSemester>();
  const [accountId, setAccountId] = useState("");
  const [phase, setPhase] = useState("");
  const [message, setMessage] = useState("");
  const [noBoard, setNoBoard] = useState(false);
  const mounted = useRef(true), busy = useRef(false), authRun = useRef(0);
  const user = useRef<string | null>(null), gate = useRef(new AccountRequestGate());

  useEffect(() => {
    mounted.current = true;
    if (!stagingSetup.config) return () => { mounted.current = false; };
    try {
      const client = getStagingClient();
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
        if (!mounted.current) return;
        const nextId = next?.user.id ?? null;
        if (nextId !== user.current) {
          gate.current.change(nextId); user.current = nextId;
          setBoard(undefined); setAccountId(""); setNoBoard(false); setMessage("");
        }
        setSession(next);
      });
      void client.auth.getSession().then(({error}) => {
        if (error && mounted.current) setMessage("Your saved session could not be restored. Sign in again.");
      }).catch(() => { if (mounted.current) setMessage("Secure session storage is unavailable. Rebuild the app or try again."); });
      const active = (state: string) => { if (state === "active") client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); };
      active(AppState.currentState);
      const listener = AppState.addEventListener("change", active);
      return () => { mounted.current = false; authRun.current++; gate.current.invalidate(); subscription.unsubscribe(); listener.remove(); client.auth.stopAutoRefresh(); };
    } catch {
      setMessage("The native staging dependencies are not available. Rebuild the iPhone app before testing.");
      return () => { mounted.current = false; };
    }
  }, []);

  async function login() {
    if (busy.current) return;
    busy.current = true; setPhase("Opening Google sign-in…"); setMessage("");
    const run = ++authRun.current;
    try {
      const result = await signInStagingGoogle(() => mounted.current && run === authRun.current);
      if (mounted.current) setMessage(result === "signed-in" ? "Signed in. Load your test semester to check API access." : "Sign-in cancelled.");
    } catch { if (mounted.current) setMessage("Sign-in could not finish. Check the Google provider and callback configuration, then retry."); }
    finally { busy.current = false; if (mounted.current) setPhase(""); }
  }

  async function signOut() {
    if (busy.current) return;
    busy.current = true; authRun.current++; gate.current.change(null); user.current = null;
    setBoard(undefined); setAccountId(""); setNoBoard(false); setSession(null); setPhase("Signing out…"); setMessage("");
    try {
      const { error } = await getStagingClient().auth.signOut({ scope: "local" });
      if (mounted.current) setMessage(error ? "Local data cleared. Session revocation could not be confirmed; retry when online." : "Signed out of this device. Test data remains in your staging account.");
    } catch { if (mounted.current) setMessage("Session removal could not finish. Retry sign-out before sharing this device."); }
    finally { busy.current = false; if (mounted.current) setPhase(""); }
  }

  async function request(action: "load" | "create" | "toggle", taskId?: string) {
    if (busy.current || !stagingSetup.config || !user.current) return;
    busy.current = true; const scope = gate.current.start(), expectedUser = user.current;
    setPhase(action === "toggle" ? "Saving task…" : "Checking your staging API…"); setMessage("");
    try {
      const { data, error } = await getStagingClient().auth.getSession();
      if (error || !data.session || data.session.user.id !== expectedUser) throw new StagingApiError(401);
      if (!scope.current()) return;
      const config = stagingSetup.config, token = data.session.access_token;
      const call = (path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => stagingRequest(config,token,path,{method,body,signal:scope.signal});
      const identity = await call("/v1/session") as {accountId?: unknown};
      if (!identity || typeof identity.accountId !== "string" || !identity.accountId) throw new Error("Invalid identity response");
      if (!scope.current()) return;
      setAccountId(identity.accountId);
      let value: unknown;
      if (action === "toggle") {
        const task = board?.semester.tasks.find(t=>t.id===taskId);
        if (!task || !board) return;
        value = await call(`/v1/tasks/${encodeURIComponent(task.id)}`,"PATCH",{completed:!task.completed,expectedRevision:board.revision});
      } else value = await call(action === "create" ? "/v1/semester/sample" : "/v1/semester",action === "create" ? "POST" : "GET");
      const next = readStagingSemester(value);
      if (!scope.current()) return;
      setBoard(next); setNoBoard(false); setMessage(action === "toggle" ? "Saved to D1. Refresh the web proof to compare." : "Authenticated API access confirmed. This is synthetic test data.");
    } catch (error) {
      if (!scope.current()) return;
      if (error instanceof StagingApiError && error.status === 404 && action === "load") { setNoBoard(true); setBoard(undefined); }
      if (error instanceof StagingApiError && [401,403].includes(error.status)) { setBoard(undefined); setAccountId(""); }
      setMessage(error instanceof StagingApiError ? error.message : "Could not reach or read the staging API. Check the connection and retry.");
      // A stale response must never be automatically retried as an update.
      if (error instanceof StagingApiError && error.status === 409) setBoard(undefined);
    } finally { scope.finish(); busy.current = false; if (mounted.current) setPhase(""); }
  }

  const button = (label: string, action: () => void, secondary = false) => <Pressable accessibilityRole="button" disabled={!!phase} onPress={action}
    style={({pressed})=>[s.button,secondary&&s.secondary,(pressed||!!phase)&&{opacity:.5}]}><Text style={[s.buttonText,secondary&&{color:"#584AA5"}]}>{label}</Text></Pressable>;
  return <View style={s.root}>
    <Text style={s.title}>Connect the test semester.</Text>
    <Text style={s.body}>Google sign-in → shared test data on Web and iPhone.</Text>
    {!stagingSetup.config ? <View style={s.panel}><Text style={s.heading}>Setup needed</Text><Text style={s.body}>{stagingSetup.error}</Text>
      <Text style={s.caption}>The build needs the Supabase project URL, publishable key and independent staging API URL. Your current sample app still works.</Text></View> : <>
      <Text style={s.caption}>STAGING · SYNTHETIC RECORDS</Text>
      {session ? <>
        <Text style={s.body}>Signed in as {session.user.email ?? "your test account"}</Text>
        {button("Load / refresh test semester",()=>void request("load"))}
        {noBoard && button("Create my sample semester",()=>void request("create"),true)}
        {accountId ? <Text style={s.caption}>API identity verified · {accountId.slice(0,8)}…</Text> : null}
        {board && <View style={s.panel}>
          <Text style={s.heading}>{board.semester.title}</Text><Text style={s.caption}>{board.semester.weekLabel} · revision {board.revision}</Text>
          <Text style={s.heading}>Deadlines</Text>
          {board.semester.assessments.map(a=><View key={a.id} style={s.row}><Text style={s.body}>{a.unitCode} · {a.title}</Text><Text style={s.caption}>{new Date(a.dueAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} · Sydney · {a.weightLabel}</Text></View>)}
          <Text style={s.heading}>Test preparation</Text>
          {board.semester.tasks.map(t=><Pressable key={t.id} accessibilityRole="checkbox" accessibilityState={{checked:t.completed,disabled:!!phase}} disabled={!!phase}
            onPress={()=>void request("toggle",t.id)} style={s.row}><Text style={s.body}>{t.completed?"☑":"☐"} {t.title}</Text><Text style={s.caption}>{t.unitCode}</Text></Pressable>)}
        </View>}
        {button("Sign out of this device",()=>void signOut(),true)}
      </> : <>{button("Continue with Google",()=>void login())}
        {!!message && button("Clear saved session",()=>void signOut(),true)}</>}
    </>}
    {!!phase && <View style={s.progress}><ActivityIndicator color="#584AA5"/><Text style={s.body}>{phase}</Text></View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
    <Text style={s.caption}>This proof keeps cloud test data separate from your sample screens and personal tasks. Existing widgets still show sample data; a cloud widget connection is the next step.</Text>
  </View>;
}

const s=StyleSheet.create({root:{gap:14},title:{fontSize:28,fontWeight:"700",color:"#252438"},body:{fontSize:14,lineHeight:21,color:"#252438"},heading:{fontSize:16,fontWeight:"700",color:"#252438"},caption:{fontSize:12,lineHeight:18,color:"#716E80"},panel:{backgroundColor:"white",padding:16,borderRadius:14,borderWidth:1,borderColor:"#E6E3EB",gap:12},row:{paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#E6E3EB"},button:{minHeight:46,backgroundColor:"#584AA5",borderRadius:12,alignItems:"center",justifyContent:"center",padding:12},buttonText:{fontSize:14,fontWeight:"600",color:"white"},secondary:{backgroundColor:"#EFEBFA"},progress:{flexDirection:"row",gap:10,alignItems:"center"}});
