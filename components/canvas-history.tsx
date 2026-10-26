"use client";
import {useState} from "react";
import type {Semester} from "@/lib/semester";
import {canvasTargets} from "@/lib/canvas-import";
import type {CanvasHistoryEntry} from "@/lib/canvas-history";

export function CanvasHistory({semester,onOpenGrade}:{semester:Semester;onOpenGrade:(id:string)=>void}){
  const [onlyResults,setOnlyResults]=useState(true);
  const batches=semester.canvasHistory||[];
  const tasks=semester.units.flatMap(u=>canvasTargets(semester,u.code));
  const time=(value:string)=>new Date(value).toLocaleString("en-AU",{timeZone:"Australia/Sydney"});
  function entry(e:CanvasHistoryEntry){const target=tasks.find(t=>t.id===e.targetId);return <li key={e.key}><span className="canvas-history-label">{e.changed?(e.kind==="grade"?"Grade imported":e.kind==="added"?"Assessment added":"Link / rule saved"):"Not changed"}</span><p>{e.text}</p>{target&&e.kind==="grade"&&<button onClick={()=>onOpenGrade(target.id)}>{!e.seen&&<span className="canvas-new-dot" aria-hidden="true"/>}View {target.unit} · {target.title} grade →</button>}{e.kind==="grade"&&!target&&<small>Assessment no longer on this board. This record is kept.</small>}</li>;}
  return <div className="canvas-history"><p>Confirmed imports on this board. Check the main save status: a pending or failed save is not yet synced. Opening a grade clears its “New” indicator, not this record.</p>
    <label><input type="checkbox" checked={onlyResults} onChange={e=>setOnlyResults(e.target.checked)}/> Only grade updates</label>
    {!batches.length&&<p>No update records yet. Records start with your next confirmed import; earlier imports are not reconstructed. Pending checks have not changed your grades.</p>}
    {batches.map((b,index)=><details key={b.id} className="rule-card" open={index===0}><summary>{time(b.confirmedAt)} Sydney · {b.changed} confirmed changes</summary><p className="hint">Source exported {time(b.exportedAt)} · {b.skipped} skipped · no changes for skipped items</p><ul>{b.entries.filter(e=>!onlyResults||e.kind==="grade").map(entry)}</ul>{onlyResults&&!b.entries.some(e=>e.kind==="grade")&&<p>No grades changed in this import. Turn off “Only grade updates” to see saved links and protected entries.</p>}{b.omitted>0&&<p>{b.omitted} additional entries are outside this record’s detail limit.</p>}</details>)}
    <p className="hint">Keeps up to 20 recent confirmed imports (250 entries per import, with a total size limit). Included in your board backup. Pending Connect previews remain temporary; keep a JSON export if you need to review them later.</p>
  </div>;
}
