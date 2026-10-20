"use client";
import {useMemo,useState} from "react";
import type {Semester} from "@/lib/semester";
import {canvasGrade,canvasKey,canvasTargets,planCanvasImport,readCanvasBundle,suggestCanvasMatches,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";

export function CanvasImport({semester,onApply,onClose}:{semester:Semester;onApply:(b:CanvasBundle,c:CanvasChoice[],expected:Semester)=>void;onClose:()=>void}){
  const [bundle,setBundle]=useState<CanvasBundle|null>(null),[units,setUnits]=useState<Record<string,string>>({}),[choices,setChoices]=useState<Record<string,CanvasChoice>>({}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState("");
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const preview=useMemo(()=>{if(!bundle)return null;try{return {...planCanvasImport(semester,bundle,Object.values(choices)),error:""};}catch(e){return {actions:[],changed:0,error:(e as Error).message};}},[semester,bundle,choices]);
  async function load(file?:File){if(!file)return;setError("");setBundle(null);setChoices({});setConfirmed(false);try{if(file.size>1500000)throw new Error("Maximum file size is 1.5 MB.");const b=readCanvasBundle(await file.text());const suggestions=suggestCanvasMatches(semester,b);setBundle(b);setUnits(suggestions.units);setChoices(suggestions.choices);setReasons(suggestions.reasons);}catch(e){setError((e as Error).message);}}
  function select(courseId:string,assignmentId:string,targetId:string){setConfirmed(false);setChoices(old=>{const next={...old},key=`${courseId}:${assignmentId}`;if(!targetId)delete next[key];else next[key]={courseId,assignmentId,unit:units[courseId],targetId,mode:"overall"};return next;});}
  function group(courseId:string,groupId:string,targetId:string,method:"points"|"equal"){
    setConfirmed(false);
    if(!bundle)return;const c=bundle.courses.find(c=>c.course.id===courseId)!;
    setChoices(old=>{const next={...old};for(const a of c.assignments.filter(a=>a.groupId===groupId)){const key=`${courseId}:${a.id}`;if(!targetId)delete next[key];else next[key]={courseId,assignmentId:a.id,unit:units[courseId],targetId,mode:"part",method};}return next;});
  }
  return <section className="canvas-import-review">
    <h2>Import from Semester Connect</h2>
    <p>Download the selected-course file in Connect, then choose it here. File contents stay in this browser until you confirm. Confirmation saves the selected changes to your signed-in Semester account.</p>
    <p className="notice">Your names, dates, weights, notes and completion stay unchanged. Manual or cleared grades are protected. Only grades still matching their last Canvas import can update—with your confirmation.</p>
    <label className="restore-backup">Choose Connect import file<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {bundle&&<>
      <p><strong>Canvas account {bundle.accountId}</strong> · {bundle.courses.length} courses · exported {new Date(bundle.exportedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney</p>
      {!bundle.courses.some(c=>c.assignments.some(a=>canvasGrade(a)))&&<p className="notice" role="status">This file contains no released numeric grades—not zero marks. If Canvas already shows scores, reload Semester Connect 0.2.1 or later, close the old preview, read your courses again and download a new file before importing.</p>}
      <p className="hint">Saved mappings are ready to reuse. Unique exact titles or Canvas links are suggested for review; similar names are not guessed. Unmatched items stay skipped. For weekly quizzes, use “Recurring / multi-part grades” to map the group once. Add new only if the assessment is missing.</p>
      <p className="canvas-match-summary"><strong>{Object.keys(choices).length} mapped</strong> · {bundle.courses.reduce((n,c)=>n+c.assignments.length,0)-Object.keys(choices).length} skipped · Review each course below</p>
      {bundle.courses.map(c=>{
        const cid=c.course.id,unit=units[cid],targets=unit?canvasTargets(semester,unit):[];
        return <details key={cid} className="rule-card" open={c===bundle.courses[0]}><summary className="canvas-course-heading">{c.course.code} · {c.assignments.length} items · {Object.values(choices).filter(v=>v.courseId===cid).length} selected</summary><p>{c.course.name} · {c.course.term||"Term not provided"} · read {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})}</p>
          {c.marksPageUnavailable&&<p className="notice">Marks-page check unavailable for this course. Compare the preview with Canvas before selecting grades.</p>}
          <label>Map to your unit<select aria-label={`Unit for ${c.course.code}`} value={unit} onChange={e=>{setUnits({...units,[cid]:e.target.value});setChoices(old=>Object.fromEntries(Object.entries(old).filter(([,v])=>v.courseId!==cid)));setConfirmed(false);}}><option value="">Choose unit…</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label>
          {unit&&<>
            <details><summary>Recurring / multi-part grades · optional</summary><p className="hint">Select a whole Canvas group and its matching assessment. Confirm points-based or equal weighting. Group weights are never copied onto each quiz. Drop-rule groups need manual review and are not combined here.</p>
              {c.groups.filter(g=>c.assignments.some(a=>a.groupId===g.id)).map(g=>{const first=c.assignments.find(a=>a.groupId===g.id)!,sel=choices[`${cid}:${first.id}`],part=sel?.mode==="part"?sel:undefined,blocked=!!(c.groupsUnavailable||g.rules.dropLowest||g.rules.dropHighest||g.rules.neverDrop.length);return <div className="field-pair" key={g.id}><label>{g.name} · {g.weight??"?"}% group<select aria-label={`Combine ${c.course.code} ${g.name}`} disabled={blocked} value={part?.targetId||""} onChange={e=>group(cid,g.id,e.target.value,part?.method||"points")}><option value="">Do not combine</option>{targets.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>{blocked&&<small>Drop rules / group data need review.</small>}</label><label>Combine results<select aria-label={`Method for ${c.course.code} ${g.name}`} disabled={!part} value={part?.method||"points"} onChange={e=>group(cid,g.id,part!.targetId,e.target.value as "points"|"equal")}><option value="points">Total points earned ÷ possible</option><option value="equal">Each item counts equally</option></select></label></div>;})}
            </details>
            <div className="canvas-import-table"><table><thead><tr><th>Canvas item</th><th>Canvas grade</th><th>Import into Semester</th></tr></thead><tbody>{c.assignments.map(a=>{const key=`${cid}:${a.id}`,sel=choices[key],g=canvasGrade(a),prior=semester.canvasImports?.find(r=>r.key===canvasKey(bundle,cid,a.id));return <tr key={a.id}><td><a href={`https://canvas.sydney.edu.au/courses/${cid}/assignments/${a.id}`} target="_blank" rel="noopener noreferrer">{a.name}</a><small>{a.dueAt?`Due ${new Date(a.dueAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})}`:"Due not provided"}</small>{prior&&<small>Saved mapping · manual changes protected</small>}{!prior&&sel&&reasons[key]&&<small>{reasons[key]}</small>}</td><td>{g?`${g.earned} / ${g.possible}`:a.submission?.excused?"Excused":a.omitted?"Excluded":a.submission?.currentAttemptGraded===false?"Earlier attempt — review":"Unavailable / non-numeric"}</td><td>{sel?.mode==="part"?<><span>Individual part → {targets.find(t=>t.id===sel.targetId)?.title}</span><button onClick={()=>select(cid,a.id,"")}>Skip item</button></>:<select aria-label={`Import ${a.name}`} value={sel?.targetId||""} onChange={e=>select(cid,a.id,e.target.value)}><option value="">Skip (no change)</option>{targets.map(t=><option key={t.id} value={t.id}>{t.title} · grade only</option>)}<option value="new">Add new assessment · weight unknown</option></select>}</td></tr>;})}</tbody></table></div>
          </>}
        </details>;
      })}
      <section className="rule-card"><h3>Changes to confirm</h3>{preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}<ul>{preview?.actions.map(a=><li key={a.key}>{a.changed?"Apply: ":"Keep: "}{a.text}</li>)}</ul><p>{preview?.changed||0} changes · all other fields stay as they are.</p><p className="hint">Imported part totals remain provisional until you review the full item list and calculation in Show grades → Edit individual grades. Future Canvas items may not exist yet.</p></section>
      <label className="canvas-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked this is my Canvas account, the correct semester/units, the matching assessments and any part calculation method.</label>
      <button className="primary" disabled={!confirmed||!preview?.changed||!!preview?.error} onClick={()=>{try{onApply(bundle,Object.values(choices),semester);onClose();}catch(e){setError((e as Error).message);setConfirmed(false);}}}>Confirm {preview?.changed||0} changes</button>
    </>}
    <button onClick={onClose}>Cancel</button>
  </section>;
}
