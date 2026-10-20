"use client";
import {useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {assessmentDeletionTasks,canDeleteAssessment} from "@/lib/assessment-delete";
import {AssessmentConfirm} from "./assessment-confirm";

export function AssessmentDelete({semester,task,disabled=false,onDelete}:{semester:Semester;task:Task;disabled?:boolean;onDelete:(reviewed:Semester)=>void}) {
  const [reviewed,setReviewed]=useState<Semester|null>(null);
  const [error,setError]=useState("");
  if(!canDeleteAssessment(semester,task.id))return null;
  const affected=reviewed?assessmentDeletionTasks(reviewed,task.id):[];
  const saved=semester.tasks.find(t=>t.id===task.id)!;
  return <div className="personal-delete">
    <button type="button" disabled={disabled} onClick={()=>{setError("");setReviewed(structuredClone(semester));}}>Delete assessment</button>
    {error&&<p className="error" role="alert">{error}</p>}
    {reviewed&&<AssessmentConfirm title={`Delete “${saved.title}”?`}
      description={`Remove this assessment${affected.length>1?` and its ${affected.length-1} steps / occurrences`:""} from Semester, Week, Month and Assessments, including their saved grades and completion. Unsaved edits will be discarded. Canvas and other assessments are unchanged. You can undo immediately after deletion.`}
      action="Delete assessment" cancelLabel="Cancel" onCancel={()=>setReviewed(null)}
      onConfirm={()=>{try{onDelete(reviewed);}catch(e){setError(e instanceof Error?e.message:"Could not delete this assessment.");}setReviewed(null);}}/>}
  </div>;
}
