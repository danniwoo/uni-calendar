import {readCanvas, READER_VERSION} from "./reader.js";

export const CANVAS = "https://canvas.sydney.edu.au";
export const SEMESTER = "https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
export const ORIGINS = [`${CANVAS}/*`, `${SEMESTER}/*`];
export function senderAccess(sender, runtime) {
  if(sender?.id!==runtime.id)return null;
  if(sender.url?.split("?")[0]===runtime.getURL("preview.html"))return "preview";
  try {if(sender.frameId===0&&new URL(sender.url).origin===SEMESTER&&new URL(sender.tab.url).origin===SEMESTER)return "website";}catch { /* Reject malformed origins. */ }
  return null;
}
const MAX_AGE = 24 * 60 * 60 * 1000;
const id = value => typeof value === "string" && /^[1-9]\d{0,19}$/.test(value);
export function validConfig(c) {
  return c?.enabled === true && id(c.accountId) && Array.isArray(c.courseIds) && c.courseIds.length > 0 && c.courseIds.length <= 8 && c.courseIds.every(id) && new Set(c.courseIds).size === c.courseIds.length;
}
export function courseFromUrl(url) {
  try { const u = new URL(url); return u.origin === CANVAS ? u.pathname.match(/^\/courses\/([1-9]\d{0,19})(?:\/|$)/)?.[1] || null : null; } catch { return null; }
}
export function bundleFromSnapshots(config, snapshots, now = Date.now()) {
  const courses = Object.values(snapshots || {}).filter(s => config.courseIds.includes(s.course?.id) && s.user?.id === config.accountId && s.readerVersion === READER_VERSION && now - Date.parse(s.fetchedAt) >= 0 && now - Date.parse(s.fetchedAt) < MAX_AGE).map(s => {
    const {course, assignments, groups, groupsUnavailable, marksPageUnavailable, fetchedAt} = s;
    return {course, assignments, groups, groupsUnavailable, marksPageUnavailable, fetchedAt};
  });
  if (!courses.length) return null;
  const raw = JSON.stringify({format:"semester-connect",schemaVersion:1,extensionVersion:READER_VERSION,source:CANVAS,accountId:config.accountId,exportedAt:new Date(Math.max(...courses.map(c=>Date.parse(c.fetchedAt)))).toISOString(),courses});
  if (new TextEncoder().encode(raw).length > 1500000 || courses.reduce((n,c)=>n+c.assignments.length,0)>2500) throw new Error("LIMIT");
  return raw;
}

