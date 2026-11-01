(() => {
  const origin="https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
  if(location.origin!==origin||window!==window.top)return;
  const runtime=chrome.runtime,version=runtime.getManifest().version;
  const previous=globalThis.__semesterReminderBridge;
  if(previous?.version===version&&previous.alive()){void previous.send();return;}previous?.dispose?.();
  let disposed=false;
  const alive=()=>{try{return !disposed&&runtime.getManifest().version===version;}catch{return false;}};
  const post=state=>{if(!disposed)window.postMessage({type:"semester-reminders-state-v1",state},origin);};
  async function send(){try{post(await runtime.sendMessage({type:"reminders-status"}));}catch{post({available:false,error:"Reload Semester after updating Connect."});}}
  async function receive(e){if(disposed||e.source!==window||e.origin!==origin||e.data?.type!=="semester-reminders-v1")return;
    const {action,snapshot}=e.data;if(!["status","sync","settings"].includes(action))return;
    try{post(await runtime.sendMessage({type:`reminders-${action}`,...(action==="sync"?{snapshot}:{})}));}catch{post({available:false,error:"Connect unavailable. Reload Semester after updating Connect."});}
  }
  const changed=m=>{if(m?.type==="semester-reminders-changed")void send();};
  const dispose=()=>{disposed=true;window.removeEventListener("message",receive);try{runtime.onMessage.removeListener(changed);}catch{}};
  window.addEventListener("message",receive);runtime.onMessage.addListener(changed);globalThis.__semesterReminderBridge={version,alive,send,dispose};void send();
})();
