import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { focusTimeline, neutralFocus, ownsFocusTimeline } from "./deadline-focus";
import { readImportedAssessments, type ImportedAssessments } from "./imported-work";
import { stagingSetup } from "./staging-auth";
import { stagingRequest, StagingApiError } from "./staging-core";
import DeadlineFocus from "./widgets/DeadlineFocus";
import type { StagingConnectionState } from "./useStagingConnection";

type Loaded = {subject:string; scope:string; board:ImportedAssessments; syncedAt:number};
export function useImportedSemester({session,authReady}: StagingConnectionState) {
  const [loaded,setLoaded] = useState<Loaded>();
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(true);
  const [widgetIssue,setWidgetIssue] = useState("");
  const [reload,setReload] = useState(0);
  const previous = useRef<string|null|undefined>(undefined);
  const checkedScope = useRef<string | undefined>(undefined);
  const subject = session?.user.id ?? null;
  const token = session?.access_token;
  useEffect(() => {
    const config = stagingSetup.config;
    if (config && !authReady) return;
    let active = true;
    const publishNeutral = (title:string) => {
      try {DeadlineFocus.updateSnapshot(neutralFocus(title));}
      catch {if(active)setWidgetIssue("Reopen Semester to refresh the widget.");}
    };
    const changed = subject !== previous.current;
    if(changed) {
      checkedScope.current = undefined;
      setLoaded(undefined); setMessage(""); setWidgetIssue("");
      if(previous.current !== undefined || !subject) publishNeutral(subject ? "Loading deadlines" : "Sign in to Semester");
      previous.current = subject;
    }
    if (!config || !subject || !token) {
      setLoading(false);
      return;
    }
    const control = new AbortController();
    const timeout = setTimeout(()=>control.abort(),15000);
    setLoading(true); setMessage("");
    async function load() {
      try {
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,
          JSON.stringify(["semester-deadline",config!.supabaseUrl,config!.apiUrl,subject]));
        if (!active) return;
        const scope = hash.slice(0,32);
        if (checkedScope.current !== scope) {
          // A cold start may be offline. Keep only the verified account's already
          // scheduled timeline. No auth data or full board is saved in the App Group.
          const prior = await DeadlineFocus.getTimeline().catch(()=>[]);
          if (!active) return;
          if (!ownsFocusTimeline(prior, scope)) publishNeutral("Loading deadlines");
          checkedScope.current = scope;
        }
        const value = await stagingRequest(config!,token!,"/v1/imported/assessments",{signal:control.signal});
        const board = readImportedAssessments(value);
        if (!active) return;
        const syncedAt = Date.now();
        setLoaded({subject:subject!,scope,board,syncedAt});
        try {DeadlineFocus.updateTimeline(focusTimeline(board.rows,scope,syncedAt)); setWidgetIssue("");}
        catch {setWidgetIssue("Reopen Semester to refresh the widget.");}
      } catch(error) {
        if (!active) return;
        const status = error instanceof StagingApiError ? error.status : 0;
        if ([401,403,404].includes(status)) {
          setLoaded(undefined);
          publishNeutral(status===404 ? "Import your semester" : "Sign in to Semester");
        }
        setMessage(status===404 ? "No imported semester yet. Import your saved semester on the staging website."
          : status===403 ? "This account is not enrolled in the private import trial."
          : status===401 ? "Your session expired. Sign in again from Widgets."
          : "Could not refresh your imported semester. Check your connection and retry.");
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return ()=>{active=false; control.abort(); clearTimeout(timeout);};
  },[authReady,subject,token,reload]);
  useEffect(()=>{
    const listener=AppState.addEventListener("change",state=>{if(state==="active")setReload(n=>n+1);});
    return ()=>listener.remove();
  },[]);
  const owned = loaded?.subject === subject ? loaded : undefined;
  return {board:owned?.board, scope:owned?.scope, syncedAt:owned?.syncedAt,
    message, loading, widgetIssue, refresh:()=>setReload(n=>n+1)};
}
export type ImportedSemesterState = ReturnType<typeof useImportedSemester>;