// Dependency injection keeps browser lifecycle and read-only transport testable.
export function reloadController(api, now = () => Date.now()) {
  let queue = Promise.resolve(), epoch = 0, batchPending = false;
  const generation = new Map();
  const getConfig = async () => (await api.storage.local.get("reloadConfig")).reloadConfig;
  const getState = async () => (await api.storage.session.get("reloadState")).reloadState || {};
  const save = async state => { await api.storage.session.set({reloadState:state}); await notify(); };
  async function notify() {
    const tabs = await api.tabs.query({url:`${SEMESTER}/*`});
    await Promise.all(tabs.filter(t=>Number.isInteger(t.id)).map(t=>api.tabs.sendMessage(t.id,{type:"semester-connect-changed"}).catch(()=>{})));
  }
  async function disable(reason = "Reload checks off. Pending previews cleared.") {
    epoch++;
    await api.storage.local.remove("reloadConfig");
    await save({message:reason});
    await api.scripting.unregisterContentScripts({ids:["semester-connect-bridge"]}).catch(()=>{});
  }
  async function enable(config) {
    if (!validConfig(config) || !(await api.permissions.contains({origins:ORIGINS}))) throw new Error("Grant both site permissions and select 1–8 courses first.");
    epoch++;
    await api.storage.local.set({reloadConfig:{enabled:true,accountId:config.accountId,courseIds:config.courseIds}});
    await save({snapshots:{},lastAttempt:{},message:"Enabled. Open or reload a selected Canvas course to check it."});
    await api.scripting.unregisterContentScripts({ids:["semester-connect-bridge"]}).catch(()=>{});
    try {await api.scripting.registerContentScripts([{id:"semester-connect-bridge",matches:[`${SEMESTER}/*`],js:["semester-bridge.js"],runAt:"document_idle",allFrames:false,persistAcrossSessions:true}]);}
    catch {await disable("Could not connect Semester. Reload Connect and try enabling again, or use JSON.");throw new Error("Could not register the Semester connection. Reload checks remain off.");}
    const tabs = await api.tabs.query({url:`${SEMESTER}/*`});
    await Promise.all(tabs.filter(t=>Number.isInteger(t.id)).map(t=>api.scripting.executeScript({target:{tabId:t.id},files:["semester-bridge.js"]}).catch(()=>{})));
  }
  async function inbox() {
    const ownEpoch=epoch;
    const config = await getConfig();
    let state = await getState();
    if (!validConfig(config)) return {enabled:false,message:state.message || "Reload checks are off.",raw:null};
    if (!(await api.permissions.contains({origins:ORIGINS}))) { await disable("Site permission removed. Re-enable in Semester Connect."); return {enabled:false,message:"Site permission removed.",raw:null}; }
    if(ownEpoch!==epoch)return {enabled:false,message:"Connection changed. Check again in Semester Connect.",raw:null};
    if(state.batchInProgress&&!batchPending){state={...state,snapshots:{},batchInProgress:false,message:"Previous batch was interrupted. Nothing imported. Click Check all again after one minute."};await api.storage.session.set({reloadState:state});}
    const snapshots=Object.fromEntries(Object.entries(state.snapshots||{}).filter(([,s])=>now()-Date.parse(s.fetchedAt)>=0&&now()-Date.parse(s.fetchedAt)<MAX_AGE&&s.user?.id===config.accountId&&s.readerVersion===READER_VERSION));
    if(Object.keys(snapshots).length!==Object.keys(state.snapshots||{}).length){
      state={...state,snapshots,message:"Old previews expired. Reload a selected Canvas course to check again."};
      await api.storage.session.set({reloadState:state});
    }
    if(ownEpoch!==epoch)return {enabled:false,message:"Connection changed. Check again in Semester Connect.",raw:null};
    return {enabled:true,canCheckAll:true,checking:batchPending,accountId:config.accountId,courseCount:config.courseIds.length,message:state.message || "Waiting for a selected Canvas course to reload.",raw:bundleFromSnapshots(config,state.snapshots,now())};
  }
  // One deliberate batch uses an existing Canvas tab, but reads only the IDs
  // previously consented to in the extension. No page-supplied IDs or URLs.
  function checkAll() {
    if(batchPending)return queue;
    batchPending=true;
    const ownEpoch=epoch;
    queue=queue.then(async()=>{
      const config=await getConfig();
      if(ownEpoch!==epoch||!validConfig(config))return;
      if(!await api.permissions.contains({origins:ORIGINS})){await disable("Site permission removed. Re-enable in Semester Connect.");return;}
      const state=await getState();
      if(now()-(state.lastBatchAttempt||0)<60000){await save({...state,message:"All-course checks are limited to once a minute. Existing previews are unchanged; try again shortly."});return;}
      const tabs=await api.tabs.query({url:`${CANVAS}/*`});
      if(ownEpoch!==epoch)return;
      const tab=tabs.find(t=>Number.isInteger(t.id)&&courseFromUrl(t.url));
      if(!tab){await save({...state,message:"Open one signed-in Canvas course tab in this Chrome profile, then click Check all again. No new check was run."});return;}
      const token=generation.get(tab.id),snapshots={},lastAttempt={...state.lastAttempt},lastBatchAttempt=now();
      const valid=()=>ownEpoch===epoch&&token===generation.get(tab.id);
      if(!valid())return;
      await save({snapshots:{},lastAttempt,lastBatchAttempt,batchInProgress:true,message:`Checking 0/${config.courseIds.length} courses… Nothing imported.`});
      try {
        for(const [index,courseId] of config.courseIds.entries()){
          if(!valid())throw new Error("TAB_CHANGED");
          if(!await api.permissions.contains({origins:ORIGINS}))throw new Error("PERMISSION_REMOVED");
          if(!valid())throw new Error("TAB_CHANGED");
          const current=await api.tabs.get(tab.id);
          if(!valid())throw new Error("TAB_CHANGED");
          if(!courseFromUrl(current?.url))throw new Error("TAB_CHANGED");
          const results=await api.scripting.executeScript({target:{tabId:tab.id},world:"ISOLATED",func:readCanvas,args:[{operation:"course",courseId,expectedUserId:config.accountId,expectedVersion:READER_VERSION}]});
          if(!valid())throw new Error("TAB_CHANGED");
          const result=results?.[0]?.result;
          if(!result?.ok)throw new Error(result?.code||"READ_FAILED");
          if(result.user?.id!==config.accountId)throw new Error("ACCOUNT_CHANGED");
          if(result.course?.id!==courseId)throw new Error("READ_FAILED");
          if(result.readerVersion!==READER_VERSION||api.runtime.getManifest().version!==READER_VERSION)throw new Error("VERSION_MISMATCH");
          snapshots[courseId]={...result,user:{id:result.user.id}};lastAttempt[courseId]=now();
          bundleFromSnapshots(config,snapshots,now());
          await save({snapshots:{},lastAttempt,lastBatchAttempt,batchInProgress:true,message:`Checking ${index+1}/${config.courseIds.length} courses… Nothing imported.`});
        }
        if(!valid())throw new Error("TAB_CHANGED");
        if(!await api.permissions.contains({origins:ORIGINS}))throw new Error("PERMISSION_REMOVED");
        if(!valid())throw new Error("TAB_CHANGED");
        await save({snapshots,lastAttempt,lastBatchAttempt,message:`All ${config.courseIds.length} courses checked. Review changes in Semester; nothing imported.`});
      }catch(error){
        if(ownEpoch!==epoch)return;
        if(["ACCOUNT_CHANGED","PERMISSION_REMOVED"].includes(error.message)){await disable("Canvas account or permission changed. Previews cleared; re-enable for the intended account.");return;}
        const reason=error.message==="LOGIN_REQUIRED"?"Canvas login expired. Sign in again.":error.message==="TAB_CHANGED"?"Canvas tab changed or closed. Keep it open during the check.":"One course could not be read. Check Canvas login and extension version.";
        await save({snapshots:{},lastAttempt,lastBatchAttempt,message:`${reason} Batch incomplete; no partial preview offered. Retry after one minute or use JSON.`});
      }
    }).catch(async()=>{if(ownEpoch===epoch)await save({snapshots:{},lastBatchAttempt:now(),message:"All-course check failed. Nothing imported. Retry after one minute or use JSON."});}).finally(async()=>{batchPending=false;await notify();});
    return queue;
  }
  async function check(tabId, url, token, ownEpoch) {
    if (ownEpoch !== epoch || token !== generation.get(tabId)) return;
    const config = await getConfig(), courseId = courseFromUrl(url);
    if (!validConfig(config) || !config.courseIds.includes(courseId)) return;
    if (!(await api.permissions.contains({origins:ORIGINS}))) {await disable("Site permission removed. Reload checks stopped.");return;}
    const state = await getState(), lastAttempt = {...state.lastAttempt};
    if(ownEpoch!==epoch||token!==generation.get(tabId))return;
    if (now() - (lastAttempt[courseId] || 0) < 60000) return;
    lastAttempt[courseId] = now();
    await save({...state,lastAttempt,message:`Checking course ${courseId}… Nothing is being imported.`});
    try {
      const current = await api.tabs.get(tabId);
      if(ownEpoch!==epoch||token!==generation.get(tabId))return;
      if (courseFromUrl(current.url) !== courseId) throw new Error("TAB_CHANGED");
      const results = await api.scripting.executeScript({target:{tabId},world:"ISOLATED",func:readCanvas,args:[{operation:"course",courseId,expectedUserId:config.accountId,expectedVersion:READER_VERSION}]});
      if (ownEpoch !== epoch || token !== generation.get(tabId)) return;
      const result = results?.[0]?.result;
      if (!result?.ok) throw new Error(result?.code || "INVALID_RESPONSE");
      if (result.readerVersion !== READER_VERSION || api.runtime.getManifest().version !== READER_VERSION) throw new Error("VERSION_MISMATCH");
      if (result.user?.id !== config.accountId) throw new Error("ACCOUNT_CHANGED");
      if (result.course?.id !== courseId) throw new Error("INVALID_RESPONSE");
      const snapshots = {...state.snapshots,[courseId]:{...result,user:{id:result.user.id}}};
      // Validate size before retaining data. Expired entries are pruned below.
      bundleFromSnapshots(config,snapshots,now());
      for (const [key,s] of Object.entries(snapshots)) if (now()-Date.parse(s.fetchedAt)>=MAX_AGE) delete snapshots[key];
      await save({snapshots,lastAttempt,lastBatchAttempt:state.lastBatchAttempt,message:`Course ${courseId} checked. Review changes in Semester; nothing imported.`});
    } catch (error) {
      if (ownEpoch !== epoch || token !== generation.get(tabId)) return;
      if (error.message === "ACCOUNT_CHANGED") {await disable("Canvas account changed. Previews cleared; re-enable for the intended account.");return;}
      // Never offer stale grades after a failed check / expired login.
      await save({snapshots:{},lastAttempt,lastBatchAttempt:state.lastBatchAttempt,message:error.message === "LOGIN_REQUIRED" ? "Canvas login expired. Sign in, then reload the course after one minute. Nothing imported." : `Canvas check failed (${["VERSION_MISMATCH","RATE_LIMITED","LIMIT","FORBIDDEN","NOT_STUDENT","TIMEOUT"].includes(error.message)?error.message:"READ_FAILED"}). Previews cleared; retry after one minute or use JSON.`});
    } finally {
      if(ownEpoch===epoch&&token!==generation.get(tabId)){
        const latest=await getState();
        await save({...latest,snapshots:{},message:"Canvas tab changed during the check. Previews cleared; reload the course after one minute or use JSON."});
      }
    }
  }
  function updated(tabId, change, tab) {
    if (change.status === "loading" || change.url) generation.set(tabId,(generation.get(tabId)||0)+1);
    if(batchPending)return;
    if (change.status !== "complete" || !courseFromUrl(tab.url)) return;
    const token = generation.get(tabId), ownEpoch = epoch;
    queue = queue.then(()=>check(tabId,tab.url,token,ownEpoch)).catch(()=>{});
  }
  return {enable,disable,inbox,checkAll,updated,idle:()=>queue,removed:tabId=>generation.set(tabId,(generation.get(tabId)||0)+1)};
}
