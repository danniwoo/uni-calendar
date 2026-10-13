import type {Task} from "@/lib/semester";

export function AwaitingExams({tasks,onTask}:{tasks:Task[];onTask:(task:Task)=>void}){
  if(!tasks.length)return null;
  return <details className="awaiting-exams"><summary>Final exams · awaiting dates ({tasks.length})</summary>
    <p>Add the official date when your exam timetable is available. These aren't counted as missing details.</p>
    <div>{tasks.map(t=><button key={t.id} onClick={()=>onTask(t)}>{t.done?"✓ ":""}{t.unit} · {t.title}<span>{t.weight}</span></button>)}</div>
  </details>;
}
