"use client";
import {useRef,useState} from "react";
import {CanvasCourseMatching} from "./canvas-course-matching";
import type {Semester} from "@/lib/semester";
import {canvasGrade,canvasKey,canvasResultLabel,canvasTargets,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";
import {canvasDay,preparedCandidates,preparedTargetLabel,type PreparedCanvas} from "@/lib/canvas-prepare";
import {simpleCanvasDestination} from "@/lib/canvas-match-view";
import type {CanvasAction} from "@/lib/canvas-update-status";

export function CanvasPrepared({semester,bundle,prepared,choices,actions,changed,error,stale,onRefresh,onSelect,onStage,onManage,onImport,onClose,onUndo,canUndo}:{
  semester:Semester;bundle:CanvasBundle;prepared:PreparedCanvas;choices:Record<string,CanvasChoice>;actions:CanvasAction[];changed:number;error?:string;stale:boolean;
  onRefresh:()=>void;onSelect:(cid:string,aid:string,target:string)=>void;onStage:(items:CanvasChoice[])=>void;onManage:(filter:string,cid?:string)=>void;onImport:()=>void;onClose:()=>void;onUndo:()=>void;canUndo:boolean;
}){
  const [filter,setFilter]=useState("all"),[showSkipped,setShowSkipped]=useState(false);
  const [editingKey,setEditingKey]=useState<string|null>(null);
  const editorTrigger=useRef<HTMLButtonElement|null>(null);
  function closeEditor(){setEditingKey(null);requestAnimationFrame(()=>editorTrigger.current?.focus());}
  const records=new Map((semester.canvasImports||[]).map(r=>[r.key,r]));
  const rows=bundle.courses.flatMap(c=>c.assignments.map(a=>{
    const key=`${c.course.id}:${a.id}`,choice=choices[key],prior=records.get(canvasKey(bundle,c.course.id,a.id)),action=actions.find(v=>v.key===canvasKey(bundle,c.course.id,a.id));
    return {c,a,key,choice,prior,action};
  }));
  const useful=rows.filter(r=>canvasGrade(r.a)&&(r.action?.changed||!r.prior||r.action?.kind==="protected"||r.action?.kind==="attention"));
  const ready=useful.filter(r=>r.choice&&["grade","added"].includes(r.action?.kind||"")).length;
  const needChoice=useful.filter(r=>!r.choice&&!prepared.choices[r.key]).length;
  const protectedRows=rows.filter(r=>r.action?.kind==="protected");
  const other=actions.filter(a=>a.changed&&a.kind!=="grade"&&a.kind!=="added"&&a.kind!=="protected");
  const dormant=rows.filter(r=>!useful.includes(r)).length;
  return <div className="canvas-prepared">
    <div className="canvas-ready-heading"><span className="canvas-eyebrow">CANVAS → YOUR SEMESTER</span><h3>{ready?`${ready} ${ready===1?"grade":"grades"} ready to import`:needChoice?"Your Canvas results are here":changed?"Your connections are ready":"You’re up to date"}</h3>
      <p>{ready?"We’ve prepared the connections below. Change anything that looks wrong, then import once.":needChoice?"These results need a destination. They won’t block other ready grades.":"No new applicable grades in this check."}</p>
      <div className="canvas-ready-stats"><span>{bundle.courses.length} courses checked</span>{needChoice>0&&<span>{needChoice} to choose · can wait</span>}{protectedRows.length>0&&<span>{protectedRows.length} manual values kept</span>}</div>
    </div>
    {stale&&<p className="notice error" role="alert">Your board changed while this preview was open. <button onClick={()=>{closeEditor();onRefresh();}}>Refresh suggestions</button> before importing. Unsaved choices will reset.</p>}
    {error&&<p className="notice error" role="alert">{error} Nothing saved. Change or skip the affected item.</p>}
    {useful.length>0&&<>
      {bundle.courses.length>1&&<nav className="canvas-course-nav" aria-label="Filter prepared courses"><button disabled={!!editingKey} aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All courses</button>{bundle.courses.map(c=><button key={c.course.id} disabled={!!editingKey} aria-pressed={filter===c.course.id} onClick={()=>setFilter(c.course.id)}>{prepared.units[c.course.id]||c.course.code}</button>)}</nav>}
      {bundle.courses.filter(c=>filter==="all"||c.course.id===filter).map(c=>{
        const courseRows=useful.filter(r=>r.c===c),unit=prepared.units[c.course.id]||"",targets=canvasTargets(semester,unit);
        if(!courseRows.length)return null;
        return <section key={c.course.id} className="canvas-ready-course"><h4>{unit||c.course.code}{!semester.units.some(u=>u.code===unit)&&unit&&<small>New unit · results only</small>}</h4>
          <div className="canvas-ready-columns" aria-hidden="true"><span>Canvas result</span><span>In Semester</span></div>
          {courseRows.map(({a,key,choice,prior,action})=>{
            const target=targets.find(t=>t.id===(choice?.targetId||prior?.targetId));
            const candidates=preparedCandidates(semester,unit,a).slice(0,3);
            const blocked=action?.kind==="protected"||action?.kind==="attention";
            return <article className={`canvas-ready-row${!choice?" is-skipped":""}`} key={key} aria-label={`Prepared ${a.name}`}>
              <div><a href={`https://canvas.sydney.edu.au/courses/${c.course.id}/assignments/${a.id}`} target="_blank" rel="noopener noreferrer">{a.name}</a><strong className="canvas-ready-grade">{canvasResultLabel(a)}</strong>{a.dueAt&&<small>Canvas due {canvasDay(a.dueAt)}</small>}</div>
              <div>
                <strong>{choice?target?preparedTargetLabel(target):`Create ${a.name}`:prior?"Skipped this check":"Not included"}</strong>
                {choice&&<small className="canvas-match-reason">{prior?"Saved connection":choice.mode==="part"?"Individual connection · chosen by you":choice.targetId==="new"?"New assessment · weight unknown":prepared.choices[key]?.targetId===choice.targetId?prepared.reasons[key]:"Chosen by you"}</small>}
                {choice?.mode==="part"?<p className="canvas-grade-delta">Individual result · {action?.text||"Connection prepared; not saved yet"}</p>:target&&<p className={blocked?"canvas-protected-comparison":"canvas-grade-delta"}>{blocked?"Keep your value: ":"Current: "}{target.grade?`${target.grade.earned} / ${target.grade.possible}`:target.grade===null?"Manually cleared":target.gradePlan?"Individual results":"No grade"}{!blocked&&choice&&` → ${canvasResultLabel(a)}`}{blocked&&" · Canvas will not overwrite it"}</p>}
                {action?.kind==="attention"&&<p className="notice">{action.text}</p>}
                {!choice&&!prepared.choices[key]&&!prior&&<><small>{prepared.issues[key]||"Choose an assessment, or keep this for later."}</small>{candidates.length>0&&<div className="canvas-candidates">{candidates.slice(0,2).map(v=><button key={v.target.id} onClick={()=>onSelect(c.course.id,a.id,v.target.id)}>{preparedTargetLabel(v.target)}<small>{v.reason}</small></button>)}</div>}</>}
                {prior?<button className="canvas-text-button" onClick={()=>onSelect(c.course.id,a.id,choice?"":"saved:")}>{choice?"Skip this check":"Restore saved link"}</button>:<details className="canvas-change-match"><summary>{choice?"Change / skip":"Choose where it belongs"}</summary>
                  <label>Destination for {a.name}<select aria-label={`Destination for ${a.name}`} value={choice?.targetId||""} onChange={e=>onSelect(c.course.id,a.id,e.target.value)}><option value="">Skip for now</option>{targets.filter(t=>simpleCanvasDestination(t,semester.tasks)).map(t=><option key={t.id} value={t.id}>{preparedTargetLabel(t)}</option>)}<option value="new">Create a separate assessment · unknown weight</option></select></label>
                  <button className="canvas-text-button" aria-expanded={editingKey===key} onClick={e=>{editorTrigger.current=e.currentTarget;setEditingKey(editingKey===key?null:key);}}>Only part of an assessment?</button>
                </details>}
              </div>
              {editingKey===key&&<div className="canvas-inline-placement">
                <p className="hint">Set up only {a.name}: a weekly result, a separate part, or another attempt. Other connections stay unchanged. Cancel keeps your current choice.</p>
                <CanvasCourseMatching key={key} semester={semester} bundle={bundle} course={c} unit={unit} rows={[a]} targets={targets} choices={choices} actions={actions} touched={{}} inlineSourceId={a.id} initialTargetId={target?.id} initialPlacement="parts" stageLabel="Use this connection · not saved yet" onSelect={(id,destination)=>onSelect(c.course.id,id,destination)} onStage={onStage} onCancel={closeEditor}/>
              </div>}
            </article>;
          })}
        </section>;
      })}
    </>}
    {other.length>0&&<details className="rule-card"><summary>{other.length} connections / individual records also prepared</summary><ul>{other.map(a=><li key={a.key}>{a.text}</li>)}</ul><button onClick={()=>onManage("selected")}>Change these connections</button></details>}
    {actions.some(a=>a.kind==="summary")&&<details className="rule-card"><summary>Calculated totals after import</summary><ul>{actions.filter(a=>a.kind==="summary").map(a=><li key={a.key}>{a.text}</li>)}</ul></details>}
    {dormant>0&&<details className="rule-card" open={showSkipped} onToggle={e=>setShowSkipped(e.currentTarget.open)}><summary>Unchanged / no numeric result ({dormant}) · no action needed</summary><p>Missing or hidden grades are not zero. Special calculations remain yours to choose.</p><button onClick={()=>onManage("all")}>Manage all connections & rules</button></details>}
    <p className="hint">Import saves the connections shown and remembers them for future checks. Manual grades, dates, weights and notes stay yours. New assessments keep unknown weights; Canvas categories and marks out of 10/100 do not set assessment weights.</p>
    <div className="canvas-import-footer"><span>{editingKey?"Finish or cancel this connection before importing":`${changed} changes ready · nothing saved yet`}</span>{canUndo&&<button disabled={!!editingKey} onClick={onUndo}>Undo last change</button>}<button onClick={onClose}>Cancel</button><button className="primary" disabled={!changed||!!error||stale||!!editingKey} onClick={onImport}>{ready?`Import ${ready} ${ready===1?"grade":"grades"}`:changed?`Import ${changed} connections`:"Nothing to import"}</button></div>
  </div>;
}
