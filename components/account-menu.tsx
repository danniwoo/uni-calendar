"use client";
import {useEffect,useRef,useState} from "react";
import {UserRound,Users,LogOut,Download} from "lucide-react";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import type {AccountData} from "@/lib/account";
import type {CoursePlanData,PlanFriend} from "@/lib/course-plan";
import {backupText} from "@/lib/backup";
import type {Semester} from "@/lib/semester";

export const PROFILE_CHANGED="semester:profile-changed";
export function openProfileSettings(){window.dispatchEvent(new Event("semester:open-profile"));}
function download(text:string,name:string) {
  const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Draft={name:string;sharing:boolean;revision:number};
const draftOf=(data:AccountData):Draft=>({name:data.profile?.name??"",sharing:data.profile?.sharing??false,revision:data.profile?.revision??0});

export default function AccountMenu() {
  const [open,setOpen]=useState(false),[data,setData]=useState<AccountData|null>(null);
  const [draft,setDraft]=useState<Draft>({name:"",sharing:false,revision:0});
  const [error,setError]=useState(""),[loadError,setLoadError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false),[signIn,setSignIn]=useState(false);
  const [returnTo,setReturnTo]=useState("/");
  const baseline=useRef(JSON.stringify(draft)),dirty=useRef(false),request=useRef(0),active=useRef(false),identity=useRef<string|null>(null);
  dirty.current=JSON.stringify(draft)!==baseline.current;
  const changed=dirty.current,disabled=busy||!!loadError||!data;
  async function load(after?:string) {
    const version=++request.current;
    try {
      const response=await fetch(`/api/account${after?`?after=${encodeURIComponent(after)}`:""}`,{cache:"no-store"});
      const result=await response.json() as AccountData & {error?:string;signIn?:boolean};
      if(version!==request.current)return;
      if(!response.ok){setSignIn(!!result.signIn);if(result.signIn)setData(null);throw new Error(result.error||"Could not load your profile.");}
      const account=result as AccountData;
      if(!dirty.current||identity.current!==account.email){const next=draftOf(account);baseline.current=JSON.stringify(next);setDraft(next);}
      identity.current=account.email;setData(old=>after&&old?.email===account.email?{...account,blocked:[...old.blocked,...account.blocked.filter(f=>!old.blocked.some(o=>o.connectionId===f.connectionId))]}:account);setLoadError("");setSignIn(false);
    }catch(e){if(version===request.current)setLoadError(e instanceof Error?e.message:"Could not load your profile.");}
  }
  useEffect(()=>{
    const currentPath=()=>location.pathname+location.search+location.hash;
    setReturnTo(currentPath());void load();
    const refresh=()=>{if(!active.current)void load();};
    const show=()=>{setReturnTo(currentPath());setOpen(true);refresh();};
    const warn=(e:BeforeUnloadEvent)=>{if(dirty.current||active.current){e.preventDefault();e.returnValue="";}};
    window.addEventListener("focus",refresh);window.addEventListener(PROFILE_CHANGED,refresh);window.addEventListener("semester:open-profile",show);window.addEventListener("beforeunload",warn);
    return()=>{window.removeEventListener("focus",refresh);window.removeEventListener(PROFILE_CHANGED,refresh);window.removeEventListener("semester:open-profile",show);window.removeEventListener("beforeunload",warn);};
  },[]);
  function close() {
    if(busy)return;
    if(dirty.current&&!window.confirm("Discard the unsaved profile changes?"))return;
    if(data){const next=draftOf(data);baseline.current=JSON.stringify(next);setDraft(next);}
    setOpen(false);setError("");setNotice("");
  }
  async function update(body:unknown) {
    if(active.current||loadError)return false;
    active.current=true;setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/course-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json() as {message:string;error?:string};
      if(!response.ok)throw new Error(result.error||"Could not save. Your edits are still here.");
      setNotice(result.message);return true;
    }catch(e){setError(e instanceof Error?e.message:"Could not save.");return false;}
    finally{active.current=false;setBusy(false);}
  }
  async function unblock(friend:PlanFriend) {
    if(await update({action:"friend-action",friendId:friend.id,connectionId:friend.connectionId,revision:friend.revision,operation:"unblock"})) {
      await load();window.dispatchEvent(new Event(PROFILE_CHANGED));
    }
  }
  async function exportData(kind:"plan"|"semester") {
    if(active.current)return;active.current=true;setBusy(true);setError("");
    try {
      const response=await fetch(kind==="plan"?"/api/course-plan":"/api/semester",{cache:"no-store"});
      const result=await response.json() as {plans:CoursePlanData["plans"];semester:Semester|null;error?:string};if(!response.ok)throw new Error(result.error||"Could not export your data.");
      if(kind==="plan")download(JSON.stringify({format:"semester-course-plan",version:1,exportedAt:new Date().toISOString(),plans:result.plans},null,2),"semester-course-plan.json");
      else {if(!result.semester)throw new Error("There is no saved semester to export yet.");download(backupText(result.semester),"semester-saved-backup.json");}
      setNotice(kind==="plan"?"Course plan exported.":"Saved semester exported.");
    }catch(e){setError(e instanceof Error?e.message:"Could not export your data.");}
    finally{active.current=false;setBusy(false);}
  }
  const initials=data?.profile?.name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join("").toUpperCase();
  return <div className="account-menu">
    <button className="account-trigger" aria-label={`Profile & settings${data?.incoming?` · ${data.incoming} friend request${data.incoming===1?"":"s"}`:""}`} onClick={()=>{setReturnTo(location.pathname+location.search+location.hash);setOpen(true);void load();}}>
      <span className="account-avatar" aria-hidden="true">{initials||<UserRound size={16}/>}</span><span>Profile</span>{!!data?.incoming&&<span className="account-badge">{data.incoming}</span>}
    </button>
    <Sheet open={open} onOpenChange={value=>{if(!value)close();}}><SheetContent className="detail-panel account-panel">
      <SheetHeader><SheetTitle>Profile &amp; settings</SheetTitle><SheetDescription>Your Semester identity, sharing and account data.</SheetDescription></SheetHeader>
      <nav className="account-nav" aria-label="Account navigation"><a href="/plan">Course plan</a><a href="/plan?view=friends"><Users size={16}/>Friends{data?.incoming?` · ${data.incoming} request${data.incoming===1?"":"s"}`:""}</a></nav>
      {loadError&&<div className="notice error" role="alert">{loadError}{signIn?<a href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`} target="_top">Sign in with ChatGPT</a>:<button onClick={()=>load()} disabled={busy}>Retry loading</button>}</div>}
      {!data&&!loadError&&<p role="status">Loading your profile…</p>}
      {error&&<div className="notice error" role="alert">{error}<button disabled={busy} onClick={()=>load()}>Refresh saved profile</button></div>}
      {notice&&<p className="account-notice" role="status">{notice}</p>}
      {data&&<>
        <div className="account-identity"><span className="account-avatar" aria-hidden="true">{initials||<UserRound size={22}/>}</span><div><strong>{data.profile?.name||"Set up your profile"}</strong><span>Signed in as {data.email}</span></div></div>
        <form className="account-form" onSubmit={async e=>{e.preventDefault();const next={...draft,name:draft.name.trim(),revision:draft.revision+1};if(await update({action:"save-profile",...draft})){baseline.current=JSON.stringify(next);setDraft(next);await load();window.dispatchEvent(new Event(PROFILE_CHANGED));}}}>
          <fieldset disabled={disabled}><label>Display name<input value={draft.name} maxLength={60} required onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="A name your friends recognise"/></label>
            <label>Share my course plan with<select value={draft.sharing?"friends":"private"} onChange={e=>setDraft({...draft,sharing:e.target.value==="friends"})}><option value="private">Nobody</option><option value="friends">All accepted friends</option></select></label>
            <p>Applies to every year and semester, including future units. Final grades, WAM, assessments and personal events stay private.</p>
            <button className="primary" disabled={!changed||!draft.name.trim()}>{busy?"Saving…":"Save changes"}</button>
          </fieldset>
        </form>
        {draft.revision!==(data.profile?.revision??0)&&<div className="notice">Your saved profile changed in another tab. <button disabled={busy} onClick={()=>{const next=draftOf(data);baseline.current=JSON.stringify(next);setDraft(next);setError("");}}>Use saved profile</button></div>}
        <section className="account-section"><h3>Blocked users{data.blocked.length?` · ${data.blocked.length}${data.blockedNext?"+":""}`:""}</h3>{data.blocked.length?data.blocked.map(friend=><div className="account-blocked" key={friend.connectionId}><span>{friend.name}</span><button disabled={disabled} onClick={()=>unblock(friend)}>Unblock</button></div>):<p>No blocked users.</p>}<p>{data.blockedNext&&<button disabled={disabled} onClick={async()=>{setBusy(true);active.current=true;await load(data.blockedNext!);active.current=false;setBusy(false);}}>Load more blocked users</button>}</p><p>Unblocking allows a new friend request; it does not reconnect you.</p></section>
        <section className="account-section"><h3>Your data</h3><div className="account-exports"><button disabled={disabled} onClick={()=>exportData("plan")}><Download size={15}/>Export course plan</button><button disabled={disabled} onClick={()=>exportData("semester")}><Download size={15}/>Export saved semester</button></div><p>Exports include recorded results. The saved-semester backup omits your timetable subscription URL and any unsaved edits. Course-plan export is a separate snapshot without a restore option yet.</p></section>
        <a className="account-signout" href="/signout-with-chatgpt?return_to=%2F" target="_top"><LogOut size={16}/>Sign out</a>
      </>}
    </SheetContent></Sheet>
  </div>;
}
