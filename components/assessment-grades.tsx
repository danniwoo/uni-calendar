"use client";
import { Fragment, useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { type Grade, type Semester, type Task } from "@/lib/semester";
import { type AssessmentRow, assessmentOverviewSchedule, assessmentListWeight } from "@/lib/assessment-list";
import { gradeTarget, gradeWeight, unitGrades } from "@/lib/grades";
import { gradeNumber as n, validGrade } from "@/lib/grade-value";

export function AssessmentGrades({semester,rows,unit,onGrade,onOpen,onToggle}:{
  semester:Semester;rows:AssessmentRow[];unit:string;
  onGrade:(id:string,grade:Grade|null,expected:Grade|null|undefined)=>void;
  onOpen:(task:Task)=>void;onToggle:(task:Task)=>void;
}) {
  const id=useId();
  const [editing,setEditing]=useState<{task:Task;earned:string;possible:string;mode:"marks"|"percent"}|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [target,setTarget]=useState(75);
  const stats=unit?unitGrades(semester,unit):null;
  const forecast=stats?gradeTarget(stats,target):null;
  const dirty=!!editing && (editing.earned!==(editing.task.grade?String(editing.task.grade.earned):"") || editing.possible!==(editing.task.grade?String(editing.task.grade.possible):""));
  function edit(task:Task) {
    if (editing && dirty) {setError("Save or cancel the current grade before editing another assessment.");return;}
    setEditing({task,earned:validGrade(task.grade)?String(task.grade.earned):"",possible:validGrade(task.grade)?String(task.grade.possible):"",mode:"marks"});setError("");setNotice("");
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
    <p>{editing.task.splitCount||editing.task.kind==="recurring"||editing.task.routine||semester.tasks.some(t=>t.parentId===editing.task.id||t.series===editing.task.id)?"Enter the overall result for this assessment, not one occurrence or step. Steps are not added again.":"Enter the reported score. Leave work without a grade unrecorded."}</p>
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
        <div><p>{stats.gradedCount?`Based on ${stats.gradedCount} graded ${stats.gradedCount===1?"assessment":"assessments"}, worth ${n(stats.gradedWeight)}% of this unit.`:"No grades recorded with a confirmed assessment weight yet."}</p><p className="grade-secondary">{stats.gradedCount?`${n(stats.earned)} points earned toward the unit’s 100-point total. `:""}{stats.complete?`${n(stats.remaining)}% of the unit has no grade recorded.`:"Weight coverage needs review; figures use confirmed weights only."}</p></div>
      </div>
      <div className="grade-summary-footer"><span>Whole unit · includes hidden recurring assessments · not an official result</span><details><summary>Target calculator</summary><div className="grade-target">
        <label htmlFor={`${id}-target`}>Target <select id={`${id}-target`} value={target} onChange={e=>setTarget(Number(e.target.value))}><option value={50}>Pass · 50</option><option value={65}>Credit · 65</option><option value={75}>Distinction · 75</option><option value={85}>High distinction · 85</option></select></label>
        <p aria-live="polite">{forecast?.status==="needed"?<>Average <strong>{n(Math.ceil(forecast.average*10-1e-8)/10)}%</strong> needed across the remaining {n(stats.remaining)}% weight (rounded up).</>:forecast?.status==="reached"?"This numerical target is reached. Other unit requirements still apply.":forecast?.status==="unreachable"?"Even full marks on the remaining assessments would not reach this target with the recorded grades.":forecast?.status==="finished"?"All weighted grades are recorded; this target has not been reached.":"Target estimate unavailable until assessment weights and rules are confirmed and total 100%."}</p>
        <p className="grade-secondary">Based on recorded assessments and grades, not a guaranteed outcome. Hurdles, required submissions and other pass conditions must be checked separately.{stats.hurdles.length>0&&` ${stats.hurdles.length} ${stats.hurdles.length===1?"assessment is marked as a hurdle":"assessments are marked as hurdles"}.`}</p>
      </div></details></div>
      {(!stats.complete)&&<details className="grade-review"><summary>Review calculation coverage · known weights total {n(stats.totalWeight)}%</summary><p>Check the full assessment list against your outline. Unknown weights and optional/bonus items are not included in the average or earned points.</p>{stats.issues.map(({task,reason})=><button key={task.id} onClick={()=>onOpen(task)}>{task.title} · {reason} →</button>)}{!stats.issues.length&&<p>Recorded weights must total 100% before target estimates are available.</p>}</details>}
    </section>:<p className="grade-unit-hint">Choose a unit to see its average and target calculator. Grades are never averaged across units here.</p>}
    {editor}
    <div className="grade-feedback" role="status">{notice}</div>
    <div className="assessment-list-table-wrap"><table className="assessment-list-table grade-table"><caption className="sr-only">Whole-assessment grades. Blank grades are unrecorded, not zero. Completion is separate.</caption>
      <colgroup><col className="assessment-col-check"/><col className="grade-col-name"/><col className="grade-col-weight"/><col className="grade-col-result"/><col className="grade-col-date"/></colgroup>
      <thead><tr><th>Done</th><th>Assessment</th><th>Weight</th><th>Grade</th><th className="grade-date">Due / dates</th></tr></thead>
      <tbody>{rows.map(row=>{const t=row.task,g=validGrade(t.grade)?t.grade:null,w=gradeWeight(t),schedule=assessmentOverviewSchedule(semester,row);return <Fragment key={t.id}><tr>
        <td className="assessment-list-check">{row.grouped?<span aria-label={`${row.completed} of ${row.total} steps complete`}>{row.done?"✓":"—"}</span>:<Checkbox checked={!!t.done} aria-label={`Mark ${t.title} ${t.done?"unfinished":"complete"}`} onCheckedChange={()=>onToggle(t)}/>}</td>
        <td><button className="assessment-list-title" onClick={()=>onOpen(t)}>{t.title}</button>{!unit&&<small className="grade-secondary">{t.unit}</small>}{t.hurdle&&<small className="grade-secondary">Hurdle</small>}<small className="grade-mobile-date">{schedule.label}{schedule.detail&&` · ${schedule.detail}`}</small></td>
        <td className="assessment-list-weight">{assessmentListWeight(t,row.grouped)}</td>
        <td><button className="grade-edit-button" aria-label={`${g?"Edit":"Add"} grade for ${t.title}`} onClick={()=>edit(t)}>{g?`${g.earned} / ${g.possible}`:"+ Add grade"}{g&&<small>{n(g.earned/g.possible*100)}%</small>}</button>{g&&<small className="grade-contribution">{w===null?"Weight needs review":`${n(g.earned/g.possible*w)} / ${n(w)} unit points`}</small>}</td>
        <td className="grade-date"><span>{schedule.label}</span><small>{schedule.detail}</small>{t.sourceConflict&&<button className="assessment-list-date-warning" onClick={()=>onOpen(t)}>Dates conflict · review</button>}</td>
      </tr></Fragment>;})}</tbody>
    </table></div>
    <p className="assessment-list-note">Blank means unrecorded, not zero. Enter overall results for grouped / recurring assessments; steps are not added again. Changing a grade does not change completion.</p>
  </div>;
}
