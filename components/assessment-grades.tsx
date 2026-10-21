"use client";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { type Grade, type GradePlan, type Semester, type Task } from "@/lib/semester";
import { type AssessmentRow, assessmentOverviewSchedule, assessmentListWeight } from "@/lib/assessment-list";
import { assessmentGrade, gradeTarget, gradeWeight, unitGrades } from "@/lib/grades";
import { gradeNumber as n, validGrade } from "@/lib/grade-value";
import { GradePartsEditor } from "./grade-parts-editor";
import { gradeRuleSummary, gradeThreshold } from "@/lib/grades";

export function AssessmentGrades({semester,rows,unit,onGrade,onGradePlan,onOpen,onToggle}:{
  semester:Semester;rows:AssessmentRow[];unit:string;
  onGrade:(id:string,grade:Grade|null,expected:Grade|null|undefined)=>void;
  onGradePlan?:(id:string,plan:GradePlan,expected:GradePlan|null|undefined)=>void;
  onOpen:(task:Task)=>void;onToggle:(task:Task)=>void;
}) {
  const id=useId();
  const [editing,setEditing]=useState<{task:Task;earned:string;possible:string;mode:"marks"|"percent"}|null>(null);
  const [partsEditing,setPartsEditing]=useState<Task|null>(null);
  const editorRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(editing||partsEditing)editorRef.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[editing?.task.id,partsEditing?.id]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [target,setTarget]=useState(75);
  const stats=unit?unitGrades(semester,unit):null;
  const forecast=stats?gradeTarget(stats,target):null;
  const dirty=!!editing && (editing.earned!==(editing.task.grade?String(editing.task.grade.earned):"") || editing.possible!==(editing.task.grade?String(editing.task.grade.possible):""));
  function edit(task:Task) {
    if(partsEditing) {setError("Save or cancel individual grades before opening another editor.");return;}
    if (editing && dirty) {setError("Save or cancel the current grade before editing another assessment.");return;}
    setEditing({task,earned:validGrade(task.grade)?String(task.grade.earned):"",possible:validGrade(task.grade)?String(task.grade.possible):"",mode:"marks"});setError("");setNotice("");
  }
  function editParts(task:Task) {
    if(partsEditing||editing) {setError("Save or cancel the open editor first. Your entries have been kept.");return;}
    setPartsEditing(task);setError("");setNotice("");
  }
  function save(clear=false) {
    if (!editing) return;
    const grade=clear?null:{earned:Number(editing.earned),possible:Number(editing.possible)};
    if (!clear && (!editing.earned.trim() || !editing.possible.trim() || !validGrade(grade))) {setError("Enter a score from 0 to the maximum. The maximum must be greater than 0. Leave ungraded work unrecorded.");return;}
    try {onGrade(editing.task.id,grade,editing.task.grade);setNotice(clear?"Grade cleared — now unrecorded. Completion unchanged.":"Grade updated. Completion unchanged; check Saved in the navigation for sync status.");setEditing(null);setError("");}
    catch(e){setError(e instanceof Error?e.message:"Could not save this grade.");}
  }
  const editor=editing&&<form className="grade-editor" onSubmit={e=>{e.preventDefault();save();}} aria-label={`Grade for ${editing.task.title}`}>
    <strong>{editing.task.unit} · {editing.task.title} · Grade</strong>
    <p>Enter the reported overall score, not one quiz or part. To calculate from individual results, cancel and choose “Individual grades” in the assessment row. Leave unreleased grades unrecorded.</p>
    <div className="grade-editor-fields">
      <label htmlFor={`${id}-mode`}>Input<select id={`${id}-mode`} value={editing.mode} onChange={e=>{const mode=e.target.value as "marks"|"percent";setEditing({...editing,mode,...(mode==="percent"?{earned:editing.earned&&Number(editing.possible)>0?String(Number((Number(editing.earned)/Number(editing.possible)*100).toFixed(8))):"",possible:"100"}:{})});}}><option value="marks">Marks / maximum</option><option value="percent">Percentage</option></select></label>
      <label htmlFor={`${id}-earned`}>{editing.mode==="percent"?"Score (%)":"Marks earned"}<input autoFocus id={`${id}-earned`} type="number" min="0" step="any" value={editing.earned} placeholder="e.g. 14" onChange={e=>setEditing({...editing,earned:e.target.value})}/></label>
      {editing.mode==="marks"&&<label htmlFor={`${id}-possible`}>Maximum marks<input id={`${id}-possible`} type="number" min="0" step="any" placeholder="e.g. 20" value={editing.possible} onChange={e=>setEditing({...editing,possible:e.target.value})}/></label>}
      <button className="primary" type="submit">Save grade</button><button type="button" onClick={()=>{setEditing(null);setError("");}}>Cancel</button>
      {editing.task.grade!=null&&<button type="button" onClick={()=>save(true)}>Clear grade</button>}
    </div>
    {error&&<p role="alert" className="grade-warning">{error}</p>}
  </form>;
  return <div className="assessment-grades">
    {stats?<section className="grade-summary" aria-label={`${unit} grade summary`}>
      <div className="grade-summary-main"><div><span className="grade-summary-label">Current average</span><div className="grade-summary-number">{stats.average===null?"—":`${n(stats.average)}%`}</div></div>
        <div><p>{stats.currentCount?`Based on ${stats.currentCount} assessments with recorded marks, representing ${n(stats.currentWeight)}% of the unit’s weight.`:"No grades recorded with a confirmed assessment weight yet."}</p>{stats.pendingGroups>0&&<p className="grade-secondary">{stats.pendingGroups} in-progress {stats.pendingGroups===1?"group":"groups"}. Numeric rules use their current result and full assessment weight; unfinished completion rules are excluded from this average, because secured points are not a marked-work average. Not a final grade.</p>}{stats.securedCompletionPoints>0&&<p className="grade-secondary">Another {n(stats.securedCompletionPoints)} unit points secured from unfinished completion rules, shown separately until their result is settled.</p>}<p className="grade-secondary">{stats.currentCount?`${n(stats.earned)} / 100 unit points from settled results. ${stats.pendingGroups?"In-progress groups are not included in these points. ":""}`:""}{stats.complete?`${n(stats.remaining)}% weight is not yet fully graded.`:"Weight coverage needs review; figures use confirmed weights only."}</p></div>
      </div>
      <div className="grade-summary-footer"><span>Whole unit · includes hidden recurring assessments · not an official result</span><details><summary>Target calculator</summary><div className="grade-target">
        <label htmlFor={`${id}-target`}>Target <select id={`${id}-target`} value={target} onChange={e=>setTarget(Number(e.target.value))}><option value={50}>Pass · 50</option><option value={65}>Credit · 65</option><option value={75}>Distinction · 75</option><option value={85}>High distinction · 85</option></select></label>
        <p aria-live="polite">{forecast?.status==="needed"?<>Average <strong>{n(Math.ceil(forecast.average*10-1e-8)/10)}%</strong> needed across the remaining {n(stats.remaining)}% weight (rounded up).</>:forecast?.status==="inprogress"?"Target estimate paused while groups are partly graded. Finish their included grades or enter the reported overall result; a current group average is not a final result.":forecast?.status==="reached"?"This numerical target is reached. Other unit requirements still apply.":forecast?.status==="unreachable"?"Even full marks on the remaining assessments would not reach this target with the recorded grades.":forecast?.status==="finished"?"All weighted grades are recorded; this target has not been reached.":"Target estimate unavailable until assessment weights and rules are confirmed and total 100%."}</p>
        <p className="grade-secondary">Based on recorded assessments and grades, not a guaranteed outcome. Hurdles, required submissions and other pass conditions must be checked separately.{stats.hurdles.length>0&&` ${stats.hurdles.length} ${stats.hurdles.length===1?"assessment is marked as a hurdle":"assessments are marked as hurdles"}.`}</p>
      </div></details></div>
      {(!stats.complete)&&<details className="grade-review"><summary>Review calculation coverage · known weights total {n(stats.totalWeight)}%</summary><p>Check the full assessment list against your outline. Unknown weights and optional/bonus items are not included in the average or earned points.</p>{stats.issues.map(({task,reason})=><button key={task.id} onClick={()=>onOpen(task)}>{task.title} · {reason} →</button>)}{!stats.issues.length&&<p>Recorded weights must total 100% before target estimates are available.</p>}</details>}
    </section>:<p className="grade-unit-hint">Choose a unit to see its average and target calculator. Grades are never averaged across units here.</p>}
    <div ref={editorRef} className="grade-editor-anchor">{editor}{partsEditing&&onGradePlan&&<GradePartsEditor key={partsEditing.id} semester={semester} task={partsEditing} onCancel={()=>{setPartsEditing(null);setError("");}} onSave={(plan,expected)=>{onGradePlan(partsEditing.id,plan,expected);setPartsEditing(null);setError("");setNotice("Individual grades saved. Only the selected grade source counts; completion is unchanged. Check Saved in the navigation for sync status.");}}/>}</div>
    {error&&!editing&&<p className="grade-warning" role="alert">{error}</p>}
    <div className="grade-feedback" role="status">{notice}</div>
    <div className="assessment-list-table-wrap"><table className="assessment-list-table grade-table"><caption className="sr-only">Whole-assessment grades. Blank grades are unrecorded, not zero. Completion is separate.</caption>
      <colgroup><col className="assessment-col-check"/><col className="grade-col-name"/><col className="grade-col-weight"/><col className="grade-col-result"/><col className="grade-col-date"/></colgroup>
      <thead><tr><th>Done</th><th>Assessment</th><th>Weight</th><th>Grade</th><th className="grade-date">Due / dates</th></tr></thead>
      <tbody>{rows.map(row=>{const t=row.task,g=validGrade(t.grade)?t.grade:null,result=assessmentGrade(t),parts=result.source==="parts",startWithParts=!!(row.grouped||t.kind==="recurring"||t.routine)&&!g&&!t.gradePlan&&!!onGradePlan,w=gradeWeight(t),schedule=assessmentOverviewSchedule(semester,row);return <Fragment key={t.id}><tr>
        <td className="assessment-list-check">{row.grouped?<span aria-label={`${row.completed} of ${row.total} steps complete`}>{row.done?"✓":"—"}</span>:<Checkbox checked={!!t.done} aria-label={`Mark ${t.title} ${t.done?"unfinished":"complete"}`} onCheckedChange={()=>onToggle(t)}/>}</td>
        <td><button className="assessment-list-title" onClick={()=>onOpen(t)}>{t.title}</button>{!unit&&<small className="grade-secondary">{t.unit}</small>}{t.hurdle&&<small className="grade-secondary">Hurdle</small>}<small className="grade-mobile-date">{schedule.label}{schedule.detail&&` · ${schedule.detail}`}</small></td>
        <td className="assessment-list-weight">{assessmentListWeight(t,row.grouped)}</td>
        <td>{parts?<><button className="grade-edit-button" aria-label={`Edit individual grades for ${t.title}`} onClick={()=>editParts(t)}>{result.ratio===null?"Set up grades":t.gradePlan?.method==="completion"?`${n(result.earned!)} / ${n(result.possible!)} points${result.finished?"":" secured so far"}`:`${n(result.ratio*100)}%${result.finished?"":" so far"}`}<small>{t.gradePlan&&gradeRuleSummary(t.gradePlan)}{t.gradePlan&&gradeRuleSummary(t.gradePlan)?" · ":""}{result.recorded} / {result.total} {t.gradePlan?.method==="completion"?"confirmed":"graded"} · Edit</small></button>{t.gradePlan&&gradeThreshold(t.gradePlan)&&<small className="grade-secondary">{gradeThreshold(t.gradePlan)}</small>}{result.error&&<small className="grade-warning">Calculation needs review</small>}</>:<button className="grade-edit-button" aria-label={`${startWithParts?"Add individual":g?"Edit":"Add"} grade for ${t.title}`} onClick={()=>startWithParts?editParts(t):edit(t)}>{startWithParts?"+ Individual grades":g?`${g.earned} / ${g.possible}`:"+ Add grade"}{g&&<small>{n(g.earned/g.possible*100)}%</small>}</button>}{result.ratio!==null&&result.finished&&<small className="grade-contribution">{w===null?"Weight needs review":`${n(result.ratio*w)} / ${n(w)} unit points`}</small>}{onGradePlan&&!parts&&<button className="grade-parts-link" onClick={()=>startWithParts?edit(t):editParts(t)} aria-label={`${startWithParts?"Overall result":"Individual grades"} for ${t.title}`}>{startWithParts?"Enter overall result":t.gradePlan?"Grade source / saved items":"Individual grades / rules →"}</button>}</td>
        <td className="grade-date"><span>{schedule.label}</span><small>{schedule.detail}</small>{t.sourceConflict&&<button className="assessment-list-date-warning" onClick={()=>onOpen(t)}>Dates conflict · review</button>}</td>
      </tr></Fragment>;})}</tbody>
    </table></div>
    <p className="assessment-list-note">Blank means unrecorded, not zero. Each assessment counts once. Completion rules show secured points out of the best-N cap; other in-progress rules show recorded results so far. Changing grades does not change calendar completion.</p>
  </div>;
}
