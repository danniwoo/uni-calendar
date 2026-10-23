import {reloadController,senderAccess} from "./reload-check.js";
const reload = reloadController(chrome);
chrome.tabs.onUpdated.addListener(reload.updated);
chrome.tabs.onRemoved.addListener(reload.removed);
chrome.permissions.onRemoved.addListener(()=>{void reload.disable("Permissions removed. Reload checks stopped; previews cleared.");});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const access=senderAccess(sender,chrome.runtime);
  if (!access) return;
  const operation = message?.type;
  if (operation==="connect-inbox") {reload.inbox().then(respond,()=>respond({enabled:false,raw:null,message:"Connect unavailable. Use JSON or reopen Connect."}));return true;}
  if (access!=="preview") return; // The website cannot configure permissions or trigger reads.
  if (operation==="connect-enable") {reload.enable(message.config).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if (operation==="connect-disable") {reload.disable().then(()=>respond({ok:true}));return true;}
});
chrome.action.onClicked.addListener((tab) => {
  const url = new URL(chrome.runtime.getURL("preview.html"));
  try {
    if (Number.isInteger(tab.id) && new URL(tab.url).origin === "https://canvas.sydney.edu.au") {
      url.searchParams.set("tab", String(tab.id));
    }
  } catch { /* Open the instructions when invoked outside Canvas. */ }
  chrome.tabs.create({ url: url.href });
});
