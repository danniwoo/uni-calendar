// Isolated-world bridge. Only the explicitly permitted Semester origin receives
// pending source data; no credentials, tokens, or automatic save commands.
(() => {
  const origin="https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
  if (location.origin!==origin || window!==window.top || globalThis.__semesterConnectBridge) return;
  globalThis.__semesterConnectBridge=true;
  let busy=false,again=false;
  async function send() {
    if (busy) {again=true;return;}
    busy=true;
    try {
      const inbox=await chrome.runtime.sendMessage({type:"connect-inbox"});
      window.postMessage({type:"semester-connect-inbox-v1",inbox},origin);
    } catch {window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:false,raw:null,message:"Connect reloaded or unavailable. Reload Semester, or use JSON."}},origin);}
    finally {busy=false;if(again){again=false;void send();}}
  }
  window.addEventListener("message",e=>{if(e.source===window&&e.origin===origin&&e.data?.type==="semester-connect-request-v1")void send();});
  window.addEventListener("message",async e=>{
    if(e.source!==window||e.origin!==origin||e.data?.type!=="semester-connect-check-all-v1")return;
    try {await chrome.runtime.sendMessage({type:"connect-check-all"});await send();}
    catch {window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:false,raw:null,message:"Connect unavailable. Reload Semester and Connect, or use JSON."}},origin);}
  });
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==="semester-connect-changed")void send();});
  void send();
})();
