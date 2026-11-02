import { maxRecoveryBytes, prepareRecovery, recoveryCounts } from "../../recovery.ts";

const labels={units:"Units",work:"Work items",undated:"Rows without their own date",grades:"Work items with marks or a grade plan",attempts:"Scheduled attempts",today:"Today tasks",todayDone:"Completed Today tasks",workDone:"Completed work items",overrides:"Saved completion changes"};
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function button(label,action){const b=el("button",label);b.type="button";b.onclick=action;return b;}

function downloadFile(text,name) {
  const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
  const link=el("a");link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function countTable(before,after){
  const table=el("table");table.className="recovery-counts";
  const header=table.createTHead().insertRow();
  for(const title of ["Records","Current","After restore"])header.append(el("th",title));
  const body=table.createTBody();
  for(const [key,label] of Object.entries(labels)){
    const row=body.insertRow();row.append(el("th",label),el("td",before[key]),el("td",after[key]));
  }
  return table;
}

function attemptSummary(board){
  const attempts=board.tasks.filter(t=>t.attemptId);
  if (!attempts.length) return null;
  const details=el("details");details.append(el("summary",`Scheduled attempts (${attempts.length})`));
  const list=el("ul");
  const parents=new Map([...board.units.flatMap(u=>u.assessments),...board.tasks].map(t=>[t.id,t]));
  for(const task of attempts) {
    const part=parents.get(task.parentId)?.gradePlan?.items.find(item=>item.id===task.attemptId);
    const mark=part?.grade ? `${part.grade.earned}/${part.grade.possible}` : "No recorded mark";
    const week=board.weeks.find(w=>task.date && w.start<=task.date && task.date<=w.end);
    const date=[week?.label, task.date, task.time].filter(Boolean).join(" · ") || "Date to confirm";
    list.append(el("li",`${task.unit} · ${task.title} · ${mark} · ${date}`));
  }
  details.append(list);return details;
}

function progressMatches(expected,actual) {
  if (!actual || actual.snapshot.originalJson!==expected.snapshot.originalJson) return false;
  if (JSON.stringify(actual.todayPlan?.tasks ?? [])!==JSON.stringify(expected.todayPlan?.tasks ?? [])) return false;
  const key=rows=>rows.map(c=>[c.taskId,c.done]).sort(([a],[b])=>a.localeCompare(b));
  return JSON.stringify(key(actual.completion))===JSON.stringify(key(expected.completion));
}

export function backupCheckPanel({accountId,email,read,restore,original,onRestored}) {
  const panel=el("section");panel.className="panel recovery-panel";
  panel.append(el("h2","Back up or restore your semester"),el("p","A full backup includes your semester, Today tasks and work completion. Save a copy before restoring an earlier version."));
  const status=el("p");status.setAttribute("aria-live","polite");
  const full=button("Download full backup",async()=>{
    full.disabled=true;
    try{
      const {backup}=await read();if(!panel.isConnected)return;
      if(!backup)throw new Error("Import a semester before downloading a backup.");
      downloadFile(JSON.stringify(backup),"semester-staging-full-"+new Date().toISOString().replace(/:/g,"-")+".json");
      status.textContent="Full backup downloaded.";
    }catch(e){if(panel.isConnected)status.textContent=e.message;}
    finally{full.disabled=false;}
  });
  const originalButton=button("Download original import",async()=>{
    originalButton.disabled=true;
    try{const text=await original();if(panel.isConnected)downloadFile(text,"semester-original-import.json");}
    catch(e){if(panel.isConnected)status.textContent=e.message;}
    finally{originalButton.disabled=false;}
  });
  originalButton.className="secondary";
  const downloads=el("div");downloads.className="actions";downloads.append(full,originalButton);
  panel.append(downloads,status,el("h3","Restore from a file"));
  const input=el("input");input.type="file";input.accept=".json,application/json";input.setAttribute("aria-label","Choose a semester backup");
  const preview=el("div");preview.setAttribute("aria-live","polite");
  const previewButton=button("Preview selected file",showPreview);previewButton.className="secondary";previewButton.disabled=true;
  let serial=0;
  async function showPreview(){
    const run=++serial,file=input.files?.[0];preview.replaceChildren();previewButton.disabled=!file;
    if(!file)return;
    const isCurrent=()=>panel.isConnected && serial===run && input.files?.[0]===file;
    try{
      if(file.size>maxRecoveryBytes)throw new Error("Choose a JSON backup under 8 MB.");
      preview.textContent="Reading preview…";
      const [fileText,current]=await Promise.all([file.text(),read()]);
      if(!isCurrent())return;
      const {board,backup,full:isFull}=await prepareRecovery(fileText,accountId,current.backup);
      if(!isCurrent())return;
      const note=isFull ? "Restores the semester, Today plan and work completion from this file." : "Updates the semester from the website export. Your current Today plan and completion changes are kept.";
      preview.replaceChildren(el("h3",`${board.year} · ${board.session} — preview`),el("p",file.name),el("p",note),
        countTable(recoveryCounts(current.backup),recoveryCounts(backup)));
      const attempts=attemptSummary(board);if(attempts)preview.append(attempts);
      const result=el("p");result.setAttribute("aria-live","polite");
      const confirm=button(`Restore to ${email}`,async()=>{
        if(!isCurrent())return;
        confirm.disabled=input.disabled=previewButton.disabled=true;
        let saved=false;
        try{
          await restore({file:fileText,expectedVersion:current.version}); saved=true;
          if(!isCurrent())return;
          const fresh=await read();if(!isCurrent())return;
          if(!progressMatches(backup,fresh.backup))throw new Error("The latest data differs from this preview. Download a fresh backup to review.");
          result.textContent="Restore verified. The semester, Today tasks and completion match this preview.";
          onRestored();
        }catch(e){if(isCurrent())result.textContent=(saved ? "Restore was saved. " : "")+e.message;}
        finally{input.disabled=previewButton.disabled=false;}
      });
      preview.append(el("p","Destination account: "+email),confirm,result);
    }catch(e){if(isCurrent())preview.textContent=e.message;}
  }
  input.onchange=showPreview;
  panel.append(el("p","Use a website export to update your semester and keep your current Today tasks and work completion. Choose a semester-staging-full file to restore all three from that backup."),
    el("p","Preview the counts before you restore."),input,previewButton,preview);
  return panel;
}
