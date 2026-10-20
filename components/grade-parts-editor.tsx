"use client";
import { useId, useState } from "react";
import type { GradePlan, Semester, Task } from "@/lib/semester";
import { partGrade, seedGradePlan } from "@/lib/grades";
import { gradeNumber as n, validGrade } from "@/lib/grade-value";

export function GradePartsEditor({semester,task,onSave,onCancel}:{semester:Semester;task:Task;onSave:(plan:GradePlan,expected:GradePlan|null|undefined)=>void;onCancel:()=>void}) {
  const id=useId();
  const [initial]=useState(()=>seedGradePlan(semester,task));
  const [mode,setMode]=useState(initial.mode);
  const [method,setMethod]=useState(initial.method);
  const [best,setBest]=useState(String(initial.bestCount||task.rules?.bestOf||1));
  const [items,setItems]=useState(()=>initial.items.map(i=>({...i,earned:i.grade?String(i.grade.earned):"",possible:i.grade?String(i.grade.possible):i.maximum?String(i.maximum):"",partWeight:i.weight?String(i.weight):""})));
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  function patch(index:number,values:Partial<typeof items[number]>) {setItems(all=>all.map((item,i)=>i===index?{...item,...values}:item));setError("");}
  function draft():GradePlan {
    return {mode,method,...(method==="best"?{bestCount:Number(best)}:{}),items:items.map(i=>({id:i.id,name:i.name.trim(),excluded:!!i.excluded,
      grade:i.earned.trim()&&i.possible.trim()?{earned:Number(i.earned),possible:Number(i.possible)}:initial.items.find(before=>before.id===i.id)?.grade===undefined?undefined:null,
      ...(i.possible.trim()?{maximum:Number(i.possible)}:{}),...(i.partWeight.trim()?{weight:Number(i.partWeight)}:{})}))};
  }
  const invalid=items.some(i=>!i.name.trim() || (i.earned.trim()&&(!i.possible.trim()||!validGrade({earned:Number(i.earned),possible:Number(i.possible)}))) || (i.possible.trim()&&(!Number.isFinite(Number(i.possible))||Number(i.possible)<=0)) || (i.partWeight.trim()&&(!Number.isFinite(Number(i.partWeight))||Number(i.partWeight)<=0||Number(i.partWeight)>100)));
  const preview=invalid?null:partGrade(draft());
  function save() {
    if(invalid) {setError("Give every item a name. Scores must be between 0 and the maximum; maximum marks must be greater than 0. Leave scores blank until released.");return;}
    if(method==="best"&&(!Number.isInteger(Number(best))||Number(best)<=0||Number(best)>200)){setError("Enter a whole number of results to count.");return;}
    setSaving(true);
    try {onSave(draft(),task.gradePlan);}catch(e){setError(e instanceof Error?e.message:"Could not save individual grades.");setSaving(false);}
  }
  return <form className="grade-parts-editor" aria-label={`Individual grades for ${task.title}`} onSubmit={e=>{e.preventDefault();save();}}>
    {initial.canvasPendingReview&&<p className="notice">Imported from Canvas · provisional. Check the calculation and add any future items missing from Canvas. Save grades to confirm this setup; until then it is not counted as a final assessment result.</p>}
    <div className="grade-parts-heading"><strong>{task.title} · Grades</strong><label htmlFor={`${id}-source`}>Grade source<select id={`${id}-source`} value={mode} onChange={e=>setMode(e.target.value as GradePlan["mode"])}><option value="parts">Calculate from individual grades</option><option value="overall">Use reported overall result</option></select></label></div>
    {mode==="overall"?<p className="grade-secondary">Individual entries will be kept but not counted. After saving, use the main row to enter the reported overall result. {task.grade?`Currently ${task.grade.earned} / ${task.grade.possible}.`:"No overall result recorded yet."}</p>:<>
      <div className="grade-parts-settings"><label htmlFor={`${id}-method`}>Calculation<select id={`${id}-method`} value={method} onChange={e=>setMethod(e.target.value as GradePlan["method"])}><option value="points">Add marks together</option><option value="equal">Equal weight per item</option><option value="weighted">Different part weights</option><option value="best">Best N percentages · equal weight</option></select></label>{method==="best"&&<label htmlFor={`${id}-best`}>Results to count<input id={`${id}-best`} type="number" min="1" max="200" step="1" value={best} onChange={e=>setBest(e.target.value)}/></label>}</div>
      <p className="grade-secondary">{method==="points"?"Total marks earned ÷ total maximum marks. A 20-mark item counts twice as much as a 10-mark item.":method==="equal"?"Average each item’s percentage equally, even when maximum marks differ.":method==="weighted"?"Set each part’s share of this assessment (together 100%), not its share of the whole unit.":"Average the highest N percentages equally. This may differ from a points-based drop-lowest rule; check your course rules."} Blank scores are not zero.</p>
      {task.rules?.bestOf&&<p className="grade-rule-note">Outline mentions best {task.rules.bestOf}. Check the calculation and included items against the published marking rules.</p>}
      <div className="grade-parts-columns" aria-hidden="true"><span>Include</span><span>Quiz / part</span><span>Score</span><span>Out of</span>{method==="weighted"&&<span>Part %</span>}</div>
      <div className="grade-parts-items">{items.map((item,index)=><div className={`grade-part-inputs${item.excluded?" grade-part-excluded":""}${method==="weighted"?" grade-part-weighted":""}`} key={item.id}>
        <label className="grade-part-include"><input type="checkbox" checked={!item.excluded} onChange={e=>patch(index,{excluded:!e.target.checked})} aria-label={`Include item ${index+1}`}/><span className="sr-only">Include</span></label>
        <label className="grade-part-name"><span className="sr-only">Item {index+1} name</span><input aria-label={`Item ${index+1} name`} maxLength={300} value={item.name} onChange={e=>patch(index,{name:e.target.value})}/></label>
        <label><span className="grade-part-mobile-label">Score</span><input aria-label={`Item ${index+1} score`} type="number" min="0" step="any" placeholder="—" value={item.earned} onChange={e=>patch(index,{earned:e.target.value})}/></label>
        <label><span className="grade-part-mobile-label">Out of</span><input aria-label={`Item ${index+1} maximum`} type="number" min="0" step="any" placeholder="e.g. 3" value={item.possible} onChange={e=>patch(index,{possible:e.target.value})}/></label>
        {method==="weighted"&&<label><span className="grade-part-mobile-label">Part %</span><input aria-label={`Item ${index+1} weight`} type="number" min="0" max="100" step="any" placeholder="%" value={item.partWeight} onChange={e=>patch(index,{partWeight:e.target.value})}/></label>}
      </div>)}</div>
      <div className="grade-parts-add"><button type="button" disabled={items.length>=200} onClick={()=>setItems(all=>[...all,{id:crypto.randomUUID(),name:`Part ${all.length+1}`,earned:"",possible:all[0]?.possible||"",partWeight:""}])}>+ Add graded item</button><button type="button" disabled={!(Number(items[0]?.possible)>0)} onClick={()=>setItems(all=>all.map(i=>!i.possible?{...i,possible:all[0].possible}:i))}>Use first maximum for blank items</button></div>
      <p className="grade-secondary">Include only graded items; uncheck non-graded demos. These entries do not add or change calendar events. Switching grade source keeps both sets of entries; only the selected source counts.</p>
      <div className="grade-parts-preview" aria-live="polite"><strong>{preview?.ratio!=null?`${n(preview.ratio*100)}%${preview.finished?" · All included grades recorded":" so far"}`:"No calculated grade yet"}</strong><span>{preview?`${preview.recorded} / ${preview.total} included items graded`:"Check the entries above"}{preview?.ratio!=null&&method==="points"?` · ${n(preview.earned!)} / ${n(preview.possible!)} marks`:""}</span>{preview?.error&&<span className="grade-warning">{preview.error} You can save your entries and finish the setup later.</span>}{preview?.ratio!=null&&!preview.finished&&<span>Uses released scores only. This is not a final result.</span>}</div>
    </>}
    {error&&<p className="grade-warning" role="alert">{error}</p>}
    <div className="grade-parts-actions"><button className="primary" type="submit" disabled={saving}>Save grades</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
