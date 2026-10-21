"use client";
import {useState} from "react";
import type {CanvasRule,Task} from "@/lib/semester";
import {canvasGrade,canvasResultLabel,type CanvasCourse,type CanvasChoice} from "@/lib/canvas-import";
import {validCanvasRule} from "@/lib/canvas-rule-import";

export function CanvasRuleMapping({course,unit,targets,onStage}:{course:CanvasCourse;unit:string;targets:Task[];onStage:(choices:CanvasChoice[])=>void}) {
  const [target,setTarget]=useState(""),[method,setMethod]=useState<CanvasRule["method"]>("highest"),[count,setCount]=useState(3),[best,setBest]=useState(8),[points,setPoints]=useState(.5);
  const [threshold,setThreshold]=useState(""),[maximum,setMaximum]=useState("20"),[query,setQuery]=useState(""),[selected,setSelected]=useState<Record<string,boolean>>({}),[outcomes,setOutcomes]=useState<Record<string,string>>({}),[ack,setAck]=useState(false),[staged,setStaged]=useState(false);
  const rule:CanvasRule={method,count,...(method==="completion"?{bestCount:best,completionPoints:points}:threshold!==""?{passMark:{earned:Number(threshold),possible:Number(maximum)}}:{})};
  const ids=Object.keys(selected).filter(id=>selected[id]),rows=course.assignments.filter(a=>a.name.toLowerCase().includes(query.toLowerCase()));
  function change(){setAck(false);setStaged(false);}
  return <details className="canvas-group-mapping"><summary>Retakes / completion rules · match selected items</summary>
    <p className="hint">Select source items for one existing assessment, even across Canvas groups. Confirm the rule yourself; example defaults are not course policy. Source names are retained, not mapped by teaching-week position. No calendar tasks are added.</p>
    <div className="field-pair">
      <label>Existing assessment<select aria-label={`Rule target ${course.course.code}`} value={target} onChange={e=>{setTarget(e.target.value);change();}}><option value="">Choose assessment…</option>{targets.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label>Calculation rule<select aria-label={`Special rule ${course.course.code}`} value={method} onChange={e=>{setMethod(e.target.value as CanvasRule["method"]);setCount(e.target.value==="highest"?3:10);setOutcomes({});change();}}><option value="highest">Retakes · highest attempt</option><option value="completion">Completion · best N submissions</option></select></label>
      <label>{method==="highest"?"Maximum attempts":"Total opportunities"}<input aria-label={`Rule count ${course.course.code}`} type="number" min="1" max="200" value={count} onChange={e=>{setCount(Number(e.target.value));change();}}/></label>
      {method==="completion"?<><label>Best how many?<input aria-label={`Best count ${course.course.code}`} type="number" min="1" max={count} value={best} onChange={e=>{setBest(Number(e.target.value));change();}}/></label><label>Points per confirmed submission<input aria-label={`Completion points ${course.course.code}`} type="number" min="0.001" step="any" value={points} onChange={e=>{setPoints(Number(e.target.value));change();}}/></label></>:<><label>Optional threshold<input aria-label={`Threshold ${course.course.code}`} type="number" min="0" value={threshold} onChange={e=>{setThreshold(e.target.value);change();}}/></label><label>Threshold out of<input aria-label={`Threshold maximum ${course.course.code}`} type="number" min="1" value={maximum} onChange={e=>{setMaximum(e.target.value);change();}}/></label></>}
    </div>
    <label>Find source items<input aria-label={`Find rule items ${course.course.code}`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="For example, Quiz 1 or Prework"/></label>
    <p className="hint">{ids.length} selected / {count} opportunities. Unlinked opportunities stay unknown. Complete counts only under your confirmed completion rule; blank, hidden and Incomplete are not automatically zero.</p>
    {rows.map(a=><div className="canvas-group-row" key={a.id}>
      <label className="canvas-confirm"><input type="checkbox" checked={!!selected[a.id]} onChange={e=>{setSelected({...selected,[a.id]:e.target.checked});change();}}/>{a.name} · {canvasResultLabel(a)}</label>
      {selected[a.id]&&!canvasGrade(a)&&a.result!=="complete"&&<label>Missing result<select aria-label={`Outcome for ${a.name}`} value={outcomes[a.id]||""} onChange={e=>{setOutcomes({...outcomes,[a.id]:e.target.value});change();}}><option value="">Unconfirmed · not zero</option>{method==="highest"?<option value="not_taken">I confirm: not taken yet · no zero</option>:<option value="missed">I confirm: not submitted · counts as 0</option>}</select></label>}
    </div>)}
    <label className="canvas-confirm"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I checked these source items, the target assessment and this calculation rule.</label>
    <button disabled={!ack||!target||!ids.length||ids.length>count||!validCanvasRule(rule)} onClick={()=>{onStage(ids.map(assignmentId=>({courseId:course.course.id,assignmentId,unit,targetId:target,mode:"part",rule,...(outcomes[assignmentId]?{outcome:outcomes[assignmentId] as "missed"|"not_taken"}:{})})));setStaged(true);setAck(false);setSelected({});setOutcomes({});}}>Stage rule mapping for review</button>
    {staged&&<p role="status">Staged only — nothing saved. You can stage another assessment, then open Review selected items below.</p>}
  </details>;
}
