// Isolated-world bridge for the explicitly permitted Semester origin only.
(() => {
  const origin = "https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
  if (location.origin !== origin || window !== window.top) return;
  const runtime = chrome.runtime;
  const version = runtime.getManifest().version;
  const previous = globalThis.__semesterConnectBridge;
  if (previous?.version === version && previous.alive?.()) { void previous.send(); return; }
  previous?.dispose?.();
  let busy = false, again = false, disposed = false;
  const alive = () => { try { return !disposed && runtime.getManifest().version === version; } catch { return false; } };
  const unavailable = message => { if (!disposed) window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:false,raw:null,message}},origin); };
  async function send() {
    if (disposed) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const inbox = await runtime.sendMessage({type:"connect-inbox"});
      if (!disposed) window.postMessage({type:"semester-connect-inbox-v1",inbox},origin);
    } catch { unavailable("Connect reloaded or unavailable. Reopen Connect from Canvas, then reload Semester if needed."); }
    finally { busy = false; if (again && !disposed) { again = false; void send(); } }
  }
  async function receive(event) {
    if (disposed || event.source !== window || event.origin !== origin) return;
    if (event.data?.type === "semester-connect-request-v1") { void send(); return; }
    if (event.data?.type !== "semester-connect-check-all-v1") return;
    try { await runtime.sendMessage({type:"connect-check-all"}); await send(); }
    catch { unavailable("Connect unavailable. Reopen Connect from Canvas and reload Semester, or use manual import."); }
  }
  const changed = message => { if (message?.type === "semester-connect-changed") void send(); };
  const dispose = () => {
    disposed = true;
    window.removeEventListener("message",receive);
    try { runtime.onMessage.removeListener(changed); } catch { /* Previous extension context may be invalid. */ }
  };
  window.addEventListener("message",receive);
  runtime.onMessage.addListener(changed);
  globalThis.__semesterConnectBridge = {version,alive,send,dispose};
  void send();
})();
