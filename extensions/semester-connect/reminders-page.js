const status=document.querySelector("#status"),enable=document.querySelector("#enable"),test=document.querySelector("#test"),disable=document.querySelector("#disable");
let owner=null;
function render(s){owner=s.owner;status.textContent=s.error||(s.enabled?`Desktop reminders on · ${s.count} upcoming reminders on this device.`:owner?"Desktop reminders are off.":"First allow access below, then open Semester in this Chrome profile and return here.");enable.disabled=s.enabled;test.disabled=!s.permission;disable.disabled=!s.enabled;}
async function call(type,extra={}){const result=await chrome.runtime.sendMessage({type,...extra});if(result?.error&&!result.available)throw new Error(result.error);render(result);}
enable.addEventListener("click",async()=>{try{const granted=await chrome.permissions.request({permissions:["alarms","notifications"],origins:["https://usyd-semester-board.earthy-trout-5263.chatgpt.site/*"]});if(!granted){status.textContent="Permission was not granted. No reminders enabled.";return;}await call("reminders-connect");if(!owner){status.textContent="Access allowed. Open Semester, then return here to enable reminders for your account.";return;}await call("reminders-enable",{owner});}catch(e){status.textContent=e.message;}});
test.addEventListener("click",()=>call("reminders-test").then(()=>{status.textContent="Test sent. If it did not appear, check Chrome notifications in your system settings and Focus mode.";}).catch(e=>{status.textContent=e.message;}));
disable.addEventListener("click",()=>call("reminders-disable").catch(e=>{status.textContent=e.message;}));
window.addEventListener("focus",()=>void call("reminders-status").catch(e=>{status.textContent=e.message;}));
void call("reminders-status").catch(e=>{status.textContent=e.message;});
