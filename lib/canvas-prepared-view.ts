import type {Semester} from "./semester";
import {canvasGrade,canvasKey,type CanvasBundle,type CanvasChoice} from "./canvas-import";
import type {CanvasAction} from "./canvas-update-status";

// The planner, not the source's numeric/text format, decides what will be saved.
// Baseline changes keep skipped rows visible so Undo/restore never loses context.
export function preparedCanvasView(s:Semester,b:CanvasBundle,choices:Record<string,CanvasChoice>,actions:CanvasAction[],baseline:CanvasAction[]){
  const records=new Map((s.canvasAccountId===b.accountId?s.canvasImports||[]:[]).map(r=>[r.key,r]));
  const byKey=new Map(actions.map(a=>[a.key,a]));
  const baselineChanges=new Set(baseline.filter(a=>a.changed).map(a=>a.key));
  const rows=b.courses.flatMap(c=>c.assignments.map(a=>{
    const sourceKey=canvasKey(b,c.course.id,a.id),key=`${c.course.id}:${a.id}`;
    return {c,a,key,sourceKey,choice:choices[key],prior:records.get(sourceKey),action:byKey.get(sourceKey)};
  }));
  const attention=rows.filter(r=>r.action?.kind==="attention");
  const reviewGroups=[...new Set(attention.map(r=>`${r.c.course.id}:${r.choice?.targetId||r.prior?.targetId||r.key}`))].map(id=>{
    const items=attention.filter(r=>`${r.c.course.id}:${r.choice?.targetId||r.prior?.targetId||r.key}`===id);
    return {id,items,targetId:items[0].choice?.targetId||items[0].prior?.targetId};
  });
  const useful=rows.filter(r=>r.action?.kind!=="attention"&&(r.action?.changed||baselineChanges.has(r.sourceKey)||r.action?.kind!=="protected"&&!r.prior&&!!canvasGrade(r.a)));
  const changed=actions.filter(a=>a.changed);
  const visibleKeys=new Set([...useful,...attention].map(r=>r.sourceKey));
  const other=rows.filter(r=>!visibleKeys.has(r.sourceKey));
  const otherGroups={
    protected:other.filter(r=>r.action?.kind==="protected"),
    linked:other.filter(r=>r.action?.kind!=="protected"&&!!r.prior),
    unconnected:other.filter(r=>r.action?.kind!=="protected"&&!r.prior),
  };
  return {rows,useful,reviewGroups,total:changed.length,
    results:changed.filter(a=>a.kind==="grade").length,
    added:changed.filter(a=>a.kind==="added").length,
    connections:changed.filter(a=>a.kind!=="grade"&&a.kind!=="added").length,
    // Defensive fallback: never omit an action that will be saved, even if a
    // future planner adds a change without a source-assignment row.
    extraChanges:changed.filter(a=>!visibleKeys.has(a.key)),
    otherGroups,dormant:other.length};
}
