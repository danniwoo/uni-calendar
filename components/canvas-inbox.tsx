"use client";
import {useEffect,useMemo,useState} from "react";
import type {Semester} from "@/lib/semester";
import {readCanvasBundle,suggestCanvasMatches,planCanvasImport} from "@/lib/canvas-import";
import {canvasUpdateStatus} from "@/lib/canvas-update-status";

type Inbox={enabled:boolean;raw:string|null;message:string};
export function CanvasInbox({semester,onReview,reviewOpen}:{semester:Semester;onReview:(raw:string)=>void;reviewOpen:boolean}) {
  const [inbox,setInbox]=useState<Inbox|null>(null),[dismissed,setDismissed]=useState<string|null>(null);
  useEffect(()=>{
    const receive=(e:MessageEvent)=>{
      if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-connect-inbox-v1")return;
      const value=e.data.inbox;
      if(!value||typeof value.enabled!=="boolean"||typeof value.message!=="string"||value.message.length>500||!(value.raw===null||typeof value.raw==="string"&&value.raw.length<=1500000))return;
      setInbox({enabled:value.enabled,raw:value.raw,message:value.message});
    };
    const request=()=>window.postMessage({type:"semester-connect-request-v1"},location.origin);
    window.addEventListener("message",receive);window.addEventListener("focus",request);request();
    return()=>{window.removeEventListener("message",receive);window.removeEventListener("focus",request);};
  },[]);
  const preview=useMemo(()=>{
    if(!inbox?.raw)return null;
    try {
      const bundle=readCanvasBundle(inbox.raw),choices=Object.values(suggestCanvasMatches(semester,bundle).choices),plan=planCanvasImport(semester,bundle,choices);
      return {bundle,status:canvasUpdateStatus(semester,bundle,choices,plan.actions),error:""};
    } catch(e){return {error:(e as Error).message};}
  },[inbox,semester]);
  // No connected extension is a normal state: the existing JSON entry remains.
  if(!inbox||dismissed===(inbox.raw||inbox.message))return null;
  return <section className="notice canvas-inbox" aria-label="Canvas update check" aria-live="polite">
    <div><strong>Semester Connect · {inbox.enabled?"review before saving":"checks off"}</strong><p>{inbox.message}</p>
      {preview?.error?<p className="error">{preview.error} Nothing imported. Use the correct account / JSON file.</p>:preview?.status?<>
        <p><strong>{preview.status.grades.length} new / updated results</strong> · {preview.status.unmatched.length} not matched · {preview.status.protected.length} manual entries protected{preview.status.attention.length?` · ${preview.status.attention.length} rule changes to review`:""}</p>
        <small>Canvas account {preview.bundle.accountId} · {preview.bundle.courses.length} courses checked · each course’s read time is shown in review. Other courses are unchanged. Nothing saved.</small>
      </>:null}
    </div>
    <div>{inbox.raw&&!preview?.error&&<button disabled={reviewOpen} onClick={()=>onReview(inbox.raw!)}>Review Canvas updates</button>}<button onClick={()=>setDismissed(inbox.raw||inbox.message)}>Dismiss</button></div>
  </section>;
}
