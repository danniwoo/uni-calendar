import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { getStagingClient, signInStagingGoogle, stagingSetup } from "./staging-auth";
import { AccountRequestGate, readStagingSemester, StagingApiError, stagingRequest, type StagingSemester } from "./staging-core";
import { CloudWidgetBridge, emptyCloudWidget, type CloudWidgetState } from "./cloud-widget";
import CloudDeadlineWidget from "./widgets/CloudDeadline";

// Owned by the app root: closing the connection sheet must not stop account
// clearing or foreground refresh for a widget that remains on the Lock Screen.
export function useStagingConnection() {
  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<StagingSemester>();
  const [accountId, setAccountId] = useState("");
  const [phase, setPhase] = useState("");
  const [message, setMessage] = useState("");
  const [noBoard, setNoBoard] = useState(false);
  const mounted = useRef(true), busy = useRef(false), authRun = useRef(0);
  const signOutRequested=useRef(false);
  const user = useRef<string | null>(null), gate = useRef(new AccountRequestGate());
  const [widgetState,setWidgetState] = useState<CloudWidgetState>({props:emptyCloudWidget()});
  const bridge = useRef<CloudWidgetBridge | null>(null);
  if (!bridge.current) bridge.current = new CloudWidgetBridge(
    `${stagingSetup.config?.supabaseUrl}|${stagingSetup.config?.apiUrl}`,AsyncStorage,
    timeline=>CloudDeadlineWidget.updateTimeline(timeline),state=>{if(mounted.current)setWidgetState(state);});
  const refreshWanted=useRef(false), refresh=useRef<()=>void>(()=>{});
  refresh.current=()=>{ if(busy.current) refreshWanted.current=true; else if(user.current) void request("load"); };
  const widgetWork=async(work:Promise<void>)=>{
    try {await work;} catch {if(mounted.current)setWidgetState(state=>({...state,error:"Could not save or clear the widget cache. Reopen Semester to retry."}));}
  };
  function finishOperation() {
    busy.current=false;
    if(!mounted.current)return;
    setPhase("");
    if(refreshWanted.current) {refreshWanted.current=false; refresh.current();}
  }

  useEffect(() => {
    mounted.current = true;
    if (!stagingSetup.config) { void widgetWork(bridge.current!.clear("Connect cloud work")); return () => { mounted.current = false; }; }
    try {
      const client = getStagingClient();
      const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
        if (!mounted.current) return;
        if(signOutRequested.current && next) return;
        const nextId = next?.user.id ?? null;
        const identityChanged=nextId !== user.current;
        if (identityChanged) {
          gate.current.change(nextId); user.current = nextId;
          setBoard(undefined); setAccountId(""); setNoBoard(false); setMessage("");
        }
        setSession(next);
        // Keep the SDK callback synchronous; auth calls happen after it returns.
        if(identityChanged || event==="INITIAL_SESSION" || event==="SIGNED_IN" || event==="SIGNED_OUT") {
          void widgetWork(bridge.current!.changeSubject(nextId)).then(()=>{
            if(mounted.current && user.current===nextId && nextId) setTimeout(()=>{if(mounted.current)refresh.current();},0);
          });
        }
      });
      void client.auth.getSession().then(({error}) => {
        if (error && mounted.current) {setMessage("Your saved session could not be restored. Sign in again.");void widgetWork(bridge.current!.clear("Sign in again"));}
      }).catch(() => { if (mounted.current) {setMessage("Secure session storage is unavailable. Rebuild the app or try again.");void widgetWork(bridge.current!.clear("Sign in again"));} });
      const active = (state: string) => {
        if (state === "active") {client.auth.startAutoRefresh();bridge.current!.refreshDisplay();refresh.current();}
        else client.auth.stopAutoRefresh();
      };
      active(AppState.currentState);
      const listener = AppState.addEventListener("change", active);
      const clock=setInterval(()=>{if(AppState.currentState==="active")bridge.current!.refreshDisplay();},60000);
      return () => { mounted.current = false; authRun.current++; gate.current.invalidate(); subscription.unsubscribe(); listener.remove();clearInterval(clock);client.auth.stopAutoRefresh(); };
    } catch {
      setMessage("The native staging dependencies are not available. Rebuild the iPhone app before testing.");
      void widgetWork(bridge.current!.clear("Open Semester to reconnect"));
      return () => { mounted.current = false; };
    }
  }, []);

  async function login() {
    if (busy.current) return;
    busy.current = true; signOutRequested.current=false; setPhase("Opening Google sign-in…"); setMessage("");
    const run = ++authRun.current;
    try {
      const result = await signInStagingGoogle(() => mounted.current && run === authRun.current);
      if (mounted.current) {setMessage(result === "signed-in" ? "Signed in. Loading cloud work…" : "Sign-in cancelled.");if(result==="signed-in")refreshWanted.current=true;}
    } catch { if (mounted.current) setMessage("Sign-in could not finish. Check the Google provider and callback configuration, then retry."); }
    finally { finishOperation(); }
  }

  async function signOut() {
    if (busy.current) return;
    busy.current = true; signOutRequested.current=true; authRun.current++; gate.current.change(null); user.current = null;
    refreshWanted.current=false;
    // Remove the entire native timeline before waiting for network revocation.
    void widgetWork(bridge.current!.changeSubject(null));
    setBoard(undefined); setAccountId(""); setNoBoard(false); setSession(null); setPhase("Signing out…"); setMessage("");
    try {
      const { error } = await getStagingClient().auth.signOut({ scope: "local" });
      if (mounted.current) setMessage(error ? "Local data cleared. Session revocation could not be confirmed; retry when online." : "Signed out of this device. Test data remains in your staging account.");
    } catch { if (mounted.current) setMessage("Session removal could not finish. Retry sign-out before sharing this device."); }
    finally { finishOperation(); }
  }

  async function request(action: "load" | "create" | "toggle", taskId?: string) {
    if (busy.current || !stagingSetup.config || !user.current) return;
    busy.current = true; const scope = gate.current.start(), expectedUser = user.current;
    const timeout=setTimeout(()=>scope.cancel(),15000);
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
      setBoard(next); setNoBoard(false); setMessage(action === "toggle" ? "Preparation updated." : "Cloud semester is up to date.");
      await widgetWork(bridge.current!.accept(expectedUser,identity.accountId,next));
    } catch (error) {
      if (!scope.current()) return;
      if (error instanceof StagingApiError && error.status === 404 && action === "load") { setNoBoard(true); setBoard(undefined); }
      if (error instanceof StagingApiError && [401,403].includes(error.status)) { setBoard(undefined); setAccountId(""); }
      if(error instanceof StagingApiError && [401,403,404,409].includes(error.status))
        await widgetWork(bridge.current!.clear([401,403].includes(error.status)?"Sign in to reconnect":"Refresh cloud work"));
      else bridge.current!.unavailable();
      if(!scope.current())return;
      setMessage(error instanceof StagingApiError ? error.message : "Could not reach or read the staging API. Check the connection and retry.");
      // A stale response must never be automatically retried as an update.
      if (error instanceof StagingApiError && error.status === 409) setBoard(undefined);
    } finally {clearTimeout(timeout);scope.finish();finishOperation();}
  }

  return {session,board,accountId,phase,message,noBoard,login,signOut,request,widgetState};
}
export type StagingConnectionState = ReturnType<typeof useStagingConnection>;
