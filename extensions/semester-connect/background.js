import {reloadController,senderAccess} from "./reload-check.js";
import {reminderController,reminderSender} from "./reminders.js";
const reminders=reminderController(chrome);
void chrome.storage.local.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"}).catch(()=>{});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const access=reminderSender(sender,chrome.runtime),type=message?.type;
  if(!access||!type?.startsWith("reminders-"))return;
  let job;
  if(type==="reminders-status")job=reminders.state();
  else if(access==="website"&&type==="reminders-sync")job=reminders.sync(message.snapshot);
  else if(access==="website"&&type==="reminders-settings")job=chrome.tabs.create({url:chrome.runtime.getURL("reminders.html")}).then(()=>reminders.state());
  else if(access==="settings"&&type==="reminders-enable")job=reminders.enable(message.owner);
  else if(access==="settings"&&type==="reminders-connect")job=reminders.restore().then(()=>reminders.state());
  else if(access==="settings"&&type==="reminders-disable")job=reminders.disable();
  else if(access==="settings"&&type==="reminders-test")job=reminders.test();
  else return;
  job.then(respond,e=>respond({available:false,error:e.message}));return true;
});
chrome.alarms?.onAlarm.addListener(a=>{if(a.name===reminders.alarmName)void reminders.tick().catch(()=>{});});
chrome.notifications?.onClicked.addListener(id=>void reminders.clicked(id).catch(()=>{}));
chrome.permissions.onAdded.addListener(()=>void reminders.restore().catch(()=>{}));
chrome.permissions.onRemoved.addListener(p=>{if(p.permissions?.some(v=>["alarms","notifications"].includes(v))||p.origins?.includes("https://usyd-semester-board.earthy-trout-5263.chatgpt.site/*"))void reminders.disable().catch(()=>{});});
chrome.tabs.onUpdated.addListener((_id,change)=>{if(change.url?.startsWith("https://usyd-semester-board.earthy-trout-5263.chatgpt.site/signout-with-chatgpt"))void reminders.disable().catch(()=>{});});
void reminders.restore().catch(()=>{});
const reload = reloadController(chrome);
chrome.tabs.onUpdated.addListener(reload.updated);
chrome.tabs.onRemoved.addListener(reload.removed);
chrome.permissions.onRemoved.addListener(p=>{if(p.origins?.some(v=>["https://canvas.sydney.edu.au/*","https://usyd-semester-board.earthy-trout-5263.chatgpt.site/*"].includes(v)))void reload.disable("Site permissions removed. Reload checks stopped; previews cleared.");});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const access=senderAccess(sender,chrome.runtime);
  if (!access) return;
  const operation = message?.type;
  if (operation==="connect-inbox") {reload.inbox().then(respond,()=>respond({enabled:false,raw:null,message:"Connect unavailable. Use JSON or reopen Connect."}));return true;}
  if (operation==="connect-check-all") {void reload.checkAll();respond({ok:true});return;}
  if (access!=="preview") return; // Website cannot configure consent, course IDs or arbitrary read targets.
  if (operation==="connect-reconnect") {reload.reconnect().then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if (operation==="connect-enable") {reload.enable(message.config).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if (operation==="connect-disable") {reload.disable().then(()=>respond({ok:true}));return true;}
});
chrome.action.onClicked.addListener(async (tab) => {
  // Reattach already-consented website tabs after an extension reload.
  await reload.reconnect().catch(()=>{});
  const url = new URL(chrome.runtime.getURL("preview.html"));
  try {
    if (Number.isInteger(tab.id) && new URL(tab.url).origin === "https://canvas.sydney.edu.au") {
      url.searchParams.set("tab", String(tab.id));
    }
  } catch { /* Open the instructions when invoked outside Canvas. */ }
  chrome.tabs.create({ url: url.href });
});
