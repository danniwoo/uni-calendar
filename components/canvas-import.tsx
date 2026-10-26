"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Semester} from "@/lib/semester";
import {CanvasCourseMatching} from "./canvas-course-matching";
import {ruleDescription} from "@/lib/canvas-rule-import";
import {canvasUpdateStatus,defaultCanvasStage,existingCanvasRuleChoices} from "@/lib/canvas-update-status";
import {canvasGrade,canvasTargets,planCanvasImport,readCanvasBundle,suggestCanvasMatches,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";


export function CanvasImport({semester,onApply,onClose,initialRaw}:{semester:Semester;onApply:(b:CanvasBundle,c:CanvasChoice[],expected:Semester)=>void;onClose:()=>void;initialRaw?:string}){
  // Freeze the incoming snapshot for this review. Later checks never replace an
  // open review or tick its confirmation box. JSON and Connect use one parser.
  const [initial]=useState(()=>{try{const b=initialRaw?readCanvasBundle(initialRaw):null;return {bundle:b,suggestions:b?suggestCanvasMatches(semester,b):null,error:""};}catch(e){return {bundle:null,suggestions:null,error:(e as Error).message};}});
  const [bundle,setBundle]=useState<CanvasBundle|null>(initial.bundle),[units,setUnits]=useState<Record<string,string>>(initial.suggestions?.units||{}),[choices,setChoices]=useState<Record<string,CanvasChoice>>(initial.suggestions?.choices||{}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(initial.error);
  const [reasons,setReasons]=useState<Record<string,string>>(initial.suggestions?.reasons||{}),[stage,setStage]=useState<"updates"|"match"|"review">(initial.bundle?defaultCanvasStage(semester,initial.bundle):"match");
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all");
  const [activeCourse,setActiveCourse]=useState(initial.bundle?.courses[0]?.course.id||"");
  const [selectionNotice,setSelectionNotice]=useState("");
  const [touched,setTouched]=useState<Record<string,CanvasChoice|undefined>>({});
  const [undoStack,setUndoStack]=useState<{choices:Record<string,CanvasChoice>;reasons:Record<string,string>}[]>([]);
  function checkpoint(){setUndoStack(old=>[...old,{choices,reasons}]);}
  function undo(){const last=undoStack.at(-1);if(!last)return;changed();setError("");setChoices(last.choices);setReasons(last.reasons);setUndoStack(old=>old.slice(0,-1));setSelectionNotice("Last selection undone. Nothing saved.");}
  const matchingRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(stage==="match"&&filter==="unmatched")matchingRef.current?.focus();},[stage,filter]);
  const [reviewedSemester,setReviewedSemester]=useState<Semester|null>(null);
  const preview=useMemo(()=>{if(!bundle)return null;try{return {...planCanvasImport(semester,bundle,Object.values(choices)),error:""};}catch(e){return {actions:[],changed:0,error:(e as Error).message};}},[semester,bundle,choices]);
  const staleReview=stage==="review"&&reviewedSemester!==semester;
  function changed(){setConfirmed(false);setStage("match");setReviewedSemester(null);}
  async function load(file?:File){
    if(!file)return;
    setError("");setSelectionNotice("");setTouched({});setUndoStack([]);setBundle(null);setChoices({});setUnits({});setReasons({});setQuery("");setFilter("all");changed();
    try{
      if(file.size>1500000)throw new Error("Maximum file size is 1.5 MB.");
      const b=readCanvasBundle(await file.text()),suggestions=suggestCanvasMatches(semester,b);
      setBundle(b);setActiveCourse(b.courses[0]?.course.id||"");setUnits(suggestions.units);setChoices(suggestions.choices);setReasons(suggestions.reasons);setStage(defaultCanvasStage(semester,b));
    }catch(e){setError((e as Error).message);}
  }
  function select(courseId:string,assignmentId:string,targetId:string){
    changed();setError("");
    const ruleTarget=targetId.startsWith("rule:")&&bundle?existingCanvasRuleChoices(semester,bundle,courseId,units[courseId]).find(r=>r.target.id===targetId.slice(5)):undefined;
    if(targetId.startsWith("rule:")&&!ruleTarget){setError("The saved rule is no longer available. Review the assessment setup.");return;}
    const saved=targetId==="saved:"&&bundle?suggestCanvasMatches(semester,bundle).choices[`${courseId}:${assignmentId}`]:undefined;
    if(targetId==="saved:"&&!saved){setError("This saved link needs review; the assessment or rule may have changed. Nothing saved.");return;}
    checkpoint();setTouched(old=>({...old,[`${courseId}:${assignmentId}`]:choices[`${courseId}:${assignmentId}`]}));
    setChoices(old=>{const next={...old},key=`${courseId}:${assignmentId}`;if(!targetId)delete next[key];else next[key]=saved|| (ruleTarget?{courseId,assignmentId,unit:units[courseId],targetId:ruleTarget.target.id,mode:"part",rule:ruleTarget.rule}:{courseId,assignmentId,unit:units[courseId],targetId,mode:"overall"});return next;});
    setReasons(old=>({...old,[`${courseId}:${assignmentId}`]:"Selected by you"}));
    const name=bundle?.courses.find(c=>c.course.id===courseId)?.assignments.find(a=>a.id===assignmentId)?.name||"Item";
    setSelectionNotice(`${name}: ${targetId?`match staged${ruleTarget?` → ${ruleTarget.target.title} · ${ruleDescription(ruleTarget.rule)}`:""}. Review the changes below before confirming; nothing saved.`:"skipped; no change."}`);
  }
  const selected=Object.values(choices),total=bundle?.courses.reduce((n,c)=>n+c.assignments.length,0)||0;
  const added=selected.filter(c=>c.targetId==="new").length;
  const updates=bundle?canvasUpdateStatus(semester,bundle,selected,preview?.actions||[]):null;
  const ruleSummaries=preview?.actions.filter(a=>a.kind==="summary")||[];
  function manageConnections(nextFilter="unmatched",courseId?:string){changed();setFilter(nextFilter);setQuery("");if(courseId)setActiveCourse(courseId);}
  function review(){setReviewedSemester(semester);setConfirmed(false);setError("");setStage("review");}
  const unmatchedPanel=<details className="rule-card canvas-unmatched"><summary>Manage Canvas connections · optional</summary><p>Already connected assessments update without matching again. Other Canvas items may be old, ungraded or not needed in Semester; you do not need to connect everything.</p><button onClick={()=>manageConnections()}>Manage connections →</button></details>;
  return <section className="canvas-import-review">
    <h2>{stage==="updates"?"Canvas updates":stage==="match"?"Connect your assessments":"Review Canvas changes"}</h2>
    {stage!=="updates"&&<nav className="canvas-import-stages" aria-label="Import steps">
      <button aria-current={stage!=="review"?"step":undefined} onClick={changed}>1 · Choose connections</button>
      <span aria-hidden="true">→</span>
      <span aria-current={stage==="review"?"step":undefined}>2 · Review &amp; confirm</span>
    </nav>}
    <p>{stage==="updates"?"Only changes in this batch. Nothing is saved until you review and confirm.":"Match a Canvas item to an assessment you already have. Nothing is saved until you confirm the changes in step 2."}</p>
    {stage!=="updates"&&<p className="notice">Existing names, dates, weights, notes and completion stay unchanged. Manual or cleared grades are protected. Only unchanged Canvas-imported grades can update.</p>}
    {stage==="match"&&<details open={!bundle}><summary>JSON import · testing / manual fallback</summary><label className="restore-backup">Choose a Connect export<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label></details>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {bundle&&<>
      <p className="hint"><strong>Canvas account {bundle.accountId}</strong> · {bundle.courses.length} courses · exported {new Date(bundle.exportedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney · preview only.</p>
      {updates&&!preview?.error&&<>
        {updates.attention.length>0&&<section className="rule-card"><h3>Rules / source changes need review</h3><ul>{updates.attention.map(a=><li key={a.key}>{a.text}</li>)}</ul><p>These changes will not be applied.</p></section>}
      </>}
      {stage==="updates"?<>
        <section className="rule-card"><h3>{updates?.grades.length?`${updates.grades.length} grade ${updates.grades.length===1?"update":"updates"} ready to review`:"No new grade changes to apply"}</h3>{updates?.grades.length?<ul>{updates.grades.map(a=><li key={a.key}>{a.text}</li>)}</ul>:<p>Your connected results have no applicable changes in this check. You do not need to match ungraded items to finish.</p>}</section>
        {!!updates?.resultsToConnect.length&&<section className="rule-card"><h3>{updates.resultsToConnect.length} {updates.resultsToConnect.length===1?"result needs":"results need"} a destination</h3><p>These results are available in Canvas but are not connected yet. Check the suggested assessment before saving.</p><ul>{updates.resultsToConnect.map(a=><li key={a.key}>{a.course} · {a.name} · <strong>{a.result}</strong> <button onClick={()=>manageConnections("results",a.key.split(":")[0])}>Connect result…</button></li>)}</ul></section>}
        {unmatchedPanel}
        {!!updates?.protected.length&&<details className="rule-card"><summary>{updates.protected.length} manual entries protected · no overwrite</summary><ul>{updates.protected.map(a=><li key={a.key}>{a.text}</li>)}</ul><p>Kept exactly as you entered them; not overwritten.</p></details>}
        {!!updates?.otherChanges.length&&<section className="rule-card"><h3>Other proposed changes · review required</h3><ul>{updates.otherChanges.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        <details className="rule-card"><summary>{updates?.unchanged.length||0} unchanged / no new result · source details</summary><ul>{updates?.unchanged.map(a=><li key={a.key}>{a.text}</li>)}</ul>{bundle.courses.map(c=><p key={c.course.id}>{c.course.code} · checked {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney{c.marksPageUnavailable?" · Marks-page check unavailable — compare with Canvas":""}</p>)}<button onClick={()=>{changed();setFilter("all");}}>Inspect all matches / calculation rules</button></details>
        <details className="rule-card"><summary>JSON fallback &amp; import safeguards</summary><p className="hint">Manual grades, names, dates, weights, notes and completion stay unchanged. Nothing is saved until confirmation. Keep a JSON export to review this pending batch later.</p><label>Choose another file<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label></details>
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <div className="canvas-import-footer"><button onClick={onClose}>Close · save nothing</button>{!!preview?.changed&&<button className="primary" disabled={!!preview.error} onClick={review}>Review {preview.changed} {preview.changed===1?"change":"changes"} →</button>}</div>
      </>:stage==="match"?<>
        <div ref={matchingRef} tabIndex={-1}><button onClick={()=>{setConfirmed(false);setStage("updates");}}>← Back to update summary</button></div>
        {selectionNotice&&<p className="notice" role="status">{selectionNotice}</p>}
        {undoStack.length>0&&<button onClick={undo}>Undo last selection</button>}
        <p className="hint">{preview?.changed||0} proposed changes · confirmed connections are reused. Nothing is saved yet.</p>
        {!bundle.courses.some(c=>c.assignments.some(a=>canvasGrade(a)))&&<p className="notice">No released numeric grades in this file. Complete/Incomplete are text results, not percentages. If Canvas shows numeric marks, reload Connect, reopen its preview and download a fresh file.</p>}
        <div className="field-pair">
          <label>Find a Canvas item<input aria-label="Find a Canvas item" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title or unit"/></label>
          <label>Show<select aria-label="Filter Canvas items" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All Canvas items</option><option value="results">Results needing a connection</option><option value="grades">Released numeric grades</option><option value="unmatched">Not connected yet</option><option value="selected">Connected / staged</option></select></label>
        </div>
        <nav className="canvas-course-nav" aria-label="Choose course">{bundle.courses.map(c=><button key={c.course.id} aria-pressed={activeCourse===c.course.id} onClick={()=>setActiveCourse(c.course.id)}>{units[c.course.id]||c.course.code}</button>)}</nav>
        {bundle.courses.filter(c=>c.course.id===activeCourse).map(c=>{
          const cid=c.course.id,unit=units[cid]||"",targets=unit?canvasTargets(semester,unit):[];
          const rows=c.assignments.filter(a=>(`${a.name} ${c.course.code}`.toLowerCase().includes(query.trim().toLowerCase()))&&(filter==="all"||filter==="results"&&(updates?.resultsToConnect.some(r=>r.key===`${cid}:${a.id}`)||Object.hasOwn(touched,`${cid}:${a.id}`))||filter==="grades"&&!!canvasGrade(a)||filter==="unmatched"&&(!choices[`${cid}:${a.id}`]||Object.hasOwn(touched,`${cid}:${a.id}`))||filter==="selected"&&!!choices[`${cid}:${a.id}`]));
          return <section key={cid} className="rule-card"><h3 className="canvas-course-heading">{unit||c.course.code}</h3>
            <p className="hint">{c.course.name} · {c.course.term||"Term not provided"} · checked {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney</p>
            {c.marksPageUnavailable&&<p className="notice">Marks-page check unavailable. Compare this course with Canvas before selecting grades.</p>}
            <details open={!unit}><summary>Semester unit: {unit||"Choose your unit"} · change</summary><label>Canvas course → your unit<select aria-label={`Unit for ${c.course.code}`} value={unit} onChange={e=>{
              setUndoStack([]);setTouched({});setUnits({...units,[cid]:e.target.value});setChoices(old=>Object.fromEntries(Object.entries(old).filter(([,v])=>v.courseId!==cid)));
              changed();
            }}><option value="">Choose unit…</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label></details>
            {unit&&<>
              <CanvasCourseMatching key={`${cid}:${unit}`} semester={semester} bundle={bundle} course={c} unit={unit} rows={rows} targets={targets} choices={choices} actions={preview?.actions||[]} touched={touched} onSelect={(id,target)=>select(cid,id,target)} onStage={items=>{
                checkpoint();setTouched(old=>({...old,...Object.fromEntries(items.map(i=>[`${cid}:${i.assignmentId}`,choices[`${cid}:${i.assignmentId}`]]))}));
                changed();setError("");setChoices(old=>({...old,...Object.fromEntries(items.map(i=>[`${cid}:${i.assignmentId}`,i]))}));
                setSelectionNotice(`${items.length} connections staged. Review before saving; use Undo to reverse.`);
              }}/>

            </>}
          </section>;
        })}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        {filter==="unmatched"&&!updates?.unmatched.length&&<p role="status">All items have a selected match. Nothing saved yet — review the proposed changes below.</p>}
        <div className="canvas-import-footer">{undoStack.length>0&&<button onClick={undo}>Undo last selection</button>}<button onClick={onClose}>Cancel</button><button className="primary" disabled={!preview?.changed||!!preview?.error} onClick={review}>Review {preview?.changed||0} {preview?.changed===1?"change":"changes"} →</button></div>
      </>:<>
        <h3>Review exactly what will change</h3>
        <p>{selected.length} selected · {total-selected.length} skipped · {added} new assessments requested. Skipped items and unrelated data stay unchanged.</p>
        {staleReview&&<p className="notice error" role="alert">Your Semester data changed while this review was open. Go back and review the updated plan before confirming.</p>}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <section className="rule-card"><h3>{updates?.grades.length||0} new / updated results</h3>
          {updates?.grades.length?<ul>{updates.grades.map(a=><li key={a.key}>{a.text}</li>)}</ul>:<p>No new applicable result. Unknown or hidden results are not zero.</p>}
        </section>
        {!!updates?.protected.length&&<section className="rule-card"><h3>{updates.protected.length} manual entries protected</h3><p>These values will not be overwritten. A first-time source link may be saved without changing the grade.</p><ul>{updates.protected.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {!!updates?.otherChanges.length&&<section className="rule-card"><h3>{updates.otherChanges.length} other changes · links / new items</h3><ul>{updates.otherChanges.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {!!updates?.unchanged.length&&<details className="rule-card"><summary>{updates.unchanged.length} unchanged / no new result</summary><ul>{updates.unchanged.map(a=><li key={a.key}>{a.text}</li>)}</ul></details>}
        {ruleSummaries.length>0&&<section className="rule-card"><h3>Calculated preview · after these changes</h3><ul>{ruleSummaries.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {added>0&&<p className="notice">New assessments have unknown weights. Set them after importing; Canvas group weight is not an individual item’s weight.</p>}
        {selected.some(c=>c.mode==="part")&&<p className="notice">Unknown results remain unresolved. See each rule summary for whether its result is settled or still in progress. Ordinary points/equal groups need a full-list review after import. Calendar completion is unchanged.</p>}
        <label className="canvas-confirm"><input type="checkbox" checked={confirmed&&!staleReview} disabled={staleReview||!!preview?.error} onChange={e=>setConfirmed(e.target.checked)}/>I checked the account, semester, unit and assessment matches, and any retake / individual-grade rules.</label>
        <div className="canvas-import-footer"><button onClick={()=>changed()}>← Back to matching</button><button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!confirmed||staleReview||!preview?.changed||!!preview?.error} onClick={()=>{try{onApply(bundle,Object.values(choices),reviewedSemester!);onClose();}catch(e){setError((e as Error).message);setConfirmed(false);}}}>Confirm {preview?.changed||0} {preview?.changed===1?"change":"changes"}</button>
        </div>
      </>}
    </>}
    {!bundle&&<button onClick={onClose}>Cancel</button>}
  </section>;
}
