"use client";
import {useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {canvasCandidates,canvasGroupBlock,canvasKey,canvasResultLabel,type CanvasBundle,type CanvasChoice,type CanvasCourse,type CanvasAssignment} from "@/lib/canvas-import";
import {canvasMatchSections,canvasMatchStatus,canvasTargetLabel} from "@/lib/canvas-match-view";
import {existingCanvasRuleChoices,type CanvasAction} from "@/lib/canvas-update-status";
import {CanvasRuleMapping} from "./canvas-rule-mapping";
import {ruleDescription} from "@/lib/canvas-rule-import";

const result=(t?:Task)=>t?.grade?`${t.grade.earned} / ${t.grade.possible}`:t?.grade===null?"Manually cleared":t?.gradePlan?"Individual results":"No recorded grade";

export function CanvasCourseMatching({semester,bundle,course,unit,rows,targets,choices,actions,touched,onSelect,onStage}:{
  semester:Semester;bundle:CanvasBundle;course:CanvasCourse;unit:string;rows:CanvasAssignment[];targets:Task[];choices:Record<string,CanvasChoice>;actions:CanvasAction[];touched:Record<string,CanvasChoice|undefined>;
  onSelect:(id:string,target:string)=>void;onStage:(items:CanvasChoice[])=>void;
}){
  const [checked,setChecked]=useState<string[]>([]),[configure,setConfigure]=useState(false),[method,setMethod]=useState(""),[target,setTarget]=useState("");
  const savedRules=existingCanvasRuleChoices(semester,bundle,course.course.id,unit);
  const sources=course.assignments.filter(a=>checked.includes(a.id));
  const sameGroup=sources.length>0&&sources.every(a=>a.groupId===sources[0].groupId);
  const block=sameGroup?canvasGroupBlock(course,sources[0].groupId||""):"Select items from one Canvas group for points or equal weighting.";
  const existing=savedRules.find(r=>r.target.id===target);
  function stage(items:CanvasChoice[]){onStage(items);setChecked([]);setConfigure(false);setMethod("");setTarget("");}
  function check(id:string,value:boolean){setChecked(old=>value?[...old,id]:old.filter(x=>x!==id));setConfigure(false);}
  const sections=canvasMatchSections(course,rows,choices,targets,semester.canvasAccountId===bundle.accountId?semester.canvasImports:[]);
  return <div className="canvas-matching-workspace">
    <p className="hint">Canvas groups organise items; they are not extra assignments. Each row keeps its own result. Right-hand weights are your Semester assessment weights.</p>
    {checked.length>0&&<section className="canvas-batch-bar" aria-label="Selected Canvas items">
      <strong>{checked.length} items selected</strong><button onClick={()=>setConfigure(!configure)}>{configure?"Hide setup":"Link selected items to one assessment…"}</button><button onClick={()=>{setChecked([]);setConfigure(false);}}>Clear selection</button>
      {configure&&<div className="canvas-batch-setup">
        <p>These become individual results, not several overall grades or new calendar tasks. Keep independent assessments separate.</p>
        <label>How should these results count?<select aria-label={`Batch method ${course.course.code}`} value={method} onChange={e=>setMethod(e.target.value)}>
          <option value="">Choose only after checking the assessment rules…</option>
          {savedRules.length>0&&<option value="saved">Use a previously confirmed rule</option>}
          <option value="points">Independent parts · add marks together</option><option value="equal">Independent parts · each counts equally</option>
          <option value="special">Retakes / completion · set a rule</option>
        </select></label>
        {method==="special"?<CanvasRuleMapping key={checked.join(":")} course={course} unit={unit} targets={targets} sourceIds={checked} onStage={stage}/>:method&&<>
          <label>Semester assessment<select aria-label={`Batch target ${course.course.code}`} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose assessment…</option>{(method==="saved"?savedRules.map(r=>r.target):targets).map(t=><option key={t.id} value={t.id}>{canvasTargetLabel(t)}</option>)}</select></label>
          {method==="saved"&&existing&&<p>{ruleDescription(existing.rule)}. New items stay unknown until a result is available.</p>}
          {method!=="saved"&&block&&<p className="notice">{block} Linking a group does not establish its grading policy.</p>}
          <button disabled={!target||(method==="saved"?!existing:!!block)} onClick={()=>stage(sources.map(a=>({courseId:course.course.id,assignmentId:a.id,unit,targetId:target,mode:"part",...(method==="saved"?{rule:existing!.rule}:{method:method as "points"|"equal"})})))}>Stage {checked.length} individual links · review next</button>
        </>}
      </div>}
    </section>}
    {sections.map(section=><section className="canvas-source-group" key={section.id} aria-label={`Canvas group ${section.name}`}>
      <header className="canvas-group-map">
        <div><small>CANVAS GROUP{section.weight!=null?` · ${section.weight}% group weight`:""}</small><h4>{section.name}</h4><span>{section.items.length} shown · {section.selectedCount} selected links</span></div>
        <span className="canvas-map-arrow" aria-hidden="true">→</span>
        <div><small>SEMESTER ASSESSMENTS · EACH COUNTS ONCE</small>{section.destinations.length?<ul>{section.destinations.map(t=><li key={t.id}>{canvasTargetLabel(t)}</li>)}</ul>:<p>No destination selected yet</p>}</div>
      </header>
      <div className="canvas-import-table"><table><thead><tr><th>Canvas item &amp; result</th><th>Semester assessment &amp; link</th></tr></thead><tbody>{section.items.map(a=>{
        const key=`${course.course.id}:${a.id}`,choice=choices[key],prior=semester.canvasImports?.find(r=>r.key===canvasKey(bundle,course.course.id,a.id));
        const effectiveTarget=targets.find(t=>t.id===(choice?.targetId||prior?.targetId)),action=actions.find(v=>v.key===canvasKey(bundle,course.course.id,a.id));
        const candidates=choice||prior?[]:canvasCandidates(semester,unit,a);
        return <tr key={a.id} data-canvas-item={a.id}><td>
          <div className="canvas-source-title">{!prior&&<input aria-label={`Select ${a.name} for individual results`} type="checkbox" checked={checked.includes(a.id)} onChange={e=>check(a.id,e.target.checked)}/>}
            <a href={`https://canvas.sydney.edu.au/courses/${course.course.id}/assignments/${a.id}`} target="_blank" rel="noopener noreferrer">{a.name}</a></div>
          <strong className="canvas-source-result">{canvasResultLabel(a)}</strong>
          <small>{a.dueAt?`Due ${new Date(a.dueAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})}`:"Due not provided"}</small>
        </td><td>
          <span className={`canvas-link-state${action?.kind==="protected"?" protected":""}`}>{canvasMatchStatus(choice,prior,action)}</span>
          {Object.hasOwn(touched,key)&&<small className="canvas-staged">{choice?"Selection kept here · use Undo to reverse":"Skipped for this check · nothing saved"}</small>}
          {prior?<>
            <strong>{effectiveTarget?canvasTargetLabel(effectiveTarget):"Previously linked assessment unavailable"}</strong>
            <small>{prior.mode==="part"?"Individual result":"Overall result"}{prior.rule?` · ${ruleDescription(prior.rule)}`:""} · saved link reused</small>
            <button onClick={()=>onSelect(a.id,choice?"":"saved:")}>{choice?"Skip this check":"Use saved link"}</button>
          </>:choice?.mode==="part"?<>
            <strong>Individual result → {effectiveTarget&&canvasTargetLabel(effectiveTarget)}</strong><small>{choice.rule?ruleDescription(choice.rule):choice.method==="points"?"Add marks together":"Each item counts equally"}</small><button onClick={()=>onSelect(a.id,"")}>Undo this link</button>
          </>:<>
            <select aria-label={`Import ${a.name}`} value={choice?.targetId||""} onChange={e=>onSelect(a.id,e.target.value)}><option value="">Not linked · leave for later</option>
              {savedRules.length>0&&<optgroup label="Individual result · use saved rule">{savedRules.map(r=><option key={r.target.id} value={`rule:${r.target.id}`}>{canvasTargetLabel(r.target)} · {ruleDescription(r.rule)}</option>)}</optgroup>}
              <optgroup label="Overall result for an independent assessment">{targets.filter(t=>!savedRules.some(r=>r.target.id===t.id)).map(t=><option key={t.id} value={t.id}>{canvasTargetLabel(t)}</option>)}</optgroup>
              <optgroup label="Only if the assessment is missing"><option value="new">+ Create assessment · review weight</option></optgroup>
            </select>
            {!choice&&candidates.length>0&&<div className="canvas-candidates"><small>Suggested destination · not linked yet</small><button onClick={()=>onSelect(a.id,candidates[0].target.id)}>{canvasTargetLabel(candidates[0].target)}<small>{candidates[0].reason}</small></button>{candidates.length>1&&<details><summary>Other possible matches ({candidates.length-1})</summary>{candidates.slice(1).map(c=><button key={c.target.id} onClick={()=>onSelect(a.id,c.target.id)}>{canvasTargetLabel(c.target)}<small>{c.reason}</small></button>)}</details>}</div>}
          </>}
          {effectiveTarget&&<small>Currently in Semester: {result(effectiveTarget)}</small>}
          {effectiveTarget?.kind==="recurring"&&(choice?.mode==="overall"||prior?.mode==="overall")&&<p className="notice">This links the whole assessment’s result, not one week. If this source is only one occurrence, skip it for now. Changing an existing overall link to a child entry requires a separate reviewed repair.</p>}
          {choice?.targetId==="new"&&<p className="notice">Creates an assessment, not a child entry. Check for an existing assignment first.</p>}
          {action&&(action.kind==="grade"||action.kind==="protected"||action.kind==="attention")&&<details className="canvas-row-comparison"><summary>{action.kind==="protected"?"Compare · manual value kept":"See proposed change"}</summary><p>{action.text}</p><p>Canvas: {canvasResultLabel(a)} · Semester: {result(effectiveTarget)}. Nothing changes without confirmation.</p></details>}
          {!choice&&!prior&&<small>For a weekly entry or retake, tick the box on the left and link individual results above.</small>}
        </td></tr>;
      })}</tbody></table></div>
    </section>)}
    {!rows.length&&<p>No items match this filter.</p>}
  </div>;
}
