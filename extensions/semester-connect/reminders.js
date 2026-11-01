// Device-local notifications. No Canvas access, cookies, grades, or network calls.
export const REMINDER_ORIGIN="https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
const KEY="semesterReminders",ALARM="semester-reminder-next",SCRIPT="semester-reminder-bridge";
const HOUR=3600000,DAY=24*HOUR;
export function validReminderSnapshot(v){
  return v&&typeof v.owner==="string"&&/^[a-f0-9]{64}$/.test(v.owner)&&Number.isSafeInteger(v.revision)&&v.revision>=0&&Array.isArray(v.jobs)&&v.jobs.length<=12500&&JSON.stringify(v).length<=1500000&&new Set(v.jobs.map(j=>j?.key)).size===v.jobs.length&&v.jobs.every(j=>j&&typeof j.key==="string"&&j.key.length<=600&&typeof j.taskId==="string"&&j.taskId.length>0&&j.taskId.length<=200&&typeof j.title==="string"&&j.title.length<=180&&typeof j.unit==="string"&&j.unit.length<=40&&typeof j.label==="string"&&j.label.length<=100&&Number.isSafeInteger(j.when)&&j.when>0);
}
export function reminderSender(sender,runtime){
  if(sender?.id!==runtime.id)return null;
  if(sender.url===runtime.getURL("reminders.html"))return "settings";
  try {if(sender.frameId===0&&new URL(sender.url).origin===REMINDER_ORIGIN&&new URL(sender.tab.url).origin===REMINDER_ORIGIN)return "website";}catch{}
  return null;
}
export function reminderController(api,now=()=>Date.now()){
  let queue=Promise.resolve();
  const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
  const read=async()=>((await api.storage.local.get(KEY))[KEY]||{enabled:false,owner:null,revision:-1,jobs:[],sent:{}});
  const write=async state=>{await api.storage.local.set({[KEY]:state});};
  const allowed=async()=>await api.permissions.contains({permissions:["alarms","notifications"],origins:[`${REMINDER_ORIGIN}/*`]});
  async function clearNotifications(){if(await api.permissions.contains({permissions:["notifications"]})){const all=await api.notifications.getAll();await Promise.all(Object.keys(all).filter(k=>k.startsWith("semester-reminder:")).map(k=>api.notifications.clear(k)));}}
  async function notify(){const tabs=await api.tabs.query({url:`${REMINDER_ORIGIN}/*`});await Promise.all(tabs.filter(t=>Number.isInteger(t.id)).map(t=>api.tabs.sendMessage(t.id,{type:"semester-reminders-changed"}).catch(()=>{})));}
  async function plan(s){
    if(!await allowed())return;
    await api.alarms.clear(ALARM);
    if(!s.enabled)return;
    const future=s.jobs.filter(j=>!s.sent[j.key]&&j.when>=now()-HOUR);
    if(future.length)await api.alarms.create(ALARM,{when:Math.max(now()+1000,Math.min(...future.map(j=>j.when)))});
  }
  async function state(){const s=await read(),permission=await allowed();return {available:true,enabled:!!s.enabled&&permission,owner:s.owner,revision:s.revision,count:s.enabled&&permission?s.jobs.filter(j=>!s.sent[j.key]&&j.when>now()).length:0,error:s.error||"",permission};}
  async function reconnect(){
    if(!await api.permissions.contains({origins:[`${REMINDER_ORIGIN}/*`]}))return;
    await api.scripting.unregisterContentScripts({ids:[SCRIPT]}).catch(()=>{});
    await api.scripting.registerContentScripts([{id:SCRIPT,matches:[`${REMINDER_ORIGIN}/*`],js:["reminder-bridge.js"],runAt:"document_idle",allFrames:false,persistAcrossSessions:true}]);
    const tabs=await api.tabs.query({url:`${REMINDER_ORIGIN}/*`});await Promise.all(tabs.filter(t=>Number.isInteger(t.id)).map(t=>api.scripting.executeScript({target:{tabId:t.id},files:["reminder-bridge.js"]}).catch(()=>{})));
  }
  const sync=snapshot=>serial(async()=>{
    if(!validReminderSnapshot(snapshot))throw new Error("Invalid reminder schedule. Nothing changed.");
    let s=await read();
    if(s.owner!==snapshot.owner){await clearNotifications();s={enabled:false,owner:snapshot.owner,revision:-1,jobs:[],sent:{}};}
    if(snapshot.revision<s.revision)return state();
    // Equal-revision tabs may only repeat the same saved data; never rearm old alarms.
    const jobs=snapshot.jobs.filter(j=>j.when>now());
    if(snapshot.revision===s.revision&&JSON.stringify(jobs)!==JSON.stringify(s.jobs.filter(j=>j.when>now())))throw new Error("This tab has a different reminder snapshot. Reload Semester before changing reminders.");
    s={...s,revision:snapshot.revision,jobs,receivedAt:now(),sent:Object.fromEntries(Object.entries(s.sent||{}).filter(([,v])=>v.at>now()-32*DAY))};
    await write(s);await plan(s);return state();
  });
  const enable=owner=>serial(async()=>{
    if(!await allowed())throw new Error("Allow notifications, alarms and Semester site access first.");
    const s=await read();if(!owner||s.owner!==owner)throw new Error("Open Semester in this Chrome profile first, then try again.");
    s.enabled=true;s.error="";await write(s);await plan(s);await reconnect();await notify();return state();
  });
  const disable=()=>serial(async()=>{const s=await read();await write({...s,enabled:false,revision:-1,jobs:[],sent:{},error:""});if(await api.permissions.contains({permissions:["alarms"]}))await api.alarms.clear(ALARM);await clearNotifications();await notify();return state();});
  async function notificationId(owner,key){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(owner+key));return "semester-reminder:"+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}
  async function show(id,title,message){await api.notifications.create(id,{type:"basic",iconUrl:api.runtime.getURL("reminder-icon.png"),title,message});}
  const tick=()=>serial(async()=>{
    const s=await read();if(!s.enabled||!await allowed())return;
    const due=s.jobs.filter(j=>!s.sent[j.key]&&j.when<=now()),latest=new Map();
    for(const j of due)if(!latest.has(j.taskId)||latest.get(j.taskId).when<j.when)latest.set(j.taskId,j);
    for(const j of due){const id=await notificationId(s.owner,j.key);s.sent[j.key]={at:now(),id,taskId:j.taskId};}
    // Persist claims before system side effects: duplicate alarms cannot send twice.
    await write(s);
    for(const j of latest.values())if(now()-j.when<=HOUR){
      try{await show(s.sent[j.key].id,j.title,`${j.unit?j.unit+" · ":""}${j.label}${now()-j.when>60000?" · delayed reminder":""}`);}
      catch{s.error="A notification could not be shown. Check Chrome/system notification settings and send a test.";}
    }
    await write(s);await plan(s);await notify();
  });
  const test=()=>serial(async()=>{if(!await allowed())throw new Error("Enable notification permission first.");await show("semester-reminder:test","Semester test reminder","No assignment was changed. This is a test notification.");const s=await read();s.error="";await write(s);await notify();return state();});
  const clicked=id=>serial(async()=>{const s=await read();const receipt=Object.values(s.sent).find(v=>v.id===id);if(!s.enabled||!receipt)return;const url=`${REMINDER_ORIGIN}/#reminder=${encodeURIComponent(s.owner+":"+receipt.taskId)}`;await api.tabs.create({url});await api.notifications.clear(id);});
  const restore=()=>serial(async()=>{await reconnect();await plan(await read());});
  return {state,sync,enable,disable,test,tick,clicked,restore,reconnect,alarmName:ALARM};
}
