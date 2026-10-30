// Synthetic bridge only. No extension, Canvas request, storage or account access.
import React,{useState} from "react";
import {CanvasInbox} from "../../components/canvas-inbox";
import {attentionFixture} from "../fixtures/canvas-attention";

const fixture=attentionFixture();
let checks=0,offset=0,fail=false;
const realNow=Date.now.bind(Date);
Date.now=()=>realNow()+offset;
let snapshot=structuredClone(fixture.bundle);
function ageSnapshot(){snapshot.courses.forEach(c=>{c.fetchedAt=new Date(Date.now()-3600000).toISOString();});}
ageSnapshot();
function respond(message="All selected courses checked."){
  window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:true,raw:JSON.stringify(snapshot),message,canCheckAll:true,checking:false,courseCount:snapshot.courses.length}},location.origin);
}
window.addEventListener("message",e=>{
  if(e.source!==window||e.origin!==location.origin)return;
  if(e.data?.type==="semester-connect-request-v1")respond();
  if(e.data?.type==="semester-connect-check-all-v1"){
    checks++;
    if(fail)respond("Check failed. Open a signed-in Canvas course tab, then check again.");
    else {snapshot.courses.forEach(c=>{c.fetchedAt=new Date(Date.now()).toISOString();});respond();}
    window.dispatchEvent(new Event("qa-check-count"));
  }
});
export function FreshnessQA(){
  const [count,setCount]=useState(checks),[review,setReview]=useState(false);
  React.useEffect(()=>{const update=()=>setCount(checks);window.addEventListener("qa-check-count",update);return()=>window.removeEventListener("qa-check-count",update);},[]);
  return <main style={{maxWidth:1100,margin:"20px auto",padding:24}}><h1>Synthetic homepage checks</h1><p>Invented data only · Network requests: 0 · Test writes: 0</p><p>Fresh checks: {count}</p>
    <button onClick={()=>respond()}>Repeat inbox response</button>
    <button onClick={()=>{offset+=120000;window.dispatchEvent(new Event("focus"));}}>Simulate return after 2 minutes</button>
    <button onClick={()=>{fail=true;offset+=120000;window.dispatchEvent(new Event("focus"));}}>Simulate failed check</button>
    <button onClick={()=>setReview(!review)}>{review?"Close test review":"Open test review"}</button><p>Review: {review?"open":"closed"}</p>
    <CanvasInbox semester={fixture.board} reviewOpen={review} onReview={()=>setReview(true)}/>
  </main>;
}
