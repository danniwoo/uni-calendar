"use client";
import { Fragment, useId, useState } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Search, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { COLORS, type Semester, type Task } from "@/lib/semester";
import { assessmentRows, assessmentListDate, assessmentListWeight, assessmentDateContext, defaultAssessmentFilters, type AssessmentFilters, type AssessmentSort } from "@/lib/assessment-list";

export function AssessmentList({semester,today,unit,compact=false,onOpen,onToggle,onAdd}:{
  semester:Semester; today:string; unit?:string; compact?:boolean;
  onOpen:(task:Task)=>void; onToggle:(task:Task)=>void; onAdd?:(unit?:string)=>void;
}) {
  const [filters,setFilters]=useState<AssessmentFilters>({...defaultAssessmentFilters,unit:unit||""});
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const id=useId();
  const effective={...filters,unit:unit||filters.unit};
  const rows=assessmentRows(semester,effective,today);
  const total=assessmentRows(semester,{...defaultAssessmentFilters,unit:unit||""},today).length;
  const filtered=!!filters.query || !!(!unit&&filters.unit) || filters.status!=="all" || filters.dates!=="all";
  const color=(code:string)=>COLORS[Math.max(0,semester.units.findIndex(u=>u.code===code))%COLORS.length];
  function changeSort(sort:AssessmentSort){setFilters(f=>({...f,sort,descending:f.sort===sort?!f.descending:sort==="weight"}));}
  function toggleExpanded(key:string){setExpanded(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});}
  function sortHeading(sort:AssessmentSort,label:string){return <th scope="col" aria-sort={filters.sort===sort?(filters.descending?"descending":"ascending"):"none"}><button onClick={()=>changeSort(sort)}>{label}{filters.sort===sort&&(filters.descending?<ArrowDown size={13}/>:<ArrowUp size={13}/>)}</button></th>;}
  const completion=(t:Task)=><Checkbox checked={!!t.done} onCheckedChange={()=>onToggle(t)} aria-label={`Mark ${t.unit} ${t.title} ${t.done?"unfinished":"complete"}`}/>;
  const title=(t:Task)=><><button className="assessment-list-title" onClick={()=>onOpen(t)}>{t.title}</button><span className="assessment-list-flags">{t.hurdle&&<span>Hurdle</span>}{t.sourceConflict&&<span className="assessment-list-warning">Source dates conflict</span>}</span></>;
  const dates=(t:Task)=><><span>{assessmentListDate(t)}</span><small>{assessmentDateContext(semester,t)}</small></>;
  return <section className={`assessment-list${compact?" assessment-list-compact":""}`} aria-label={unit?`${unit} assessment list`:"All assessments"}>
    {!compact&&<div className="assessment-list-heading"><div><h2>Assessments</h2><p>All your coursework in one place. Open an assessment to edit its details.</p></div>{onAdd&&<button className="primary" onClick={()=>onAdd(effective.unit||undefined)}><Plus size={16}/>Add assessment</button>}</div>}
    <div className="assessment-list-filters">
      <label className="assessment-list-search"><Search size={16} aria-hidden="true"/><input aria-label="Search assessments" placeholder="Search assessments" value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/></label>
      {!unit&&<label><span className="sr-only">Filter by unit</span><select aria-label="Filter assessments by unit" value={filters.unit} onChange={e=>setFilters({...filters,unit:e.target.value})}><option value="">All units</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label>}
      <label><span className="sr-only">Completion</span><select aria-label="Filter assessments by completion" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value as AssessmentFilters["status"]})}><option value="all">All statuses</option><option value="open">Not recorded complete</option><option value="done">Recorded complete</option></select></label>
      <label><span className="sr-only">Schedule</span><select aria-label="Filter assessments by schedule" value={filters.dates} onChange={e=>setFilters({...filters,dates:e.target.value as AssessmentFilters["dates"]})}><option value="all">All dates</option><option value="upcoming">Today & upcoming</option><option value="past">Past dates</option><option value="unknown">Date to confirm</option><option value="exams">Awaiting exam date</option></select></label>
    </div>
    <div className="assessment-list-tools"><span role="status">{rows.length} of {total} assessments{filtered&&" · filtered"}</span><div><label>Sort <select aria-label="Sort assessments" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value as AssessmentSort,descending:e.target.value==="weight"})}><option value="date">Due / scheduled</option><option value="title">Name</option><option value="unit">Unit</option><option value="weight">Weight</option></select></label><button aria-label={filters.descending?"Sort ascending":"Sort descending"} title={filters.descending?"Sort ascending":"Sort descending"} onClick={()=>setFilters({...filters,descending:!filters.descending})}>{filters.descending?<ArrowDown size={15}/>:<ArrowUp size={15}/>}</button>{filtered&&<button onClick={()=>setFilters({...defaultAssessmentFilters,unit:unit||""})}>Clear filters</button>}</div></div>
    <div className="assessment-list-table-wrap"><table className="assessment-list-table">
      <caption className="sr-only">Assessment inventory. Expand grouped assessments to see steps. Completion is shared with your calendar, not a grade.</caption>
      <thead><tr><th scope="col">Done</th>{sortHeading("title","Assessment")}{!compact&&sortHeading("unit","Unit")}{sortHeading("date","Due / scheduled")}{sortHeading("weight","Weight")}</tr></thead>
      <tbody>{rows.map(row=>{
        const {task,grouped,children,matchingChildren}=row;
        const open=expanded.has(task.id), groupId=`${id}-${task.id}`;
        const controlledIds=matchingChildren.length?matchingChildren.map((_,i)=>`${groupId}-${i}`).join(" "):groupId;
        return <Fragment key={task.id}><tr className={row.done?"assessment-list-done":""}>
          <td className="assessment-list-check">{grouped?<button aria-label={`${open?"Collapse":"Expand"} ${task.title} steps`} aria-expanded={open} aria-controls={controlledIds} onClick={()=>toggleExpanded(task.id)}>{open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button>:completion(task)}</td>
          <td className="assessment-list-name">{title(task)}{grouped&&<button className="assessment-list-progress" aria-expanded={open} onClick={()=>toggleExpanded(task.id)}>{row.completed}/{row.total} recorded complete{matchingChildren.length<children.length?` · ${matchingChildren.length} match filters`:""}</button>}{!compact&&<small className="assessment-list-mobile-unit" style={{color:color(task.unit)}}>{task.unit}</small>}</td>
          {!compact&&<td className="assessment-list-unit"><span style={{color:color(task.unit)}}>{task.unit}</span></td>}
          <td className="assessment-list-date">{row.next?<>{grouped&&<small>{row.next.done?"Recorded step":filtered?"Matching step":"Next step"}</small>}{dates(row.next)}{grouped&&children.some(t=>!t.done&&!t.date)&&<small>Some step dates still to confirm</small>}</>:<span>Step schedule to confirm</span>}</td>
          <td className="assessment-list-weight">{assessmentListWeight(task,grouped)}</td>
        </tr>{matchingChildren.map((t,i)=><tr hidden={!open} id={`${groupId}-${i}`} key={t.id} className={`assessment-list-child-row${t.done?" assessment-list-done":""}`}><td className="assessment-list-check">{completion(t)}</td><td className="assessment-list-name">{title(t)}</td>{!compact&&<td className="assessment-list-unit"/>}<td className="assessment-list-date">{dates(t)}</td><td className="assessment-list-weight">{assessmentListWeight(t)}</td></tr>)}{grouped&&!matchingChildren.length&&<tr hidden={!open} id={groupId}><td/><td>Step records are missing. Open this assessment to review its details.</td>{!compact&&<td className="assessment-list-unit"/>}<td/><td/></tr>}</Fragment>;
      })}</tbody>
    </table></div>
    {!rows.length&&<div className="assessment-list-empty"><strong>{total?"No assessments match these filters":"No assessments recorded yet"}</strong><p>{total?"Try a different search, unit or date filter.":"Add an assessment, or check your imported unit outlines. An empty list does not mean there is no coursework."}</p>{filtered&&<button onClick={()=>setFilters({...defaultAssessmentFilters,unit:unit||""})}>Clear filters</button>}</div>}
    <p className="assessment-list-note">Unchecked means unrecorded, not necessarily unfinished. Group weights are totals; ticks are not grades.</p>
  </section>;
}
