"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Semester} from "@/lib/semester";
import {CanvasCourseMatching} from "./canvas-course-matching";
import {CanvasPrepared} from "./canvas-prepared";
import {prepareCanvasImport} from "@/lib/canvas-prepare";
import {ruleDescription} from "@/lib/canvas-rule-import";
import {canvasUpdateStatus,isNewerCanvasBatch,defaultCanvasStage,existingCanvasRuleChoices} from "@/lib/canvas-update-status";
import {canvasGrade,canvasTargets,planCanvasImport,readCanvasBundle,suggestCanvasMatches,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";


export function CanvasImport({semester,onApply,onClose,initialRaw}:{semester:Semester;onApply:(b:CanvasBundle,c:CanvasChoice[],expected:Semester)=>void;onClose:()=>void;initialRaw?:string}){
  // Freeze the incoming snapshot for this review. Later checks never replace an
  // open review or tick its confirmation box. JSON and Connect use one parser.
  const [initial]=useState(()=>{try{const b=initialRaw?readCanvasBundle(initialRaw):null;return {bundle:b,suggestions:b?prepareCanvasImport(semester,b):null,error:""};}catch(e){return {bundle:null,suggestions:null,error:(e as Error).message};}});
  const [bundle,setBundle]=useState<CanvasBundle|null>(initial.bundle),[units,setUnits]=useState<Record<string,string>>(initial.suggestions?.units||{}),[choices,setChoices]=useState<Record<string,CanvasChoice>>(initial.suggestions?.choices||{}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(initial.error);
  const [reasons,setReasons]=useState<Record<string,string>>(initial.suggestions?.reasons||{}),[stage,setStage]=useState<"prepared"|"match"|"review">(initial.bundle?defaultCanvasStage(semester,initial.bundle):"match");
  const [preparedSemester,setPreparedSemester]=useState(semester);
  const prepared=useMemo(()=>bundle?prepareCanvasImport(preparedSemester,bundle):null,[preparedSemester,bundle]);
  const baselineActions=useMemo(()=>{try{return bundle&&prepared?planCanvasImport(preparedSemester,bundle,Object.values(prepared.choices)).actions:[];}catch{return [];}},[preparedSemester,bundle,prepared]);
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all");
  const [activeCourse,setActiveCourse]=useState(initial.bundle?.courses[0]?.course.id||"");
  const [selectionNotice,setSelectionNotice]=useState("");
  const [newerBatch,setNewerBatch]=useState<CanvasBundle|null>(null),[replacePrompt,setReplacePrompt]=useState(false);
  const [touched,setTouched]=useState<Record<string,CanvasChoice|undefined>>({});
  const [undoStack,setUndoStack]=useState<{choices:Record<string,CanvasChoice>;reasons:Record<string,string>}[]>([]);
  function checkpoint(){setUndoStack(old=>[...old,{choices,reasons}]);}
  function undo(){const last=undoStack.at(-1);if(!last)return;changed();if(stage==="prepared")setStage(stage);setError("");setChoices(last.choices);setReasons(last.reasons);setUndoStack(old=>old.slice(0,-1));setSelectionNotice("Last selection undone. Nothing saved.");}
  const matchingRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(stage==="match"&&filter==="unmatched")matchingRef.current?.focus();},[stage,filter]);
  const [reviewedSemester,setReviewedSemester]=useState<Semester|null>(null);
  useEffect(()=>{
    if(!bundle)return;
    const receive=(e:MessageEvent)=>{
      if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-connect-inbox-v1")return;
      const raw=e.data.inbox?.raw;if(typeof raw!=="string"||raw.length>1500000)return;
      try{const incoming=readCanvasBundle(raw);if(isNewerCanvasBatch(bundle,incoming))setNewerBatch(old=>!old||isNewerCanvasBatch(old,incoming)?incoming:old);}catch{/* Malformed or unrelated messages never replace a review. */}
    };
    window.addEventListener("message",receive);window.postMessage({type:"semester-connect-request-v1"},location.origin);
    return()=>window.removeEventListener("message",receive);
  },[bundle]);
  function replaceBatch(){if(!newerBatch)return;const suggestions=prepareCanvasImport(semester,newerBatch);setPreparedSemester(semester);setBundle(newerBatch);setUnits(suggestions.units);setChoices(suggestions.choices);setReasons(suggestions.reasons);setTouched({});setUndoStack([]);setConfirmed(false);setReviewedSemester(null);setSelectionNotice("");setError("");setQuery("");setFilter("all");setActiveCourse(newerBatch.courses[0]?.course.id||"");setStage("prepared");setNewerBatch(null);setReplacePrompt(false);}
  function refreshPrepared(){if(!bundle)return;const p=prepareCanvasImport(semester,bundle);setPreparedSemester(semester);setUnits(p.units);setChoices(p.choices);setReasons(p.reasons);setUndoStack([]);setTouched({});setError("");}
  const preview=useMemo(()=>{if(!bundle)return null;try{return {...planCanvasImport(semester,bundle,Object.values(choices)),error:""};}catch(e){return {actions:[],changed:0,error:(e as Error).message};}},[semester,bundle,choices]);
  const staleReview=stage==="review"&&reviewedSemester!==semester;
  function changed(){setConfirmed(false);setStage("match");setReviewedSemester(null);}
  async function load(file?:File){
    if(!file)return;
    setError("");setSelectionNotice("");setTouched({});setUndoStack([]);setNewerBatch(null);setReplacePrompt(false);setBundle(null);setChoices({});setUnits({});setReasons({});setQuery("");setFilter("all");changed();
    try{
      if(file.size>1500000)throw new Error("Maximum file size is 1.5 MB.");
      const b=readCanvasBundle(await file.text()),suggestions=prepareCanvasImport(semester,b);setPreparedSemester(semester);
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
  const batchKey=bundle?.courses.map(c=>`${c.course.id}:${c.fetchedAt}`).join("|");
  function manageConnections(nextFilter="unmatched",courseId?:string){changed();setFilter(nextFilter);setQuery("");if(courseId)setActiveCourse(courseId);}
  function review(){setReviewedSemester(semester);setConfirmed(false);setError("");setStage("review");}
  function stageConnections(items:CanvasChoice[],returnTo:"prepared"|"match"="match"){
    checkpoint();setTouched(old=>({...old,...Object.fromEntries(items.map(i=>[`${i.courseId}:${i.assignmentId}`,choices[`${i.courseId}:${i.assignmentId}`]]))}));
    changed();setStage(returnTo);setError("");setChoices(old=>({...old,...Object.fromEntries(items.map(i=>[`${i.courseId}:${i.assignmentId}`,i]))}));
    setSelectionNotice(`${items.length} connections staged. Nothing saved; use Undo to reverse.`);
  }
  return <section className="canvas-import-review">
    {stage!=="prepared"&&<h2>{stage==="match"?"Connect your assessments":"Review Canvas changes"}</h2>}
    {stage!=="prepared"&&<nav className="canvas-import-stages" aria-label="Import steps">
      <button aria-current={stage!=="review"?"step":undefined} onClick={changed}>1 · Choose connections</button>
      <span aria-hidden="true">→</span>
      <span aria-current={stage==="review"?"step":undefined}>2 · Review &amp; confirm</span>
    </nav>}
    {stage!=="prepared"&&<p>Manage connections and calculation rules. Nothing is saved until you import.</p>}
    {stage!=="prepared"&&<p className="notice">Existing names, dates, weights, notes and completion stay unchanged. Manual or cleared grades are protected. Only unchanged Canvas-imported grades can update.</p>}
    {stage==="match"&&<details open={!bundle}><summary>JSON import · testing / manual fallback</summary><label className="restore-backup">Choose a Connect export<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label></details>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {bundle&&<>
      <details className="canvas-batch-details"><summary>{bundle.courses.length} courses · batch checked {new Date(bundle.exportedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney</summary><p>Canvas account {bundle.accountId}. This review keeps this batch until you choose another. Check all reads every selected course; you do not need to refresh each Marks page.</p>{bundle.courses.map(c=><p key={c.course.id}>{units[c.course.id]||c.course.code} · last read {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney{c.marksPageUnavailable?" · Marks page unavailable; compare with Canvas":""}</p>)}</details>
      {newerBatch&&<aside className="notice canvas-newer-batch" role="status"><strong>A newer Canvas check is available</strong><p>You are still reviewing the batch above. Your current choices have not been replaced.</p>{replacePrompt?<><p>Switching discards this review’s unsaved choices. Saved grades and manual data stay unchanged.</p><button onClick={replaceBatch}>Discard draft & open newer batch</button><button onClick={()=>setReplacePrompt(false)}>Keep this review</button></>:<button onClick={()=>setReplacePrompt(true)}>View newer check…</button>}</aside>}
      {updates&&!preview?.error&&<>
        {updates.attention.length>0&&<section className="rule-card"><h3>Rules / source changes need review</h3><ul>{updates.attention.map(a=><li key={a.key}>{a.text}</li>)}</ul><p>These changes will not be applied.</p></section>}
      </>}
      {stage==="prepared"&&prepared?<>
        <CanvasPrepared key={batchKey} semester={semester} afterSemester={preview&&"semester" in preview?preview.semester:semester} bundle={bundle} prepared={{...prepared,units}} choices={choices} actions={preview?.actions||[]} baselineActions={baselineActions} changed={preview?.changed||0} error={preview?.error} stale={preparedSemester!==semester} onRefresh={refreshPrepared} onSelect={(cid,aid,target)=>{select(cid,aid,target);setStage("prepared");}} onStage={items=>stageConnections(items,"prepared")} onManage={manageConnections} onUndo={undo} canUndo={undoStack.length>0} onClose={onClose} onImport={()=>{try{if(preparedSemester!==semester)throw new Error("Your board changed. Refresh suggestions first.");onApply(bundle,Object.values(choices),preparedSemester);onClose();}catch(e){setError((e as Error).message);}}}/>
        <details><summary>Use a JSON export instead</summary><label>Choose a Connect export<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label></details>
      </>:stage==="match"?<>
        <div ref={matchingRef} tabIndex={-1}><button onClick={()=>{setConfirmed(false);setStage("prepared");}}>← Back to prepared import</button></div>
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
              <CanvasCourseMatching key={`${cid}:${unit}`} semester={semester} bundle={bundle} course={c} unit={unit} rows={rows} targets={targets} choices={choices} actions={preview?.actions||[]} touched={touched} onSelect={(id,target)=>select(cid,id,target)} onStage={items=>stageConnections(items)}/>

            </>}
          </section>;
        })}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        {filter==="unmatched"&&!updates?.unmatched.length&&<p role="status">All items have a selected match. Nothing saved yet — review the proposed changes below.</p>}
        <div className="canvas-import-footer">{undoStack.length>0&&<button onClick={undo}>Undo last selection</button>}<button onClick={onClose}>Cancel</button><button className="primary" disabled={!preview?.changed||!!preview?.error} onClick={review}>Review {preview?.changed||0} {preview?.changed===1?"change":"changes"} →</button></div>
      </>:<>
        <h3>Review exactly what will change</h3>
        <p>{preview?.changed||0} changes will be saved when you click Import. Everything else stays unchanged.</p>
        {staleReview&&<p className="notice error" role="alert">Your Semester data changed while this review was open. Go back and review the updated plan before confirming.</p>}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <section className="rule-card"><h3>{updates?.grades.length||0} new / updated results</h3>
          {updates?.grades.length?<ul>{updates.grades.map(a=><li key={a.key}>{a.text}</li>)}</ul>:<p>No new applicable result. Unknown or hidden results are not zero.</p>}
        </section>
        {!!updates?.protected.length&&<details className="rule-card"><summary>{updates.protected.length} manual values kept · not overwritten</summary><p>A first-time source link may be saved without changing the grade.</p><ul>{updates.protected.map(a=><li key={a.key}>{a.text}</li>)}</ul></details>}
        {!!updates?.otherChanges.length&&<section className="rule-card"><h3>{updates.otherChanges.length} other changes · links / new items</h3><ul>{updates.otherChanges.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {!!updates?.unchanged.length&&<details className="rule-card"><summary>{updates.unchanged.length} unchanged / no new result</summary><ul>{updates.unchanged.map(a=><li key={a.key}>{a.text}</li>)}</ul></details>}
        <details className="canvas-batch-details"><summary>All items in this check · selection details</summary><p>{selected.length} connected / staged · {total-selected.length} skipped · {added} new assessments requested. These are selection counts, not the number of grade updates.</p></details>
        {ruleSummaries.length>0&&<section className="rule-card"><h3>Calculated preview · after these changes</h3><ul>{ruleSummaries.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {added>0&&<p className="notice">New assessments have unknown weights. Set them after importing; Canvas group weight is not an individual item’s weight.</p>}
        {selected.some(c=>c.mode==="part")&&<p className="notice">Unknown results remain unresolved. See each rule summary for whether its result is settled or still in progress. Ordinary points/equal groups need a full-list review after import. Calendar completion is unchanged.</p>}
        <label className="canvas-confirm"><input type="checkbox" checked={confirmed&&!staleReview} disabled={staleReview||!!preview?.error} onChange={e=>setConfirmed(e.target.checked)}/>I checked the account, semester, unit and assessment matches, and any retake / individual-grade rules.</label>
        <div className="canvas-import-footer"><button onClick={changed}>← Back to matching</button><button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!confirmed||staleReview||!preview?.changed||!!preview?.error} onClick={()=>{try{onApply(bundle,Object.values(choices),reviewedSemester!);onClose();}catch(e){setError((e as Error).message);setConfirmed(false);}}}>Import {preview?.changed||0} {preview?.changed===1?"change":"changes"}</button>
        </div>
      </>}
    </>}
    {!bundle&&<button onClick={onClose}>Cancel</button>}
  </section>;
}
