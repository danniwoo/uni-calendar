import { parsePlanSnapshot, MAX_TASK_TITLE } from "../../../lib/today-plan.ts";
import { sydneyDate } from "../../../lib/semester.ts";

// The panel lives only inside the verified account's page. Every click uses
// the current token, and a detached panel never presents a late response.
export function todayPlanPanel(request) {
  const make = (tag,text) => {const el=document.createElement(tag); if(text!==undefined)el.textContent=text; return el;};
  const panel=make("section"); panel.className="panel";
  const load=make("button","Load / refresh Today plan"), add=make("button","Add to Today");
  const input=make("input"); input.type="text"; input.placeholder="Task title"; input.maxLength=MAX_TASK_TITLE; input.setAttribute("aria-label","Today task title");
  const result=make("p"); result.setAttribute("aria-live","polite");
  const list=make("div");
  panel.append(make("h2","Today · personal plan"),make("p","The same plan as Today on your iPhone."),load,result,list,input,add);
  let snapshot=null, busy=false;
  function lock(value) {
    busy=value; load.disabled=value; add.disabled=value || !snapshot; input.disabled=value || !snapshot;
    for (const control of list.querySelectorAll("input,button")) control.disabled=value || !snapshot;
  }
  async function run(tasks,clearTitle=false) {
    if(busy || !panel.isConnected)return;
    lock(true);
    try {
      const writing=tasks!==undefined;
      const next=parsePlanSnapshot(await request(writing ? {expectedRevision:snapshot.revision,tasks} : undefined));
      if(!panel.isConnected)return;
      snapshot=next; result.textContent=`Revision ${next.revision} · ${next.tasks.length} tasks`;
      list.replaceChildren();
      for(const task of next.tasks){
        const label=make("label"); label.className="task"; const box=make("input"); box.type="checkbox"; box.checked=task.completedAt!==undefined;
        box.onchange=()=>{const done=box.checked;box.checked=task.completedAt!==undefined;
          void run(next.tasks.map(t=>t.id===task.id ? {...t,completedAt:done ? Date.now() : undefined} : t));};
        label.append(box,make("span",`${task.title} · ${task.unit ? task.unit+" · " : ""}${task.plannedFor}`));
        const remove=make("button","Delete"); remove.setAttribute("aria-label","Delete "+task.title);
        remove.onclick=()=>{if(window.confirm("Delete this task from your staging plan?"))
          void run(next.tasks.filter(t=>t.id!==task.id));};
        const row=make("div");row.append(label,remove);list.append(row);
      }
      if(clearTitle)input.value="";
    }catch(error){
      if(panel.isConnected){snapshot=null;list.replaceChildren();result.textContent=error.message+" Refresh the plan.";}
    }finally{lock(false);}
  }
  lock(false);
  load.onclick=()=>void run();
  add.onclick=()=>{
    const title=input.value.trim();
    if(!title || !snapshot)return;
    void run([...snapshot.tasks,{id:crypto.randomUUID(),title,plannedFor:sydneyDate(),createdAt:Date.now()}],true);
  };
  return panel;
}
