"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Semester, Unit, ClassEvent, shortDate, timingLabel } from "@/lib/semester";

export function UnitDetail({ semester, unit, onToggle, onCatchUp }: {
  semester: Semester; unit: Unit; onToggle: (event: ClassEvent) => void;
  onCatchUp: (week: number) => void;
}) {
  const [through, setThrough] = useState(0);
  const classes = semester.classes.filter(c => c.unit === unit.code && c.week);
  const activities = [...new Set(classes.map(c => c.activity))];
  const assessments = unit.assessments.map(t => semester.tasks.find(x => x.id === t.id) || t);
  const weeks = semester.weeks.filter(w => w.kind === "teaching");
  return <div className="detail-body unit-detail">
    <a href={unit.outline} target="_blank" rel="noreferrer">Open official outline ↗</a>
    <Tabs defaultValue="progress" className="unit-tabs">
      <TabsList aria-label="Unit details">
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="assessments">Assessments</TabsTrigger>
        <TabsTrigger value="rules">Rules & scope</TabsTrigger>
      </TabsList>
      <TabsContent value="progress">
        <div className="progress-heading"><strong>Weekly learning</strong><span>{classes.filter(c => semester.completed[c.id]).length} / {classes.length} done</span></div>
        <p className="hint">Tick what you’ve watched or worked through. Not an attendance or grade record.</p>
        {classes.length ? <div className="progress-table-wrap"><table className="learning-table">
          <thead><tr><th scope="col">Week</th>{activities.map(a => <th scope="col" key={a}>{a}</th>)}</tr></thead>
          <tbody>{weeks.map(w => <tr key={w.id}><th scope="row" title={`${shortDate(w.start)} – ${shortDate(w.end)}`}>W{w.number}</th>{activities.map(a => {
            const events = classes.filter(c => c.week === w.number && c.activity === a);
            return <td key={a}>{events.length ? <div className="learning-checks">{events.map((c, i) => <label key={c.id} title={`${shortDate(c.date)} · ${c.time}${c.topic ? ` · ${c.topic}` : ""}`}>
              <Checkbox checked={!!semester.completed[c.id]} onCheckedChange={() => onToggle(c)} aria-label={`${unit.code} Week ${w.number} ${a} ${i+1}, ${shortDate(c.date)} ${c.time}`} />{events.length > 1 && <small>{i+1}</small>}
            </label>)}</div> : <span className="muted">—</span>}</td>;
          })}</tr>)}</tbody>
        </table></div> : <p>No classes in the imported timetable for this unit.</p>}
        <p className="hint">— = no class in your imported timetable, not “nothing to study”.</p>
        {classes.some(c => /lecture/i.test(c.activity)) && <details className="bulk-learning"><summary>Mark earlier lectures in one go</summary>
          <div className="bulk-controls"><label>Through week <select aria-label="Lectures watched through week" value={through} onChange={e => setThrough(Number(e.target.value))}><option value={0}>Choose</option>{weeks.map(w => <option key={w.id} value={w.number}>W{w.number}</option>)}</select></label><button disabled={!through} onClick={() => onCatchUp(through)}>Mark watched</button></div>
          <p className="hint">Lectures only. You can untick any item above.</p>
        </details>}
      </TabsContent>
      <TabsContent value="assessments">
        {assessments.map(t => {
          const occurrences = semester.tasks.filter(x => x.series === t.id);
          return <section className="unit-assessment" key={t.id}>
            <div className="assessment-title"><strong>{t.title}</strong><span>{t.weight}{t.routine ? " total" : ""}</span></div>
            <p>{occurrences.length ? `${occurrences.length} scheduled occurrences` : t.routine ? "Ongoing · individual dates not confirmed" : timingLabel(t)}</p>
            {t.rules?.perOccurrence !== undefined && <p>{t.rules.perOccurrence}% each · {t.weight} maximum</p>}
            {occurrences.length > 0 && <p className="hint">{occurrences.filter(x => x.done).length} recorded complete · not a score</p>}
            {t.hurdle && <span className="unit-flag">Hurdle — check rules</span>}
            {t.sourceConflict && <p className="unit-conflict">Dates conflict in the outline. Confirm in Canvas / Ed.</p>}
          </section>;
        })}
      </TabsContent>
      <TabsContent value="rules">
        <p className="hint">From the outline. Check Canvas / Ed for updates and missing quiz coverage.</p>
        {assessments.map(t => <details className="unit-rule" key={t.id}><summary>{t.title}</summary>
          <p><strong>Scope: </strong>{t.rules?.coverageText || (t.coverage?.length ? `Weeks ${t.coverage.join(", ")}` : "Not specified in the imported information.")}</p>
          <p>{t.rules?.text || "No detailed rule imported. Check the official outline or assessment brief."}</p>
          {t.sourceConflict && <p className="unit-conflict">{t.sourceConflict}</p>}
        </details>)}
        <details className="unit-rule"><summary>Full assessment summary</summary><p>{unit.summary || "No summary imported. Check the official outline."}</p></details>
      </TabsContent>
    </Tabs>
  </div>;
}
