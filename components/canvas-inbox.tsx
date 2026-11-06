"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Semester} from "@/lib/semester";
import {canvasGrade,canvasKey,canvasResultLabel,readCanvasBundle,planCanvasImport} from "@/lib/canvas-import";
import {prepareCanvasImport} from "@/lib/canvas-prepare";
import {canvasUpdateStatus,canvasResultsHeadline,canvasCheckFreshness} from "@/lib/canvas-update-status";

const CONNECT_VERSION="0.5.1";
type Inbox={enabled:boolean;extensionVersion?:string;raw:string|null;message:string;canCheckAll:boolean;checking:boolean;courseCount:number};
const needsCanvas=(message:string)=>/open one signed-in Canvas|Canvas login expired|Canvas tab changed or closed/i.test(message);
const checkFailed=(message:string)=>/failed|incomplete|expired|no new check|limited|interrupted/i.test(message);
export function CanvasInbox({semester,onReview,reviewOpen,onImportFile}:{semester:Semester;onReview:(raw:string)=>void;reviewOpen:boolean;onImportFile?:()=>void}) {
  const [inbox,setInbox]=useState<Inbox|null>(null),[details,setDetails]=useState(false),[retrying,setRetrying]=useState(false),[retried,setRetried]=useState(false);
  const freshRequest=useRef(true),lastCheck=useRef(0),reviewing=useRef(reviewOpen);
  const returnIntent=useRef(false),resume=useRef(false);
  reviewing.current=reviewOpen;
  useEffect(()=>{if(!retrying)return;const timer=setTimeout(()=>setRetrying(false),2000);return()=>clearTimeout(timer);},[retrying]);
  useEffect(()=>{
    let resumedCheck=false,retryAllowed=false,retryTimer:ReturnType<typeof setTimeout>|undefined;
    const receive=(e:MessageEvent)=>{
      if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-connect-inbox-v1")return;
      const value=e.data.inbox;
      if(!value||typeof value.enabled!=="boolean"||typeof value.message!=="string"||value.message.length>500||!(value.raw===null||typeof value.raw==="string"&&value.raw.length<=1500000))return;
      setInbox({enabled:value.enabled,extensionVersion:typeof value.extensionVersion==="string"&&/^\d+\.\d+\.\d+$/.test(value.extensionVersion)?value.extensionVersion:undefined,raw:value.raw,message:value.message,canCheckAll:value.canCheckAll===true,checking:value.checking===true,courseCount:Number.isInteger(value.courseCount)&&value.courseCount>0&&value.courseCount<=8?value.courseCount:0});
      setRetrying(false);setRetried(false);
      if(resumedCheck&&!value.checking){
        resumedCheck=false;
        // A real but expired Canvas login can consume Connect's one-minute
        // allowance. Retry that user-requested return once, never poll.
        if(retryAllowed&&value.enabled&&value.canCheckAll&&value.message.includes("limited to once a minute")){
          retryAllowed=false;
          retryTimer=setTimeout(()=>{resume.current=true;if(!document.hidden)focus();},60000);
        }
      }
      // At most one fresh read on arrival/return, never a timer or receipt loop.
      // Consent/course IDs stay in Connect. Opening a review never auto-imports.
      if(freshRequest.current){
        freshRequest.current=false;
        const requested=resume.current;
        resume.current=false;
        if(value.enabled&&value.canCheckAll&&Number.isInteger(value.courseCount)&&value.courseCount>0&&value.courseCount<=8&&!value.checking&&!reviewing.current&&(requested||Date.now()-lastCheck.current>=60000)){
          try{
            const batch=value.raw?readCanvasBundle(value.raw):null;
            if(requested||canvasCheckFreshness(batch,value.courseCount).needsCheck){
              resumedCheck=requested;
              lastCheck.current=Date.now();
              setInbox(old=>old?{...old,checking:true}:old);
              window.postMessage({type:"semester-connect-check-all-v1"},location.origin);
            }
          }catch{/* Invalid previews require attention, not an automatic retry. */}
        }
      }
    };
    const request=()=>window.postMessage({type:"semester-connect-request-v1"},location.origin);
    const focus=()=>{if(document.visibilityState==="hidden")return;if(returnIntent.current){clearTimeout(retryTimer);retryAllowed=true;resume.current=true;returnIntent.current=false;}freshRequest.current=true;request();};
    window.addEventListener("message",receive);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);request();
    return()=>{clearTimeout(retryTimer);window.removeEventListener("message",receive);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[]);
  const preview=useMemo(()=>{
    if(!inbox?.raw)return null;
    try {
      const bundle=readCanvasBundle(inbox.raw),choices=Object.values(prepareCanvasImport(semester,bundle).choices),plan=planCanvasImport(semester,bundle,choices);
      const status=canvasUpdateStatus(semester,bundle,choices,plan.actions);
      const graded=new Set(status.grades.map(a=>a.key)),added=new Set(status.otherChanges.filter(a=>a.kind==="added").map(a=>a.key));
      const results=bundle.courses.flatMap(c=>c.assignments.flatMap(a=>{
        const key=canvasKey(bundle,c.course.id,a.id);
        return graded.has(key)||(added.has(key)&&canvasGrade(a))||status.resultsToConnect.some(r=>r.key===`${c.course.id}:${a.id}`)?[`${c.course.code} · ${a.name} · ${canvasResultLabel(a)}`]:[];
      }));
      return {bundle,status,results,error:""};
    } catch(e){return {error:(e as Error).message};}
  },[inbox,semester]);
  const connected=!!inbox?.enabled;
  const attention=preview?.status?new Set(preview.status.attention.map(a=>a.targetId||a.key)).size:0;
  const resultCount=preview?.results?.length||0;
  const headline=preview?.status?canvasResultsHeadline(resultCount,0,attention):"";
  const freshness=canvasCheckFreshness(preview?.bundle||null,inbox?.courseCount||0);
  const openCanvas=!connected||needsCanvas(inbox.message);
  const failed=!!inbox&&checkFailed(inbox.message);
  const displayResults=connected&&!inbox.checking&&!openCanvas&&!failed&&!preview?.error&&resultCount>0;
  // Missing bridge response, empty preview and disabled checks are distinct.
  // None of them removes the connection entry or changes saved course consent.
  return <section className="canvas-connect-entry" aria-label="Canvas connection">
    <div className="canvas-connect-row"><div className="canvas-connect-status"><strong>Canvas</strong><span role="status">{inbox?.checking?"Checking courses…":openCanvas?(connected?"Open Canvas to check your courses":"Not connected"):failed?(inbox.message.includes("limited")?"Try again in a minute":"Check incomplete"):preview?.error?"Preview needs attention":headline||"Not checked yet"}</span>{connected&&!openCanvas&&!failed&&!inbox.checking&&freshness.oldest!==null&&<small>{freshness.complete?"Last check":"Partial check"} · {new Date(freshness.oldest).toLocaleString("en-AU",{timeZone:"Australia/Sydney",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</small>}</div>
      <div className="canvas-connect-actions">
        {displayResults&&<button className="canvas-result-link" disabled={reviewOpen} onClick={()=>onReview(inbox.raw!)}>Review updates</button>}
        {openCanvas&&!inbox?.checking?<a href="https://canvas.sydney.edu.au/" target="_blank" rel="noopener noreferrer" onClick={()=>{returnIntent.current=true;if(!connected)setDetails(true);}}>Open Canvas ↗</a>:connected&&inbox.canCheckAll&&inbox.courseCount>0&&<button disabled={inbox.checking} onClick={()=>{lastCheck.current=Date.now();setInbox({...inbox,checking:true,message:"Starting all-course check…"});window.postMessage({type:"semester-connect-check-all-v1"},location.origin);}}>{inbox.checking?"Checking…":`Check all ${inbox.courseCount} courses`}</button>}
        <button className="canvas-details-toggle" aria-expanded={details} onClick={()=>setDetails(!details)}>{details?"Hide details":connected?"Connection details":"Connect Canvas"}</button>
      </div>
    </div>
    {preview?.error&&<p className="error" role="alert">{preview.error} Nothing imported.</p>}
    {details&&<div className="canvas-connect-help">
      {connected&&inbox.raw&&!preview?.error&&!displayResults&&<button disabled={reviewOpen||inbox.checking} onClick={()=>onReview(inbox.raw!)}>Review last preview</button>}
      {connected?<><p>{inbox.message}</p><p>Semester Connect {inbox.extensionVersion||"version not reported"}{inbox.extensionVersion!==CONNECT_VERSION&&<> · <a href={`/downloads/semester-connect-${CONNECT_VERSION}.zip`} download>Update to {CONNECT_VERSION}</a>, reload the unpacked extension, then reload Semester.</>}</p>{preview?.status&&<><p>{preview.status.protected.length} manual entries kept · {preview.status.attention.length} rules to review</p><details><summary>Last read by course · {preview.bundle.courses.length} courses</summary>{preview.bundle.courses.map(c=><p key={c.course.id}>{c.course.code} · {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney{c.marksPageUnavailable?" · Marks page unavailable":""}</p>)}</details></>}<p>Check all reads every selected course using one signed-in Canvas course tab. Returning to Semester requests one check when the last complete batch is at least a minute old. Checks only prepare a preview; they never import grades.</p></>:<>
      <h3>Connect Semester to Canvas</h3>
      <ol><li>Open <a href="https://canvas.sydney.edu.au/" target="_blank" rel="noopener noreferrer">Canvas</a> in the same Chrome profile and sign in.</li><li>Open Semester Connect from Chrome’s extensions menu. Choose <strong>Read my courses</strong>, select your courses, then <strong>Enable for selected courses</strong> and allow site access.</li><li>Return here and reload Semester. Keep one signed-in Canvas course tab open to check all selected courses.</li></ol>
      <p>Reading your course list is not the same as enabling the connection. If Semester Connect is not installed in this browser, use a JSON export from the browser where it is installed.</p>
      {inbox?.message&&<p className="hint">{inbox.message}</p>}
      </>}
      <div className="canvas-connect-actions"><button disabled={retrying} onClick={()=>{setRetrying(true);setRetried(true);window.postMessage({type:"semester-connect-request-v1"},location.origin);}}>{retrying?"Looking for connection…":"Retry connection"}</button>{onImportFile&&<button onClick={onImportFile}>Import JSON file</button>}</div>
      {retried&&!retrying&&<p role="status">No response yet. Check Semester Connect in the same Chrome profile, then reload this page. Any status above is from its last response.</p>}
    </div>}
  </section>;
}
