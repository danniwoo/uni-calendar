"use client";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Search, Plus, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { COLORS, type Semester, type Task, type Grade, type GradePlan } from "@/lib/semester";
import { AssessmentGrades } from "@/components/assessment-grades";
import {activityLabel} from "@/lib/assessment-activity";
import { assessmentRows, assessmentListDate, assessmentListWeight, assessmentDateContext, assessmentDateSections, assessmentDateMatches, assessmentStepLabel, assessmentOverviewSchedule, isRecurringAssessment, defaultAssessmentFilters, type AssessmentDisplay, type AssessmentFilters, type AssessmentSort } from "@/lib/assessment-list";

export function AssessmentList({semester,today,unit,compact=false,onOpen,onToggle,onAdd,onGrade,onGradePlan,onGradeSeen,focusGrade,onHistory,importedGradeView}:{
  semester:Semester; today:string; unit?:string; compact?:boolean;
  onOpen:(task:Task)=>void; onToggle:(task:Task)=>void; onAdd?:(unit?:string)=>void;
  onGrade?:(id:string,grade:Grade|null,expected:Grade|null|undefined)=>void;
  onGradePlan?:(id:string,plan:GradePlan,expected:GradePlan|null|undefined)=>void;
  onGradeSeen?:(id:string)=>void;
  focusGrade?:{id:string;request:number};onHistory?:()=>void;importedGradeView?:number;
}) {
  const [filters,setFilters]=useState<AssessmentFilters>({...defaultAssessmentFilters,unit:unit||""});
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const [display,setDisplay]=useState<AssessmentDisplay>("overview");
  const [showGrades,setShowGrades]=useState(false);
  // Import lands on the results, not a table that hides grades by default.
  // Merely showing the list does not mark any grade as read or change data.
  useEffect(()=>{if(!importedGradeView)return;setFilters({...defaultAssessmentFilters,hideRecurring:false});setDisplay("overview");setShowGrades(true);},[importedGradeView]);
  useEffect(()=>{if(!focusGrade)return;const task=semester.tasks.find(t=>t.id===focusGrade.id)||semester.units.flatMap(u=>u.assessments).find(t=>t.id===focusGrade.id);if(!task)return;setFilters({...defaultAssessmentFilters,unit:task.unit,hideRecurring:false});setDisplay("overview");setShowGrades(true);},[focusGrade]);
  const overview=display==="overview";
  const grades=overview&&showGrades&&!!onGrade;
  const id=useId();
  const upcomingRef=useRef<HTMLTableRowElement>(null);
  const effective={...filters,unit:unit||filters.unit};
  const showUnits=!compact&&!effective.unit;
  const rows=assessmentRows(semester,effective,today,display);
  const byWeek=!overview&&filters.sort==="date";
  const datedSections=byWeek?assessmentDateSections(semester,rows,today):[];
  const sections=byWeek?datedSections:[{key:"all",label:"",detail:"",current:false,rows}];
  const upcomingKey=datedSections.filter(s=>s.end&&s.end>=today).sort((a,b)=>a.start!.localeCompare(b.start!))[0]?.key;
  const total=assessmentRows(semester,{...defaultAssessmentFilters,unit:unit||""},today).length;
  const filtered=!!filters.query || !!(!unit&&filters.unit) || filters.status!=="all" || filters.dates!=="all" || filters.hideRecurring;
  const color=(code:string)=>COLORS[Math.max(0,semester.units.findIndex(u=>u.code===code))%COLORS.length];
  function changeSort(sort:AssessmentSort){setFilters(f=>({...f,sort,descending:f.sort===sort?!f.descending:sort==="weight"}));}
  function toggleExpanded(key:string){setExpanded(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});}
  function showSchedule(key:string){setDisplay("schedule");setExpanded(prev=>new Set([...prev,key]));}
  function sortHeading(sort:AssessmentSort,label:string){return <th scope="col" aria-sort={filters.sort===sort?(filters.descending?"descending":"ascending"):"none"}><button onClick={()=>changeSort(sort)}>{label}{filters.sort===sort&&(filters.descending?<ArrowDown size={13}/>:<ArrowUp size={13}/>)}</button></th>;}
  const completion=(t:Task)=><Checkbox checked={!!t.done} onCheckedChange={()=>onToggle(t)} aria-label={`Mark ${t.unit} ${t.title} ${t.done?"unfinished":"complete"}`}/>;
  const title=(t:Task)=><><button className="assessment-list-title" onClick={()=>onOpen(t)}>{t.title}</button>{t.hurdle&&<span className="assessment-list-flags">Hurdle</span>}</>;
  const dates=(t:Task,context=false)=><><span>{assessmentListDate(t)}</span>{t.activity&&<small className="assessment-activity-date">{activityLabel(t)}</small>}{(filters.sort!=="date"||context)&&<small className="assessment-list-date-context">{assessmentDateContext(semester,t)}</small>}{t.sourceConflict&&<button className="assessment-list-date-warning" onClick={()=>onOpen(t)}>Dates conflict · review</button>}</>;
  const sectionContent=(section:typeof sections[number])=><><span>{section.label}</span><small>{section.detail}</small><small className="assessment-list-section-count">{section.rows.length} {section.rows.length===1?"assessment":"assessments"}</small></>;
  return <section className={`assessment-list${compact?" assessment-list-compact":""}${overview?" assessment-list-overview":""}${!showUnits?" assessment-list-single-unit":""}`} aria-label={unit?`${unit} assessment list`:"All assessments"}>
    {!compact&&<div className="assessment-list-heading"><div><h2>Assessments</h2><p>Your coursework, deadlines and assessment steps.</p></div>{onAdd&&<button className="primary" onClick={()=>onAdd(effective.unit||undefined)}><Plus size={16}/>Add assessment</button>}</div>}
    <div className="assessment-list-viewbar"><div className="assessment-list-modes" role="group" aria-label="Assessment display"><button aria-pressed={overview} onClick={()=>setDisplay("overview")}>Overview</button><button aria-pressed={!overview} onClick={()=>setDisplay("schedule")}>Steps &amp; schedule</button></div></div>
    <div className="assessment-list-filters">
      <label className="assessment-list-search"><Search size={16} aria-hidden="true"/><input aria-label="Search assessments" placeholder="Search assessments" value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/></label>
      {!unit&&<label><span className="sr-only">Filter by unit</span><select aria-label="Filter assessments by unit" value={filters.unit} onChange={e=>setFilters({...filters,unit:e.target.value})}><option value="">All units</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label>}
      <label><span className="sr-only">Completion</span><select aria-label="Filter assessments by completion" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value as AssessmentFilters["status"]})}><option value="all">All statuses</option><option value="open">Not recorded complete</option><option value="done">Recorded complete</option></select></label>
      <label><span className="sr-only">Schedule</span><select aria-label="Filter assessments by schedule" value={filters.dates} onChange={e=>setFilters({...filters,dates:e.target.value as AssessmentFilters["dates"]})}><option value="all">All dates</option><option value="upcoming">Today & upcoming</option><option value="past">Past dates</option><option value="unknown">Date to confirm</option><option value="exams">Awaiting exam date</option></select></label>
    </div>
    <div className="grade-display-options">{onGrade&&overview&&<label className="grade-display-toggle" htmlFor={`${id}-grades`}><Checkbox id={`${id}-grades`} checked={showGrades} onCheckedChange={v=>setShowGrades(v===true)}/>Show grades</label>}<label className="grade-display-toggle" htmlFor={`${id}-recurring`}><Checkbox id={`${id}-recurring`} checked={filters.hideRecurring} onCheckedChange={checked=>setFilters({...filters,hideRecurring:checked===true})}/>Hide recurring</label></div>
    <div className="assessment-list-tools"><span role="status">{rows.length} of {total} assessments{filtered&&" · filtered"}</span><div>{upcomingKey&&<button className="assessment-list-jump" onClick={()=>{upcomingRef.current?.scrollIntoView({block:"start"});upcomingRef.current?.focus({preventScroll:true});}}>Jump to upcoming</button>}<label>Sort <select aria-label="Sort assessments" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value as AssessmentSort,descending:e.target.value==="weight"})}><option value="date">Due / scheduled</option><option value="title">Name</option><option value="unit">Unit</option><option value="weight">Weight</option></select></label><button aria-label={filters.descending?"Sort ascending":"Sort descending"} title={filters.descending?"Sort ascending":"Sort descending"} onClick={()=>setFilters({...filters,descending:!filters.descending})}>{filters.descending?<ArrowDown size={15}/>:<ArrowUp size={15}/>}</button>{filtered&&<button onClick={()=>setFilters({...defaultAssessmentFilters,unit:unit||""})}>Clear filters</button>}</div></div>
    {onHistory&&<button className="canvas-history-link" onClick={onHistory}>Canvas update history</button>}
    {onGrade&&<div hidden={!grades}><AssessmentGrades semester={semester} rows={rows} unit={effective.unit} onGrade={onGrade} onGradePlan={onGradePlan} onOpen={onOpen} onToggle={onToggle} onGradeSeen={onGradeSeen} focusGrade={grades?focusGrade:undefined}/></div>}
    <div className="assessment-list-table-wrap" hidden={grades}><table className="assessment-list-table">
      <caption className="sr-only">{overview?"One row per assessment. Group ranges show known dates across all steps; date sorting uses the earliest recorded schedule.":"Expand grouped assessments to see steps."} Completion is shared with your calendar, not a grade.</caption>
      <colgroup><col className="assessment-col-check"/><col className="assessment-col-name"/><col className="assessment-col-weight"/><col className="assessment-col-date"/>{showUnits&&<col className="assessment-col-unit"/>}</colgroup>
      <thead><tr><th scope="col">Done</th>{sortHeading("title","Assessment")}{sortHeading("weight","Weight")}{sortHeading("date",overview?"Due / dates":"Due / scheduled")}{showUnits&&<th className="assessment-list-unit-heading" scope="col" aria-sort={filters.sort==="unit"?(filters.descending?"descending":"ascending"):"none"}><button onClick={()=>changeSort("unit")}>Unit{filters.sort==="unit"&&(filters.descending?<ArrowDown size={13}/>:<ArrowUp size={13}/>)}</button></th>}</tr></thead>
      {sections.map(section=><tbody key={section.key}>{byWeek&&<tr className={`assessment-list-section${section.current?" assessment-list-section-current":""}`} ref={section.key===upcomingKey?upcomingRef:undefined} tabIndex={-1}><th className={showUnits?"assessment-section-desktop":""} scope="rowgroup" colSpan={showUnits?5:4}>{sectionContent(section)}</th>{showUnits&&<th className="assessment-section-mobile" scope="rowgroup" colSpan={4}>{sectionContent(section)}</th>}</tr>}{section.rows.map(row=>{
        const {task,grouped,children,matchingChildren}=row;
        const pastUnrecorded=children.filter(t=>!t.done&&assessmentDateMatches(semester,t,"past",today)).length;
        const recurring=isRecurringAssessment(task,children);
        const summary=assessmentOverviewSchedule(semester,row);
        const conflict=task.sourceConflict?task:children.find(t=>t.sourceConflict);
        const open=expanded.has(task.id), groupId=`${id}-${task.id}`;
        const controlledIds=matchingChildren.length?matchingChildren.map((_,i)=>`${groupId}-${i}`).join(" "):groupId;
        return <Fragment key={task.id}><tr className={row.done?"assessment-list-done":""}>
          <td className="assessment-list-check">{grouped?(overview?<button aria-label={`Review ${task.title} completion: ${row.completed} of ${row.total} recorded complete`} title="Completion is recorded on individual steps" onClick={()=>showSchedule(task.id)}>{row.done?<Check size={16}/>:<span aria-hidden="true">—</span>}</button>:<button aria-label={`${open?"Collapse":"Expand"} ${task.title} steps`} aria-expanded={open} aria-controls={controlledIds} onClick={()=>toggleExpanded(task.id)}>{open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button>):completion(task)}</td>
          <td className="assessment-list-name">{title(task)}{!overview&&grouped&&row.next&&<button className="assessment-list-next" onClick={()=>onOpen(row.next!)}><span>{assessmentStepLabel(semester,row,today)}</span>{row.next.title}<ChevronRight size={12} aria-hidden="true"/></button>}{!overview&&grouped&&<button className="assessment-list-progress" aria-expanded={open} onClick={()=>toggleExpanded(task.id)}>{row.completed}/{row.total} complete · {open?"Hide":"View"} steps{matchingChildren.length<children.length?` · ${matchingChildren.length} match filters`:""}{pastUnrecorded?` · ${pastUnrecorded} past unrecorded`:""}</button>}{showUnits&&<small className="assessment-list-mobile-unit" style={{color:color(task.unit)}}>{task.unit}</small>}</td>
          <td className="assessment-list-weight">{assessmentListWeight(task,grouped||(overview&&recurring))}</td>
          <td className="assessment-list-date">{overview?<>{grouped||recurring?<button className="assessment-list-summary-date" onClick={()=>grouped?showSchedule(task.id):onOpen(task)} aria-label={`View ${task.title} schedule`}><span>{summary.label}</span><small>{summary.detail}</small></button>:<><span>{summary.label}</span>{summary.detail&&<small className="assessment-activity-date">{summary.detail}</small>}</>}{(grouped||recurring)&&task.activity&&<small className="assessment-activity-date">{activityLabel(task)}</small>}{conflict&&<button className="assessment-list-date-warning" onClick={()=>onOpen(conflict)}>Dates conflict · review</button>}</>:row.next?<>{grouped&&<small className="assessment-list-step-date">Step schedule</small>}{dates(row.next)}{task.sourceConflict&&grouped&&!row.next.sourceConflict&&<button className="assessment-list-date-warning" onClick={()=>onOpen(task)}>Assessment dates conflict · review</button>}{grouped&&children.some(t=>!t.done&&!t.date)&&<small>Some dates to confirm</small>}</>:<span>Step schedule to confirm</span>}</td>
          {showUnits&&<td className="assessment-list-unit"><span style={{color:color(task.unit),background:color(task.unit)+"0d"}}>{task.unit}</span></td>}
        </tr>{!overview&&matchingChildren.map((t,i)=><tr hidden={!open} id={`${groupId}-${i}`} key={t.id} className={`assessment-list-child-row${t.done?" assessment-list-done":""}`}><td className="assessment-list-check">{completion(t)}</td><td className="assessment-list-name">{title(t)}</td><td className="assessment-list-weight">{assessmentListWeight(t)}</td><td className="assessment-list-date">{dates(t,true)}</td>{showUnits&&<td className="assessment-list-unit"/>}</tr>)}{!overview&&grouped&&!matchingChildren.length&&<tr hidden={!open} id={groupId}><td/><td>Step records are missing. Open this assessment to review its details.</td><td/><td/>{showUnits&&<td className="assessment-list-unit"/>}</tr>}</Fragment>;
      })}</tbody>)}
    </table></div>
    {!rows.length&&<div className="assessment-list-empty"><strong>{total?"No assessments match these filters":"No assessments recorded yet"}</strong><p>{total?"Try a different search, unit or date filter.":"Add an assessment, or check your imported unit outlines. An empty list does not mean there is no coursework."}</p>{filtered&&<button onClick={()=>setFilters({...defaultAssessmentFilters,unit:unit||""})}>Clear filters</button>}</div>}
    {!grades&&<p className="assessment-list-note">{overview?"One row per assessment. Ranges show known dates; date sorting uses the earliest schedule. Completion filters apply to the whole assessment.":"Groups are placed by the step shown; expand to see all steps. Completion filters apply to individual steps."} Group weights are totals. Unchecked means unrecorded, not necessarily unfinished.{filters.hideRecurring&&" Recurring assessments are hidden, not removed."}</p>}
  </section>;
}
