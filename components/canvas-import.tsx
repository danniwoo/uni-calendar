"use client";
import {useMemo,useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {CanvasRuleMapping} from "./canvas-rule-mapping";
import {ruleDescription} from "@/lib/canvas-rule-import";
import {canvasCandidates,canvasGrade,canvasGroupBlock,canvasKey,canvasResultLabel,canvasTargets,isCanvasRetake,planCanvasImport,readCanvasBundle,suggestCanvasMatches,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";

const existingGrade=(t?:Task)=>!t?"":t.grade?`${t.grade.earned} / ${t.grade.possible}`:t.grade===null?"Manually cleared":t.gradePlan!==undefined?"Individual-grade setup":"No grade recorded";
type GroupDraft={targetId:string;method:""|"points"|"equal"};

export function CanvasImport({semester,onApply,onClose}:{semester:Semester;onApply:(b:CanvasBundle,c:CanvasChoice[],expected:Semester)=>void;onClose:()=>void}){
  const [bundle,setBundle]=useState<CanvasBundle|null>(null),[units,setUnits]=useState<Record<string,string>>({}),[choices,setChoices]=useState<Record<string,CanvasChoice>>({}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState("");
  const [reasons,setReasons]=useState<Record<string,string>>({}),[stage,setStage]=useState<"match"|"review">("match");
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[drafts,setDrafts]=useState<Record<string,GroupDraft>>({});
  const [reviewedSemester,setReviewedSemester]=useState<Semester|null>(null);
  const preview=useMemo(()=>{if(!bundle)return null;try{return {...planCanvasImport(semester,bundle,Object.values(choices)),error:""};}catch(e){return {actions:[],changed:0,error:(e as Error).message};}},[semester,bundle,choices]);
  const staleReview=stage==="review"&&reviewedSemester!==semester;
  function changed(){setConfirmed(false);setStage("match");setReviewedSemester(null);}
  async function load(file?:File){
    if(!file)return;
    setError("");setBundle(null);setChoices({});setUnits({});setReasons({});setDrafts({});setQuery("");setFilter("all");changed();
    try{
      if(file.size>1500000)throw new Error("Maximum file size is 1.5 MB.");
      const b=readCanvasBundle(await file.text()),suggestions=suggestCanvasMatches(semester,b);
      setBundle(b);setUnits(suggestions.units);setChoices(suggestions.choices);setReasons(suggestions.reasons);
    }catch(e){setError((e as Error).message);}
  }
  function select(courseId:string,assignmentId:string,targetId:string){
    changed();setError("");
    setChoices(old=>{const next={...old},key=`${courseId}:${assignmentId}`;if(!targetId)delete next[key];else next[key]={courseId,assignmentId,unit:units[courseId],targetId,mode:"overall"};return next;});
    setReasons(old=>({...old,[`${courseId}:${assignmentId}`]:"Selected by you"}));
  }
  function group(courseId:string,groupId:string,draft:GroupDraft){
    changed();setError("");setDrafts(old=>({...old,[`${courseId}:${groupId}`]:draft}));
    const c=bundle?.courses.find(c=>c.course.id===courseId);if(!c||canvasGroupBlock(c,groupId))return;
    setChoices(old=>{
      const next={...old};
      for(const a of c.assignments.filter(a=>a.groupId===groupId)){
        const key=`${courseId}:${a.id}`;
        if(!draft.targetId||!draft.method)delete next[key];
        else next[key]={courseId,assignmentId:a.id,unit:units[courseId],targetId:draft.targetId,mode:"part",method:draft.method};
      }
      return next;
    });
  }
  const selected=Object.values(choices),total=bundle?.courses.reduce((n,c)=>n+c.assignments.length,0)||0;
  const added=selected.filter(c=>c.targetId==="new").length;
  const changedActions=preview?.actions.filter(a=>a.changed)||[],keptActions=preview?.actions.filter(a=>!a.changed&&!a.key.startsWith("summary:"))||[],ruleSummaries=preview?.actions.filter(a=>a.key.startsWith("summary:"))||[];
  return <section className="canvas-import-review">
    <h2>Import from Semester Connect</h2>
    <nav className="canvas-import-stages" aria-label="Import steps">
      <button aria-current={stage==="match"?"step":undefined} onClick={()=>{changed();}}>1 · Match assessments</button>
      <span aria-hidden="true">→</span>
      <span aria-current={stage==="review"?"step":undefined}>2 · Review &amp; confirm</span>
    </nav>
    <p>Match a Canvas item to an assessment you already have. Nothing is saved until you confirm the changes in step 2.</p>
    <p className="notice">Existing names, dates, weights, notes and completion stay unchanged. Manual or cleared grades are protected. Only unchanged Canvas-imported grades can update.</p>
    {stage==="match"&&<label className="restore-backup">Choose Connect import file<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {bundle&&<>
      <p className="hint"><strong>Canvas account {bundle.accountId}</strong> · {bundle.courses.length} courses · exported {new Date(bundle.exportedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney. File contents stay local until confirmation saves selected changes to your Semester account.</p>
      {stage==="match"?<>
        <div className="canvas-match-summary"><strong>{selected.length} matched</strong> · {total-selected.length} skipped · {added} to add
          <small>Skipped means no change. “Match existing” updates or links a grade; it does not create another assignment.</small>
        </div>
        {!bundle.courses.some(c=>c.assignments.some(a=>canvasGrade(a)))&&<p className="notice">No released numeric grades in this file. Complete/Incomplete are text results, not percentages. If Canvas shows numeric marks, reload Connect, reopen its preview and download a fresh file.</p>}
        <div className="field-pair">
          <label>Find a Canvas item<input aria-label="Find a Canvas item" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title or unit"/></label>
          <label>Show<select aria-label="Filter Canvas items" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All items</option><option value="grades">Released numeric grades</option><option value="unmatched">Not matched yet</option><option value="selected">Selected for review</option></select></label>
        </div>
        {bundle.courses.map(c=>{
          const cid=c.course.id,unit=units[cid]||"",targets=unit?canvasTargets(semester,unit):[];
          const rows=c.assignments.filter(a=>(`${a.name} ${c.course.code}`.toLowerCase().includes(query.trim().toLowerCase()))&&(filter==="all"||filter==="grades"&&!!canvasGrade(a)||filter==="unmatched"&&!choices[`${cid}:${a.id}`]||filter==="selected"&&!!choices[`${cid}:${a.id}`]));
          return <details key={cid} className="rule-card" open><summary className="canvas-course-heading">{unit||c.course.code} · {Object.values(choices).filter(v=>v.courseId===cid).length} / {c.assignments.length} matched</summary>
            <p className="hint">{c.course.name} · {c.course.term||"Term not provided"}</p>
            {c.marksPageUnavailable&&<p className="notice">Marks-page check unavailable. Compare this course with Canvas before selecting grades.</p>}
            <label>Canvas course → your unit<select aria-label={`Unit for ${c.course.code}`} value={unit} onChange={e=>{
              setUnits({...units,[cid]:e.target.value});setChoices(old=>Object.fromEntries(Object.entries(old).filter(([,v])=>v.courseId!==cid)));
              setDrafts(old=>Object.fromEntries(Object.entries(old).filter(([k])=>!k.startsWith(`${cid}:`))));changed();
            }}><option value="">Choose unit…</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label>
            {unit&&<>
              <CanvasRuleMapping key={`${cid}:${unit}`} course={c} unit={unit} targets={targets} onStage={items=>{
                changed();setError("");setChoices(old=>{
                  const next={...old};
                  for(const [key,value] of Object.entries(next))if(value.targetId===items[0].targetId&&value.courseId===cid)delete next[key];
                  for(const item of items)next[`${cid}:${item.assignmentId}`]=item;
                  return next;
                });
              }}/>
              <details className="canvas-group-mapping"><summary>Weekly quizzes / multi-part assignments · combine individual results</summary>
                <p className="hint">Choose the parent assessment and explicitly choose its calculation method. This creates grade entries, not duplicate calendar tasks. Review the full list later; Canvas may not contain future items yet.</p>
                {c.groups.filter(g=>c.assignments.some(a=>a.groupId===g.id)).map(g=>{
                  const groupChoices=c.assignments.filter(a=>a.groupId===g.id).map(a=>choices[`${cid}:${a.id}`]).filter(v=>v?.mode==="part"&&!v.rule);
                  const part=groupChoices[0],same=part&&groupChoices.every(v=>v.targetId===part.targetId&&v.method===part.method);
                  const draft=drafts[`${cid}:${g.id}`]||{targetId:same?part.targetId:"",method:same?part.method||"":""};
                  const blocked=canvasGroupBlock(c,g.id);
                  return <div className="canvas-group-row" key={g.id}>
                    <strong>{g.name}</strong>
                    {blocked?<p className="notice">{blocked}</p>:<div className="field-pair">
                      <label>Existing parent assessment<select aria-label={`Combine ${c.course.code} ${g.name}`} value={draft.targetId} onChange={e=>group(cid,g.id,{...draft,targetId:e.target.value})}><option value="">Do not combine</option>{targets.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
                      <label>Calculation rule<select aria-label={`Method for ${c.course.code} ${g.name}`} disabled={!draft.targetId} value={draft.method} onChange={e=>group(cid,g.id,{...draft,method:e.target.value as GroupDraft["method"]})}><option value="">Choose rule…</option><option value="points">Total earned ÷ total possible</option><option value="equal">Each item counts equally</option></select></label>
                    </div>}
                    {!blocked&&draft.targetId&&!draft.method&&<p className="hint">Not selected yet — choose a calculation rule to include this group.</p>}
                  </div>;
                })}
              </details>
              <p className="hint">{rows.length} of {c.assignments.length} items shown. Similar-title candidates are suggestions only; check the assignment before selecting.</p>
              <div className="canvas-import-table"><table><thead><tr><th>Canvas item &amp; result</th><th>Match in Semester</th></tr></thead><tbody>{rows.map(a=>{
                const key=`${cid}:${a.id}`,sel=choices[key],prior=semester.canvasImports?.find(r=>r.key===canvasKey(bundle,cid,a.id)),target=targets.find(t=>t.id===sel?.targetId);
                const candidates=sel?[]:canvasCandidates(semester,unit,a);
                return <tr key={a.id}><td>
                  <a href={`https://canvas.sydney.edu.au/courses/${cid}/assignments/${a.id}`} target="_blank" rel="noopener noreferrer">{a.name}</a>
                  <strong className="canvas-source-result">{canvasResultLabel(a)}</strong>
                  <small>{a.dueAt?`Due ${new Date(a.dueAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})}`:"Due not provided"}</small>
                  {isCanvasRetake(a)&&<p className="canvas-retake-warning">Retake · check highest/latest/capped-result rules. Do not count every attempt.</p>}
                </td><td>
                  {sel?.mode==="part"?<><strong>Individual result → {target?.title}</strong><small>{sel.rule?ruleDescription(sel.rule):sel.method==="points"?"Total points":"Equal weighting"} · no new calendar task</small><button onClick={()=>select(cid,a.id,"")}>Skip item</button></>:<label><span className="sr-only">Match {a.name}</span><select aria-label={`Import ${a.name}`} value={sel?.targetId||""} onChange={e=>select(cid,a.id,e.target.value)}>
                    <option value="">Skip — no change</option>
                    <optgroup label="Match an existing assessment">{targets.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>
                    <optgroup label="Only if missing from Semester"><option value="new">+ Add new assessment · weight needs review</option></optgroup>
                  </select></label>}
                  {target&&<small>In Semester: {existingGrade(target)}{target.weight?` · weight ${target.weight}`:""}<br/>Canvas: {canvasResultLabel(a)}<br/>{prior?"Saved mapping":reasons[key]||"Selected by you"} · protected values stay unchanged</small>}
                  {sel?.targetId==="new"&&<p className="canvas-retake-warning">Creates a new assignment. Check that it does not already exist under another name.</p>}
                  {candidates.length>0&&<div className="canvas-candidates"><small>Possible matches — choose only after checking:</small>{candidates.map(candidate=><button key={candidate.target.id} title={candidate.reason} onClick={()=>select(cid,a.id,candidate.target.id)}>{candidate.target.title}<small>{candidate.reason}</small></button>)}</div>}
                </td></tr>;
              })}</tbody></table>{!rows.length&&<p className="hint">No items match this filter. Clear the search or choose All items.</p>}</div>
            </>}
          </details>;
        })}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <div className="canvas-import-footer"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!selected.length||!!preview?.error} onClick={()=>{setReviewedSemester(semester);setConfirmed(false);setError("");setStage("review");}}>Review {selected.length} selected items →</button></div>
      </>:<>
        <h3>Review exactly what will change</h3>
        <p>{selected.length} selected · {total-selected.length} skipped · {added} new assessments requested. Skipped items and unrelated data stay unchanged.</p>
        {staleReview&&<p className="notice error" role="alert">Your Semester data changed while this review was open. Go back and review the updated plan before confirming.</p>}
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <section className="rule-card"><h3>{changedActions.length} changes to apply</h3>
          {changedActions.length?<ul>{changedActions.map(a=><li key={a.key}>{a.text}</li>)}</ul>:<p>No changes needed. These items are already up to date or protected.</p>}
        </section>
        {keptActions.length>0&&<section className="rule-card"><h3>{keptActions.length} kept unchanged</h3><ul>{keptActions.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {ruleSummaries.length>0&&<section className="rule-card"><h3>Calculated preview · after these changes</h3><ul>{ruleSummaries.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        {added>0&&<p className="notice">New assessments have unknown weights. Set them after importing; Canvas group weight is not an individual item's weight.</p>}
        {selected.some(c=>c.mode==="part")&&<p className="notice">Unknown results remain unresolved. See each rule summary for whether its result is settled or still in progress. Ordinary points/equal groups need a full-list review after import. Calendar completion is unchanged.</p>}
        <label className="canvas-confirm"><input type="checkbox" checked={confirmed&&!staleReview} disabled={staleReview||!!preview?.error} onChange={e=>setConfirmed(e.target.checked)}/>I checked the account, semester, unit and assessment matches, and any retake / individual-grade rules.</label>
        <div className="canvas-import-footer"><button onClick={()=>changed()}>← Back to matching</button><button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!confirmed||staleReview||!preview?.changed||!!preview?.error} onClick={()=>{try{onApply(bundle,Object.values(choices),reviewedSemester!);onClose();}catch(e){setError((e as Error).message);setConfirmed(false);}}}>Confirm {preview?.changed||0} changes</button>
        </div>
      </>}
    </>}
    {!bundle&&<button onClick={onClose}>Cancel</button>}
  </section>;
}
