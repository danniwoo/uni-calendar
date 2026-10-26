"use client";
import {useEffect,useMemo,useState} from "react";
import type {Semester} from "@/lib/semester";
import {readCanvasBundle,suggestCanvasMatches,planCanvasImport} from "@/lib/canvas-import";
import {canvasUpdateStatus,canvasResultsHeadline} from "@/lib/canvas-update-status";

type Inbox={enabled:boolean;raw:string|null;message:string;canCheckAll:boolean;checking:boolean;courseCount:number};
export function CanvasInbox({semester,onReview,reviewOpen}:{semester:Semester;onReview:(raw:string)=>void;reviewOpen:boolean}) {
  const [inbox,setInbox]=useState<Inbox|null>(null),[dismissed,setDismissed]=useState<string|null>(null);
  useEffect(()=>{
    const receive=(e:MessageEvent)=>{
      if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-connect-inbox-v1")return;
      const value=e.data.inbox;
      if(!value||typeof value.enabled!=="boolean"||typeof value.message!=="string"||value.message.length>500||!(value.raw===null||typeof value.raw==="string"&&value.raw.length<=1500000))return;
      setInbox({enabled:value.enabled,raw:value.raw,message:value.message,canCheckAll:value.canCheckAll===true,checking:value.checking===true,courseCount:Number.isInteger(value.courseCount)&&value.courseCount>0&&value.courseCount<=8?value.courseCount:0});
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
  if(!inbox)return null;
  if(dismissed===(inbox.raw||inbox.message))return <div className="canvas-history-notice"><button onClick={()=>setDismissed(null)}>Show pending Canvas check</button></div>;
  return <section className="notice canvas-inbox" aria-label="Canvas update check" aria-live="polite">
    <div><strong>Semester Connect · {inbox.enabled?"review before saving":"checks off"}</strong><p>{inbox.message}</p>
      {preview?.error?<p className="error">{preview.error} Nothing imported. Use the correct account / JSON file.</p>:preview?.status?<>
        <p><strong>{canvasResultsHeadline(preview.status.grades.length,preview.status.resultsToConnect.length)}</strong>{preview.status.resultsToConnect.length?` · ${preview.status.resultsToConnect.length} to match to an assessment`:""}{preview.status.protected.length?` · ${preview.status.protected.length} manual entries kept`:""}{preview.status.attention.length?` · ${preview.status.attention.length} rule changes to review`:""}</p>
        <details><summary>Last read by course · {preview.bundle.courses.length} courses</summary>{preview.bundle.courses.map(c=><p key={c.course.id}>{c.course.code} · {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney{c.marksPageUnavailable?" · Marks page unavailable":""}</p>)}</details><small>Check all reads every selected course using one signed-in Canvas tab. No need to refresh each Marks page. Nothing saved.</small>
      </>:null}
    </div>
    <div>{inbox.enabled&&inbox.canCheckAll&&inbox.courseCount>0&&<button disabled={inbox.checking} onClick={()=>{setInbox({...inbox,checking:true,message:"Starting all-course check… Keep your signed-in Canvas tab open."});window.postMessage({type:"semester-connect-check-all-v1"},location.origin);}}>{inbox.checking?"Checking courses…":`Check all ${inbox.courseCount} courses`}</button>}{inbox.raw&&!preview?.error&&<button disabled={reviewOpen||inbox.checking} onClick={()=>onReview(inbox.raw!)}>Review Canvas updates</button>}<button onClick={()=>setDismissed(inbox.raw||inbox.message)}>Dismiss</button></div>
  </section>;
}
