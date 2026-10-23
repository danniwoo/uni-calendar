"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {CanvasRuleMapping} from "./canvas-rule-mapping";
import {ruleDescription} from "@/lib/canvas-rule-import";
import {canvasUpdateStatus,defaultCanvasStage,existingCanvasRuleChoices} from "@/lib/canvas-update-status";
import {canvasCandidates,canvasGrade,canvasGroupBlock,canvasKey,canvasResultLabel,canvasTargets,isCanvasRetake,planCanvasImport,readCanvasBundle,suggestCanvasMatches,type CanvasBundle,type CanvasChoice} from "@/lib/canvas-import";

const existingGrade=(t?:Task)=>!t?"":t.grade?`${t.grade.earned} / ${t.grade.possible}`:t.grade===null?"Manually cleared":t.gradePlan!==undefined?"Individual-grade setup":"No grade recorded";
type GroupDraft={targetId:string;method:""|"points"|"equal"};

export function CanvasImport({semester,onApply,onClose,initialRaw}:{semester:Semester;onApply:(b:CanvasBundle,c:CanvasChoice[],expected:Semester)=>void;onClose:()=>void;initialRaw?:string}){
  // Freeze the incoming snapshot for this review. Later checks never replace an
  // open review or tick its confirmation box. JSON and Connect use one parser.
  const [initial]=useState(()=>{try{const b=initialRaw?readCanvasBundle(initialRaw):null;return {bundle:b,suggestions:b?suggestCanvasMatches(semester,b):null,error:""};}catch(e){return {bundle:null,suggestions:null,error:(e as Error).message};}});
  const [bundle,setBundle]=useState<CanvasBundle|null>(initial.bundle),[units,setUnits]=useState<Record<string,string>>(initial.suggestions?.units||{}),[choices,setChoices]=useState<Record<string,CanvasChoice>>(initial.suggestions?.choices||{}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(initial.error);
  const [reasons,setReasons]=useState<Record<string,string>>(initial.suggestions?.reasons||{}),[stage,setStage]=useState<"updates"|"match"|"review">(initial.bundle?defaultCanvasStage(semester,initial.bundle):"match");
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[drafts,setDrafts]=useState<Record<string,GroupDraft>>({});
  const [selectionNotice,setSelectionNotice]=useState("");
  const matchingRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(stage==="match"&&filter==="unmatched")matchingRef.current?.focus();},[stage,filter]);
  const [reviewedSemester,setReviewedSemester]=useState<Semester|null>(null);
  const preview=useMemo(()=>{if(!bundle)return null;try{return {...planCanvasImport(semester,bundle,Object.values(choices)),error:""};}catch(e){return {actions:[],changed:0,error:(e as Error).message};}},[semester,bundle,choices]);
  const staleReview=stage==="review"&&reviewedSemester!==semester;
  function changed(){setConfirmed(false);setStage("match");setReviewedSemester(null);}
  async function load(file?:File){
    if(!file)return;
    setError("");setSelectionNotice("");setBundle(null);setChoices({});setUnits({});setReasons({});setDrafts({});setQuery("");setFilter("all");changed();
    try{
      if(file.size>1500000)throw new Error("Maximum file size is 1.5 MB.");
      const b=readCanvasBundle(await file.text()),suggestions=suggestCanvasMatches(semester,b);
      setBundle(b);setUnits(suggestions.units);setChoices(suggestions.choices);setReasons(suggestions.reasons);setStage(defaultCanvasStage(semester,b));
    }catch(e){setError((e as Error).message);}
  }
  function select(courseId:string,assignmentId:string,targetId:string){
    changed();setError("");
    const ruleTarget=targetId.startsWith("rule:")&&bundle?existingCanvasRuleChoices(semester,bundle,courseId,units[courseId]).find(r=>r.target.id===targetId.slice(5)):undefined;
    if(targetId.startsWith("rule:")&&!ruleTarget){setError("The saved rule is no longer available. Review the assessment setup.");return;}
    setChoices(old=>{const next={...old},key=`${courseId}:${assignmentId}`;if(!targetId)delete next[key];else next[key]=ruleTarget?{courseId,assignmentId,unit:units[courseId],targetId:ruleTarget.target.id,mode:"part",rule:ruleTarget.rule}:{courseId,assignmentId,unit:units[courseId],targetId,mode:"overall"};return next;});
    setReasons(old=>({...old,[`${courseId}:${assignmentId}`]:"Selected by you"}));
    const name=bundle?.courses.find(c=>c.course.id===courseId)?.assignments.find(a=>a.id===assignmentId)?.name||"Item";
    setSelectionNotice(`${name}: ${targetId?`match staged${ruleTarget?` → ${ruleTarget.target.title} · ${ruleDescription(ruleTarget.rule)}`:""}. Review the changes below before confirming; nothing saved.`:"skipped; no change."}`);
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
  const updates=bundle?canvasUpdateStatus(semester,bundle,selected,preview?.actions||[]):null;
  const ruleSummaries=preview?.actions.filter(a=>a.kind==="summary")||[];
  function resolveUnmatched(){changed();setFilter("unmatched");setQuery("");}
  function review(){setReviewedSemester(semester);setConfirmed(false);setError("");setStage("review");}
  return <section className="canvas-import-review">
    <h2>{stage==="updates"?"Canvas updates · review before saving":"Import from Semester Connect"}</h2>
    <nav className="canvas-import-stages" aria-label="Import steps">
      <button aria-current={stage!=="review"?"step":undefined} onClick={()=>{if(stage!=="updates")changed();}}>1 · {stage==="updates"?"Update summary":"Match assessments"}</button>
      <span aria-hidden="true">→</span>
      <span aria-current={stage==="review"?"step":undefined}>2 · Review &amp; confirm</span>
    </nav>
    <p>{stage==="updates"?"Your saved matches are reused. Review only changes and items needing a decision; nothing is saved yet.":"Match a Canvas item to an assessment you already have. Nothing is saved until you confirm the changes in step 2."}</p>
    <p className="notice">Existing names, dates, weights, notes and completion stay unchanged. Manual or cleared grades are protected. Only unchanged Canvas-imported grades can update.</p>
    {stage==="match"&&<label className="restore-backup">JSON import · testing / manual fallback<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {bundle&&<>
      <p className="hint"><strong>Canvas account {bundle.accountId}</strong> · {bundle.courses.length} courses · exported {new Date(bundle.exportedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney. File contents stay local until confirmation saves selected changes to your Semester account.</p>
      {updates&&!preview?.error&&<>
        <div className="canvas-update-summary" aria-label="Canvas update summary">
          <div><strong>{updates.grades.length}</strong><span>New / updated results</span><small>Preview only · not saved</small></div>
          <div><strong>{updates.unmatched.length}</strong><span>Items not matched</span><small>{updates.unmatched.filter(a=>a.isNew).length} never linked · not added automatically</small></div>
          <div><strong>{updates.protected.length}</strong><span>Manual data protected</span><small>Grades, rules or removed entries kept</small></div>
        </div>
        {updates.unmatched.length>0&&<section className="rule-card"><h3>{updates.unmatched.length} items need matching · currently skipped</h3><p>These Canvas items are not selected for import. Choose where they belong, or leave them skipped. Skipped does not mean zero.</p><ul>{updates.unmatched.map(a=><li key={a.key}><strong>{a.course} · {a.name}</strong> — {a.isNew?"Not previously linked":"Saved link not selected"}</li>)}</ul><button onClick={resolveUnmatched}>Resolve unmatched items →</button><p className="hint">This opens matching, not confirmation. Choose an existing assessment or its saved rule, then Review changes → confirm only after checking. No new task is required for a prework or retake entry.</p></section>}
        {updates.attention.length>0&&<section className="rule-card"><h3>Rules / source changes need review</h3><ul>{updates.attention.map(a=><li key={a.key}>{a.text}</li>)}</ul><p>These changes will not be applied.</p></section>}
      </>}
      {stage==="updates"?<>
        <section className="rule-card"><h3>{updates?.grades.length||0} new / updated results</h3>{updates?.grades.length?<ul>{updates.grades.map(a=><li key={a.key}>{a.text}</li>)}</ul>:<p>No new applicable grade changes. Existing results are already up to date or protected.</p>}</section>
        {!!updates?.protected.length&&<section className="rule-card"><h3>{updates.protected.length} manual entries protected</h3><ul>{updates.protected.map(a=><li key={a.key}>{a.text}</li>)}</ul><p>Kept exactly as you entered them; not overwritten.</p></section>}
        {!!updates?.otherChanges.length&&<section className="rule-card"><h3>Other proposed changes · review required</h3><ul>{updates.otherChanges.map(a=><li key={a.key}>{a.text}</li>)}</ul></section>}
        <details className="rule-card"><summary>{updates?.unchanged.length||0} unchanged / no new result · source details</summary><ul>{updates?.unchanged.map(a=><li key={a.key}>{a.text}</li>)}</ul>{bundle.courses.map(c=><p key={c.course.id}>{c.course.code} · checked {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney{c.marksPageUnavailable?" · Marks-page check unavailable — compare with Canvas":""}</p>)}<button onClick={()=>{changed();setFilter("all");}}>Inspect all matches / calculation rules</button></details>
        <details className="rule-card"><summary>JSON import · testing / manual fallback</summary><label>Choose another file<input aria-label="Choose Connect import file" type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value="";}}/></label></details>
        {preview?.error&&<p role="alert" className="notice error">{preview.error}</p>}
        <div className="canvas-import-footer"><button onClick={onClose}>Close · save nothing</button><button className="primary" disabled={!preview?.changed||!!preview.error} onClick={review}>Review {preview?.changed||0} changes →</button></div>
      </>:stage==="match"?<>
        <div ref={matchingRef} tabIndex={-1} className="rule-card"><h3>{filter==="unmatched"?"Resolve unmatched items":"Assessment matching"}</h3>{filter==="unmatched"&&<p>Below, choose a destination for each item. For prework / retakes, use “Add an individual result using a saved rule”. A missing result stays unknown. Leave Skip selected if unsure.</p>}<button onClick={()=>{setConfirmed(false);setStage("updates");}}>← Back to update summary</button></div>
        {selectionNotice&&<p className="notice" role="status">{selectionNotice}</p>}
        <div className="canvas-match-summary"><strong>{selected.length} matched</strong> · {total-selected.length} skipped · {added} to add
          <small>Skipped means no change. “Match existing” updates or links a grade; it does not create another assignment.</small>
        </div>
        {!bundle.courses.some(c=>c.assignments.some(a=>canvasGrade(a)))&&<p className="notice">No released numeric grades in this file. Complete/Incomplete are text results, not percentages. If Canvas shows numeric marks, reload Connect, reopen its preview and download a fresh file.</p>}
        <div className="field-pair">
          <label>Find a Canvas item<input aria-label="Find a Canvas item" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title or unit"/></label>
          <label>Show<select aria-label="Filter Canvas items" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All items</option><option value="grades">Released numeric grades</option><option value="unmatched">Not matched yet</option><option value="selected">Selected for review</option></select></label>
        </div>
        {bundle.courses.map(c=>{
          const cid=c.course.id,unit=units[cid]||"",targets=unit?canvasTargets(semester,unit):[],savedRules=existingCanvasRuleChoices(semester,bundle,cid,unit);
          const rows=c.assignments.filter(a=>(`${a.name} ${c.course.code}`.toLowerCase().includes(query.trim().toLowerCase()))&&(filter==="all"||filter==="grades"&&!!canvasGrade(a)||filter==="unmatched"&&!choices[`${cid}:${a.id}`]||filter==="selected"&&!!choices[`${cid}:${a.id}`]));
          if(filter==="unmatched"&&!rows.length)return null;
          return <details key={cid} className="rule-card" open><summary className="canvas-course-heading">{unit||c.course.code} · {Object.values(choices).filter(v=>v.courseId===cid).length} / {c.assignments.length} matched</summary>
            <p className="hint">{c.course.name} · {c.course.term||"Term not provided"} · checked {new Date(c.fetchedAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} Sydney</p>
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
                    {savedRules.length>0&&<optgroup label="Add an individual result using a saved rule">{savedRules.map(r=><option key={r.target.id} value={`rule:${r.target.id}`}>{r.target.title} · {ruleDescription(r.rule)}</option>)}</optgroup>}
                    <optgroup label="Match an existing assessment">{targets.filter(t=>!savedRules.some(r=>r.target.id===t.id)).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>
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
        {filter==="unmatched"&&!updates?.unmatched.length&&<p role="status">All items have a selected match. Nothing saved yet — review the proposed changes below.</p>}
        <div className="canvas-import-footer"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!selected.length||!!preview?.error} onClick={review}>Review {selected.length} selected items →</button></div>
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
          <button className="primary" disabled={!confirmed||staleReview||!preview?.changed||!!preview?.error} onClick={()=>{try{onApply(bundle,Object.values(choices),reviewedSemester!);onClose();}catch(e){setError((e as Error).message);setConfirmed(false);}}}>Confirm {preview?.changed||0} changes</button>
        </div>
      </>}
    </>}
    {!bundle&&<button onClick={onClose}>Cancel</button>}
  </section>;
}
