"use client";
import {useEffect,useRef,useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {canvasCandidates,canvasGroupBlock,canvasKey,canvasResultLabel,planCanvasImport,type CanvasBundle,type CanvasChoice,type CanvasCourse,type CanvasAssignment} from "@/lib/canvas-import";
import {canvasMatchSections,canvasMatchStatus,canvasTargetLabel,simpleCanvasDestination} from "@/lib/canvas-match-view";
import {existingCanvasRuleChoices,type CanvasAction} from "@/lib/canvas-update-status";
import {CanvasRuleMapping} from "./canvas-rule-mapping";
import {ruleDescription} from "@/lib/canvas-rule-import";

const result=(t?:Task)=>t?.grade?`${t.grade.earned} / ${t.grade.possible}`:t?.grade===null?"Manually cleared":t?.gradePlan?"Individual results recorded":"No recorded grade";

export function CanvasCourseMatching({semester,bundle,course,unit,rows,targets,choices,actions,touched,onSelect,onStage,inlineSourceId,onCancel,initialTargetId,initialPlacement,stageLabel,compact=false}:{
  semester:Semester;bundle:CanvasBundle;course:CanvasCourse;unit:string;rows:CanvasAssignment[];targets:Task[];choices:Record<string,CanvasChoice>;actions:CanvasAction[];touched:Record<string,CanvasChoice|undefined>;
  onSelect:(id:string,target:string)=>void;onStage:(items:CanvasChoice[])=>void;
  inlineSourceId?:string;onCancel?:()=>void;initialTargetId?:string;initialPlacement?:"parts";stageLabel?:string;compact?:boolean;
}){
  const [checked,setChecked]=useState<string[]>(inlineSourceId?[inlineSourceId]:[]),[editing,setEditing]=useState(!!inlineSourceId),[batch,setBatch]=useState(false),[target,setTarget]=useState(initialTargetId||""),[placement,setPlacement]=useState(initialPlacement||""),[method,setMethod]=useState("");
  const editorRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(editing)editorRef.current?.focus();},[editing]);
  const records=semester.canvasAccountId===bundle.accountId?semester.canvasImports||[]:[];
  const savedRules=existingCanvasRuleChoices(semester,bundle,course.course.id,unit);
  const sources=course.assignments.filter(a=>checked.includes(a.id));
  const destination=targets.find(t=>t.id===target),savedRule=savedRules.find(r=>r.target.id===target);
  const candidates=sources.length===1?canvasCandidates(semester,unit,sources[0]):[];
  const targetRecords=records.filter(r=>r.targetId===target);
  const sameGroup=sources.length>0&&sources.every(a=>a.groupId===sources[0].groupId);
  const block=sameGroup?canvasGroupBlock(course,sources[0].groupId||""):"These items belong to different Canvas groups. Check their rules before combining marks.";
  function reset(){setChecked([]);setEditing(false);setBatch(false);setTarget("");setPlacement("");setMethod("");onCancel?.();}
  function chooseTarget(id:string){const t=targets.find(t=>t.id===id);setTarget(id);setPlacement(initialPlacement|| (sources.length>1?"parts":t&&simpleCanvasDestination(t,semester.tasks)?"overall":""));setMethod("");}
  function open(ids:string[]){setChecked(ids);setTarget("");setPlacement("");setMethod("");setEditing(true);}
  function stage(items:CanvasChoice[]){onStage(items);reset();}
  const eligible=course.assignments.filter(a=>!records.some(r=>r.key===canvasKey(bundle,course.course.id,a.id))&&!choices[`${course.course.id}:${a.id}`]&&!a.omitted&&!a.submission?.excused);
  const proposed:CanvasChoice[]=target&&sources.length?(savedRule?sources.map(a=>({courseId:course.course.id,assignmentId:a.id,unit,targetId:target,mode:"part",rule:savedRule.rule})):placement==="overall"&&sources.length===1?[{courseId:course.course.id,assignmentId:sources[0].id,unit,targetId:target,mode:"overall"}]:placement==="parts"&&["points","equal"].includes(method)&&!block?sources.map(a=>({courseId:course.course.id,assignmentId:a.id,unit,targetId:target,mode:"part",method:method as "points"|"equal"})):[]):[];
  // Validate locally with the same planner, before staging the connection.
  let validation="";let proposedActions:CanvasAction[]=[];
  if(proposed.length)try{const merged={...choices,...Object.fromEntries(proposed.map(c=>[`${c.courseId}:${c.assignmentId}`,c]))};const p=planCanvasImport(semester,bundle,Object.values(merged));const keys=new Set(proposed.map(c=>canvasKey(bundle,c.courseId,c.assignmentId)));proposedActions=p.actions.filter(a=>keys.has(a.key));}catch(e){validation=(e as Error).message;}
  const noApplicableChange=proposedActions.length>0&&!proposedActions.some(a=>a.changed);
  const sections=canvasMatchSections(course,rows,choices,targets,records);
  return <div className="canvas-matching-workspace">
    {!inlineSourceId&&<div className="canvas-link-tools"><p className="hint">Connect once. Later checks reuse confirmed links. Your dates, weights and notes stay yours.</p>{eligible.length>1&&<button onClick={()=>{reset();setBatch(!batch);}}>{batch?"Cancel selection":"Connect several items…"}</button>}</div>}
    {batch&&!editing&&<div className="canvas-selection-bar"><span>Select the weeks or attempts that belong to one assessment.</span><button disabled={!checked.length} onClick={()=>setEditing(true)}>Choose assessment for {checked.length} items →</button><button onClick={reset}>Cancel</button></div>}
    {editing&&<div ref={editorRef} tabIndex={-1} className="canvas-connection-editor" aria-label="Review connection">
      <header><h3>{compact?"Change placement / calculation":sources.length===1?`Choose where ${sources[0].name} belongs`:`Connect ${sources.length} items`}</h3><button onClick={reset}>Cancel changes</button></header>
      {sources.length>1&&<details><summary>Selected Canvas items ({sources.length})</summary><ul>{sources.map(a=><li key={a.id}>{a.name} · {canvasResultLabel(a)}</li>)}</ul></details>}
      <label>{compact?"Assessment":"Which Semester assessment do these belong to?"}<select aria-label={`Destination assessment ${course.course.code}`} value={target} onChange={e=>chooseTarget(e.target.value)}><option value="">Choose assessment…</option>{targets.map(t=><option key={t.id} value={t.id}>{canvasTargetLabel(t)}</option>)}{sources.length===1&&<option value="new">Create a missing assessment…</option>}</select></label>
      {!target&&candidates.length>0&&<div className="canvas-candidates"><small>Suggested assessments · confirm the full name and weight</small>{candidates.map(c=><button key={c.target.id} onClick={()=>chooseTarget(c.target.id)}>{canvasTargetLabel(c.target)}<small>{c.reason}</small></button>)}</div>}
      {target==="new"?<><p>Creates one new assessment with unknown weight. It is not a week or a part of an existing assessment.</p><button onClick={()=>{onSelect(sources[0].id,"new");reset();}}>Propose new assessment · review next</button></>:destination&&<>
        {!compact?<div className="canvas-value-comparison"><div><small>Canvas</small>{sources.map(a=><p key={a.id}>{a.name}<strong>{canvasResultLabel(a)}</strong></p>)}</div><div><small>Semester · {destination.weight||"weight unknown"}</small><p>{destination.title}<strong>{result(destination)}</strong></p>{destination.date&&<small>Your due date: {destination.date} · kept unchanged</small>}</div></div>:target!==initialTargetId&&<p className="hint">Current result in this assessment: {result(destination)} · dates kept</p>}
        {destination.gradePlan&&<details><summary>Existing individual records ({destination.gradePlan.items.length})</summary><ul>{destination.gradePlan.items.map(i=><li key={i.id}>{i.name} · {i.grade?`${i.grade.earned}/${i.grade.possible}`:"No numeric result"}</li>)}</ul></details>}
        {targetRecords.length>0&&<details><summary>{targetRecords.length} existing Canvas links to this assessment</summary><ul>{targetRecords.map(r=><li key={r.key}>{course.assignments.find(a=>canvasKey(bundle,course.course.id,a.id)===r.key)?.name||"Previously linked Canvas item"} · {r.mode==="part"?"individual record":"whole-assessment result"}</li>)}</ul></details>}
        {savedRule?<p className="notice">Use your confirmed rule: {ruleDescription(savedRule.rule)}. Blank results stay unknown. Existing manual records are protected.</p>:<>
          {sources.length===1&&simpleCanvasDestination(destination,semester.tasks)&&placement==="overall"?<p className="notice">Use as this assessment’s overall grade. <button className="canvas-text-button" onClick={()=>setPlacement("parts")}>It is only one part…</button></p>:sources.length===1?<fieldset className="canvas-placement"><legend>What does this Canvas result represent?</legend>
            {sources.length===1&&<label><input type="radio" name={`placement-${course.course.id}`} checked={placement==="overall"} onChange={()=>setPlacement("overall")}/>The result for this whole assessment</label>}
            <label><input type="radio" name={`placement-${course.course.id}`} checked={placement==="parts"} onChange={()=>setPlacement("parts")}/>{sources.length===1?"One week, attempt or part within this assessment":"Separate weeks, attempts or parts within this assessment"}</label>
          </fieldset>:<p>Each selected Canvas item becomes a separate record inside this assessment. Review how those records are counted below.</p>}
          {placement==="parts"&&(targetRecords.some(r=>r.mode==="overall")?<p role="alert" className="notice">This assessment already has a whole-result link. It cannot also receive weekly entries. Leave this unchanged until that link is reviewed; no existing link will be moved automatically.</p>:destination.gradePlan&&!targetRecords.some(r=>r.mode==="part")?<p className="notice">This assessment has manually created records. Linking directly to one of those records is not supported yet. They are kept unchanged; do not create a duplicate to work around this.</p>:<>
            <label>How are these records counted?<select aria-label={`Calculation for ${destination.title}`} value={method} onChange={e=>setMethod(e.target.value)}><option value="">Choose the assessment’s rule…</option><option value="points">Add marks together</option><option value="equal">Each record counts equally</option><option value="special">Best attempt or completion-based rule…</option></select></label>
            {block&&["points","equal"].includes(method)&&<p role="alert" className="notice">{block} You can leave these unconnected until the rule is known.</p>}
            {method==="special"&&<CanvasRuleMapping key={target+checked.join(":")} course={course} unit={unit} targets={targets} fixedTarget={target} sourceIds={checked} onStage={stage} stageLabel={stageLabel?"Use this rule · not saved yet":undefined}/>}
          </>)}
        </>}
        {validation&&<p role="alert" className="notice error">{validation}</p>}
        {proposedActions.some(a=>a.kind==="protected")&&<p className="notice">Your existing value is kept. This does not accept or replace it with Canvas.</p>}
        {noApplicableChange&&<p className="notice">No link or result can be changed with this selection. Existing records are protected.</p>}
        {method!=="special"&&<button className="primary" disabled={!proposed.length||!!validation||noApplicableChange} onClick={()=>stage(proposed)}>{stageLabel||"Add to review · not saved yet"}</button>}
      </>}
    </div>}
    {!inlineSourceId&&sections.map(section=><section className="canvas-source-group" key={section.id} aria-label={`Canvas group ${section.name}`}>
      <header className="canvas-compact-group"><h4>{section.name}</h4><details><summary>Source details & existing links{section.linked.length?` (${section.linked.length})`:""}</summary><p>Canvas category only; items keep separate results. {course.course.weighted===true&&section.weight!=null?`Canvas configured group weight: ${section.weight}%.` :"Canvas group weight is not used here to set your assessment weights."}</p>{section.linked.length?<ul>{section.linked.map(l=><li key={l.record.key}>{l.source.name} → {l.target?canvasTargetLabel(l.target):"Saved destination unavailable"}</li>)}</ul>:<p>No confirmed links in this category yet.</p>}</details></header>
      <div className="canvas-import-table"><table><thead><tr><th>Canvas assessment</th><th>Result</th><th>In Semester</th></tr></thead><tbody>{section.items.map(a=>{
        const key=`${course.course.id}:${a.id}`,choice=choices[key],prior=records.find(r=>r.key===canvasKey(bundle,course.course.id,a.id)),effectiveTarget=targets.find(t=>t.id===(choice?.targetId||prior?.targetId)),action=actions.find(v=>v.key===canvasKey(bundle,course.course.id,a.id));
        const canSelect=eligible.some(s=>s.id===a.id);
        return <tr key={a.id} data-canvas-item={a.id}><td><div className="canvas-source-title">{batch&&canSelect&&<input aria-label={`Select ${a.name}`} type="checkbox" checked={checked.includes(a.id)} disabled={editing} onChange={e=>setChecked(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/>}
          <a href={`https://canvas.sydney.edu.au/courses/${course.course.id}/assignments/${a.id}`} target="_blank" rel="noopener noreferrer">{a.name}</a></div>{a.dueAt&&<small>{new Date(a.dueAt).toLocaleDateString("en-AU",{timeZone:"Australia/Sydney",day:"numeric",month:"short"})}</small>}</td>
          <td><strong>{canvasResultLabel(a)==="No released numeric grade"?"No readable grade yet":canvasResultLabel(a)}</strong></td>
          <td>{prior||choice?<><strong>{effectiveTarget?canvasTargetLabel(effectiveTarget):choice?.targetId==="new"?"New assessment":"Saved destination unavailable"}</strong><small>{canvasMatchStatus(choice,prior,action,a)}{(choice?.mode||prior?.mode)==="part"?" · individual record":""}</small>{!batch&&<button className="canvas-text-button" onClick={()=>onSelect(a.id,prior&&!choice?"saved:":"")}>{prior?(choice?"Skip this check":"Restore saved link"):"Undo connection"}</button>}</>:<>{!batch&&<button onClick={()=>open([a.id])}>Connect…</button>}<small>{a.omitted||a.submission?.excused?"Not counted in Canvas":batch?"Select on the left":"Not connected"}</small></>}
          {Object.hasOwn(touched,key)&&<small className="canvas-staged">{choice?"Staged · not saved":"Reverted / skipped · not saved"}</small>}
          {action&&(action.kind==="grade"||action.kind==="protected"||action.kind==="attention")&&<details><summary>{action.kind==="protected"?"Compare protected value":"View change"}</summary><p>{action.text}</p><p>Canvas: {canvasResultLabel(a)}<br/>Semester: {result(effectiveTarget)}</p></details>}
        </td></tr>;
      })}</tbody></table></div>
    </section>)}
    {!inlineSourceId&&!rows.length&&<p>No items in this view. Saved links are still kept.</p>}
  </div>;
}
