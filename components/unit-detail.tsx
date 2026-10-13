"use client";
import { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Semester, Unit, ClassEvent, Task, shortDate, timingLabel, weightLabel } from "@/lib/semester";
import { AssessmentScope } from "@/components/assessment-scope";
import { learningScope } from "@/lib/learning-scope";
import { subjectTasks, subjectAssessments } from "@/lib/subject-view";

export function UnitDetail({ semester, unit, today, focusTaskId, onToggle, onToggleTask, onCatchUp, onScope, onOpenTask: navigateTask, onOpenClass: navigateClass }: {
  semester: Semester; unit: Unit; today: string; focusTaskId?: string;
  onToggle: (event: ClassEvent) => void; onToggleTask: (task: Task) => void;
  onCatchUp: (week: number) => void;
  onScope: (task: Task, weeks: number[]) => void;
  onOpenTask: (task: Task, preparationId: string) => void; onOpenClass: (event: ClassEvent, preparationId: string) => void;
}) {
  const [preparing, setPreparing] = useState(focusTaskId || "");
  const onOpenTask = (task:Task) => navigateTask(task,preparing);
  const onOpenClass = (event:ClassEvent) => navigateClass(event,preparing);
  const [allWeeks,setAllWeeks] = useState(false);
  const [through,setThrough] = useState(0);
  const prepRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(preparing)prepRef.current?.scrollIntoView({block:"nearest"});},[preparing]);
  const classes = semester.classes.filter(c => c.unit === unit.code && c.week);
  const activities = [...new Set(classes.map(c => c.activity))];
  const assessments = subjectAssessments(semester,unit.code);
  const {upcoming,past,unknown,exams} = subjectTasks(semester,unit.code,today);
  const selected = semester.tasks.find(t => t.id === preparing && t.unit === unit.code) || assessments.find(t=>t.id===preparing);
  const scope = selected ? learningScope(selected,semester) : null;
  const weeks = semester.weeks.filter(w => w.kind === "teaching");
  const current = weeks.find(w=>w.end>=today)?.number || 13;
  const shownWeeks = allWeeks ? weeks : weeks.filter(w=>Math.abs(w.number!-current)<=1);
  const card = (t:Task) => <div key={t.id} className="subject-task">
    <Checkbox aria-label={`Record ${unit.code} ${t.title} complete`} checked={!!t.done} onCheckedChange={()=>onToggleTask(t)}/>
    <div><button className="subject-task-title" onClick={()=>onOpenTask(t)}>{t.title}</button>
      <p>{timingLabel(t)}{t.weight && ` · ${weightLabel(t)}`}{t.hurdle && " · Hurdle"}</p>
      {t.sourceConflict && <p className="unit-conflict">Source dates conflict · check details</p>}
      <button className="subject-prep-link" aria-expanded={preparing===t.id} onClick={()=>setPreparing(preparing===t.id?"":t.id)}>{t.coverage?.length ? `${learningScope(t,semester).status} → View preparation` : "Add preparation scope"}</button>
    </div>
  </div>;
  return <div className="detail-body unit-detail subject-overview">
    <section aria-labelledby="subject-next"><div className="subject-section-heading"><h3 id="subject-next">Up next</h3><span>{upcoming.length} upcoming</span></div>
      {upcoming.length ? upcoming.slice(0,3).map(card) : <p className="hint">No upcoming dated tasks recorded. Check undated items and requirements below.</p>}
      {upcoming.length>3 && <details><summary>Later tasks ({upcoming.length-3})</summary>{upcoming.slice(3).map(card)}</details>}
      {past.length>0 && <details><summary>Past tasks · {past.length} unrecorded</summary><p className="hint">They may already be done. Check your own record.</p>{past.map(card)}</details>}
      {unknown.length>0 && <details><summary>Dates to confirm ({unknown.length})</summary>{unknown.map(card)}</details>}
      {exams.length>0 && <details><summary>Final exams · awaiting dates ({exams.length})</summary>{exams.map(card)}</details>}
      {selected && <div ref={prepRef} className="subject-preparation" role="region" aria-label={`Preparation for ${selected.title}`}>
        <div className="subject-section-heading"><h4>{selected.title} · Preparation</h4><button aria-label="Close preparation" onClick={()=>setPreparing("")}>×</button></div>
        <AssessmentScope key={selected.id} task={selected} semester={semester} onSave={onScope} onToggle={onToggle} onOpenClass={onOpenClass}/>
      </div>}
    </section>
    <section aria-labelledby="subject-learning"><div className="subject-section-heading"><h3 id="subject-learning">Learning record</h3><button onClick={()=>setAllWeeks(!allWeeks)}>{allWeeks?"Recent weeks":"All 13 weeks"}</button></div>
      <p className="hint">Unchecked = unrecorded, not necessarily unfinished. Ticks are not attendance or grades.</p>
      {classes.length ? <div className="progress-table-wrap"><table className="learning-table">
        <thead><tr><th scope="col">Week</th>{activities.map(a=><th scope="col" key={a}>{a}</th>)}</tr></thead>
        <tbody>{shownWeeks.map(w=><tr key={w.id} className={scope?.weeks.includes(w.number!)?"subject-covered":""}>
          <th scope="row" title={`${shortDate(w.start)} – ${shortDate(w.end)}`}>W{w.number}{w.start<=today&&w.end>=today&&<small>Current</small>}{scope?.weeks.includes(w.number!)&&<small>Scope</small>}</th>
          {activities.map(a=>{const events=classes.filter(c=>c.week===w.number&&c.activity===a);return <td key={a}>{events.length?<div className="learning-checks">{events.map(c=><div className="subject-learning-event" key={c.id}>
            <Checkbox checked={!!semester.completed[c.id]} onCheckedChange={()=>onToggle(c)} aria-label={`${unit.code} Week ${w.number} ${a}, ${c.date} ${c.time}`}/>
            <button onClick={()=>onOpenClass(c)} title={c.topic||"Open class details"}>{shortDate(c.date)}<small>{c.time}</small></button>
          </div>)}</div>:<span className="muted">—</span>}</td>;})}
        </tr>)}</tbody>
      </table></div>:<p>No classes in the imported timetable for this unit.</p>}
      <p className="hint">— = no imported class, not “nothing to study”.</p>
      {classes.some(c=>/lecture/i.test(c.activity)) && <details className="bulk-learning"><summary>Mark earlier lectures in one go</summary><div className="bulk-controls"><label>Through week <select aria-label="Lectures watched through week" value={through} onChange={e=>setThrough(Number(e.target.value))}><option value={0}>Choose</option>{weeks.map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</select></label><button disabled={!through} onClick={()=>onCatchUp(through)}>Mark watched</button></div><p className="hint">Lectures only. You can untick any item above.</p></details>}
    </section>
    <section aria-labelledby="subject-requirements"><div className="subject-section-heading"><h3 id="subject-requirements">Assessments & requirements</h3></div>
      <a href={unit.outline} target="_blank" rel="noreferrer">Official outline ↗</a>
      {!assessments.length && <p className="hint">No assessments imported. Check the official outline and Canvas / Ed.</p>}
      {assessments.map(t=>{const occurrences=semester.tasks.filter(x=>x.series===t.id||x.parentId===t.id);return <details className="unit-assessment" key={t.id}><summary>
        <div className="assessment-title"><strong>{t.title}</strong><span>{t.weight}{occurrences.length?" total":""}</span></div>
        <p>{occurrences.length?`${occurrences.length} parts · ${occurrences.filter(x=>x.done).length} recorded complete`:timingLabel(t)}</p>
        {t.hurdle&&<span className="unit-flag">Hurdle</span>}{t.sourceConflict&&<p className="unit-conflict">Source dates conflict</p>}
      </summary>
        {t.rules?.perOccurrence!==undefined&&<p>{t.rules.perOccurrence}% each · {t.weight} maximum</p>}
        {t.rules?.text&&<p>{t.rules.text}</p>}{t.description&&<p>{t.description}</p>}
        {occurrences.length?<div className="series-occurrences">{occurrences.map(o=><div key={o.id}><button onClick={()=>onOpenTask(o)}>{o.title} · {timingLabel(o)}{o.done?" · recorded":""}</button><button className="subject-prep-link" onClick={()=>setPreparing(o.id)}>Preparation →</button></div>)}</div>:<button onClick={()=>onOpenTask(t)}>Open task / edit details</button>}
        {t.source&&<a href={t.source} target="_blank" rel="noreferrer">Assessment source ↗</a>}
      </details>;})}
      <details className="unit-rule"><summary>Full assessment summary</summary><p>{unit.summary||"No summary imported. Check the official outline."}</p></details>
    </section>
  </div>;
}
