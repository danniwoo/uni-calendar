"use client";
import {useEffect, useRef, useState} from "react";
import {CalendarDays, Plus, Users, LockKeyhole, ArrowRight} from "lucide-react";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import {creditSummary,wamSummary,wamExclusion,matchesFor,sameOffering,PLAN_STATUSES,STATUS_LABEL,type CoursePlanData,type PlanEntry,type PlanDraft,type PlanFriend,type SharedPlan,type PlanSession} from "@/lib/course-plan";
import {sydneyDate} from "@/lib/semester";
import AccountMenu,{openProfileSettings,PROFILE_CHANGED} from "./account-menu";
import {invitationCode,invitationLink,planningYear,type InvitePreview} from "@/lib/friend-invitation";

type Editor = {id:string|null;revision:number;draft:PlanDraft;initial:string};
type MutationResult = {message:string;inviteCode?:string;expiresAt?:string;invitePreview?:InvitePreview};
const period = (p:{year:number;session:PlanSession}) => `Semester ${p.session==="S1C"?1:2}, ${p.year}`;

export default function CoursePlan() {
  const thisYear=Number(sydneyDate(new Date()).slice(0,4));
  const [data,setData]=useState<CoursePlanData|null>(null);
  const [year,setYear]=useState(planningYear(sydneyDate(new Date()),null)),[tab,setTab]=useState<"plan"|"friends">("plan");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [loadError,setLoadError]=useState(""),[signIn,setSignIn]=useState(false),[notice,setNotice]=useState("");
  const [editor,setEditor]=useState<Editor|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [code,setCode]=useState(""),[connectOpen,setConnectOpen]=useState(false);
  const [preview,setPreview]=useState<{code:string;value:InvitePreview}|null>(null);
  const [inviteFromLink,setInviteFromLink]=useState<string|null>(null);
  const [signInPath,setSignInPath]=useState("/signin-with-chatgpt?return_to=%2Fplan");
  const [origin,setOrigin]=useState("");
  const [invite,setInvite]=useState<{code:string;expiresAt:string}|null>(null);
  const [friendFilter,setFriendFilter]=useState("all");
  const busyRef=useRef(false),dirtyRef=useRef(false),requestVersion=useRef(0);
  dirtyRef.current=!!editor&&JSON.stringify(editor.draft)!==editor.initial;

  async function refresh(initial=false) {
    const request=++requestVersion.current;
    if(initial)setLoading(true);
    try {
      const response=await fetch("/api/course-plan",{cache:"no-store"});
      const result=await response.json() as CoursePlanData & {error?:string;signIn?:boolean};
      if(request!==requestVersion.current)return;
      if(!response.ok){setSignIn(!!result.signIn);throw new Error(result.error||"Could not load course plans.");}
      setData(result);setLoadError("");setSignIn(false);

    } catch(e) {if(request===requestVersion.current)setLoadError(e instanceof Error?e.message:"Could not load course plans.");}
    finally {if(request===requestVersion.current)setLoading(false);}
  }
  useEffect(()=>{
    const readLocation=()=>{
      const url=new URL(location.href);setOrigin(url.origin);
      setSignInPath(`/signin-with-chatgpt?return_to=${encodeURIComponent(url.pathname+url.search+url.hash)}`);
      if(url.searchParams.get("view")==="friends")setTab("friends");
      const invitation=new URLSearchParams(url.hash.slice(1)).get("invite");
      if(invitation!==null){setTab("friends");setConnectOpen(true);setCode(invitation);setInviteFromLink(invitation);}
    };
    readLocation();window.addEventListener("hashchange",readLocation);window.addEventListener("popstate",readLocation);
    try{setYear(planningYear(sydneyDate(new Date()),localStorage.getItem("semester-plan-year")));}catch{}
    void refresh(true);
    return()=>{window.removeEventListener("hashchange",readLocation);window.removeEventListener("popstate",readLocation);};
  },[]);
  useEffect(()=>{
    if(!data||busy||loadError||inviteFromLink===null)return;
    const pending=inviteFromLink;setInviteFromLink(null);void checkInvite(pending);
  },[data,inviteFromLink,busy,loadError]);
  function chooseYear(value:number){setYear(value);try{localStorage.setItem("semester-plan-year",String(value));}catch{}}
  function chooseTab(value:"plan"|"friends") {
    setTab(value);const url=new URL(location.href);url.searchParams.set("view",value);history.replaceState(null,"",url.pathname+url.search+url.hash);
  }
  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>{if(dirtyRef.current||busyRef.current){e.preventDefault();e.returnValue="";}};
    const focus=()=>{if(!busyRef.current)void refresh();};
    window.addEventListener("beforeunload",warn);window.addEventListener("focus",focus);window.addEventListener(PROFILE_CHANGED,focus);
    return ()=>{window.removeEventListener("beforeunload",warn);window.removeEventListener("focus",focus);window.removeEventListener(PROFILE_CHANGED,focus);};
  },[]);
  async function mutate(body:unknown):Promise<MutationResult|null> {
    if(busyRef.current||loadError)return null;
    busyRef.current=true;setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/course-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json() as MutationResult & {error?:string};
      if(!response.ok)throw new Error(result.error||"Could not save. Your edits are still open.");
      setNotice(result.message);await refresh();return result;
    } catch(e) {setError(e instanceof Error?e.message:"Could not save. Your edits are still open.");return null;}
    finally {busyRef.current=false;setBusy(false);}
  }
  async function checkInvite(value:string) {
    setPreview(null);const normalized=invitationCode(value);
    if(!normalized){setError("Enter a full invitation link or code.");return;}
    const result=await mutate({action:"preview-invite",code:normalized});
    if(result?.invitePreview){setPreview({code:normalized,value:result.invitePreview});setNotice("");}
  }
  function clearInvitation() {
    setPreview(null);setCode("");const url=new URL(location.href);url.hash="";history.replaceState(null,"",url.pathname+url.search);setSignInPath(`/signin-with-chatgpt?return_to=${encodeURIComponent(url.pathname+url.search)}`);
  }
  function openEditor(entry?:PlanEntry|SharedPlan,session:PlanSession="S1C") {
    if(editor&&dirtyRef.current&&!window.confirm("Discard the unsaved unit edits?"))return;
    const draft:PlanDraft=entry?{university:"usyd",code:entry.code,name:entry.name,year:entry.year,session:entry.session,status:"id" in entry?entry.status:"planned",credits:entry.credits,finalMark:"id" in entry?entry.finalMark:null,finalGrade:"id" in entry?entry.finalGrade:null,wamExcluded:"id" in entry?entry.wamExcluded:false}:{university:"usyd",code:"",name:"",year,session,status:"planned",credits:null,finalMark:null,finalGrade:null,wamExcluded:false};
    setError("");setEditor({id:entry&&"id" in entry?entry.id:null,revision:entry&&"revision" in entry?entry.revision:0,draft,initial:JSON.stringify(draft)});
  }
  function closeEditor() {
    if(busy)return;
    if(editor&&JSON.stringify(editor.draft)!==editor.initial&&!window.confirm("Discard the unsaved unit edits?"))return;
    setEditor(null);setError("");
  }
  async function friendAction(friend:PlanFriend,operation:string) {
    if((operation==="block"||operation==="remove"&&friend.state==="accepted")&&!window.confirm(`${operation==="block"?"Block":"Remove"} ${friend.name}? You will no longer see each other's shared units.`))return;
    if(await mutate({action:"friend-action",friendId:friend.id,connectionId:friend.connectionId,revision:friend.revision,operation})){setPreview(null);window.dispatchEvent(new Event(PROFILE_CHANGED));}
  }
  async function copy(text:string,message:string) {
    try {await navigator.clipboard.writeText(text);setNotice(message);}
    catch {setError("Copy was unavailable. Select the displayed text and copy it manually.");}
  }
  function exportPlan() {
    if(!data)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:"semester-course-plan",version:1,exportedAt:new Date().toISOString(),plans:data.plans},null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download="semester-course-plan.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const disabled=busy||!!loadError;
  const selectedPlan=data?.plans.find(p=>p.id===selected);
  const years=Array.from(new Set([...Array.from({length:10},(_,i)=>thisYear-3+i),...data?.plans.map(p=>p.year)??[],year])).sort((a,b)=>a-b);
  const incoming=data?.friends.filter(f=>f.state==="incoming")??[];
  const friends=data?.friends.filter(f=>f.state==="accepted")??[];
  const sharedForYear=data?.sharedPlans.filter(p=>p.year===year&&(friendFilter==="all"||p.friendId===friendFilter))??[];
  const wam=wamSummary(data?.plans??[]);
  const patch=(value:Partial<PlanDraft>)=>setEditor(old=>old?{...old,draft:{...old.draft,...value}}:old);

  return <main className="course-page">
    <header className="course-header"><a className="wordmark" href="/"><CalendarDays aria-hidden="true"/> semester <small>USYD</small></a><div className="course-actions"><a href="/">Current semester <ArrowRight size={16}/></a><AccountMenu/></div></header>
    <div className="course-heading"><div><p className="eyebrow">LOOK AHEAD, TOGETHER</p><h1>Course plan</h1><p className="muted">Map out your semesters. Find friends taking the same units.</p></div><div className="course-actions"><button onClick={()=>refresh()} disabled={busy||loading}>Refresh</button><button onClick={exportPlan} disabled={!data||busy}>Export my plan</button></div></div>
    <nav className="course-tabs" aria-label="Course planning"><button aria-pressed={tab==="plan"} onClick={()=>chooseTab("plan")}>My plan</button><button aria-pressed={tab==="friends"} onClick={()=>chooseTab("friends")}><Users size={16}/> Friends{incoming.length?` · ${incoming.length} request${incoming.length===1?"":"s"}`:""}</button></nav>
    {notice&&<div className="course-notice" role="status">{notice}</div>}
    {error&&!editor&&<div className="notice error" role="alert">{error} <button onClick={()=>refresh()} disabled={busy}>Refresh records</button></div>}
    {loadError&&<div className="notice error" role="alert"><p>{loadError}</p>{signIn?<a href={signInPath} target="_top">Sign in with ChatGPT</a>:<button onClick={()=>refresh()} disabled={busy}>Retry loading</button>}</div>}
    {loading&&<p role="status">Loading your course plan…</p>}
    {data&&<>
      <div className="course-visibility">{data.profile?.sharing?<Users size={16}/>:<LockKeyhole size={16}/>}<span>{data.profile?.sharing?"Your unit plans are shared with all accepted friends.":"Your course plan is private."}</span><button onClick={openProfileSettings}>Sharing settings</button></div>
      <div className="course-year"><label>Year <select value={year} onChange={e=>chooseYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label><span className="muted">USYD · Semester 1 &amp; 2</span>{tab==="plan"&&<button className="primary" disabled={disabled} onClick={()=>openEditor()}><Plus size={16}/> Add unit</button>}</div>
      {tab==="plan"?<>
        <section className="course-wam" aria-label="WAM estimate">
          <div className="course-wam-main"><div><span className="course-wam-label">WAM estimate</span><strong className="course-wam-value">{wam.average===null?"—":wam.average.toFixed(2)}<small> / 100</small></strong></div><div><strong>All years · recorded final marks</strong><p>{wam.included?`${wam.included} unit attempt${wam.included===1?"":"s"} · ${wam.credits} credit points included`:"No eligible final marks recorded yet."}</p><span className="muted">Grades and WAM stay private.</span></div></div>
          <details><summary>Calculation &amp; included results{wam.excluded.length?` · ${wam.excluded.length} not included`:""}</summary><p>Sum of final mark × credit points, divided by included credit points. Numerical failures and repeated attempts count separately; blank marks are not zero. Grade labels are never converted into marks.</p><p>This is a standard WAM estimate for units you record in this plan. Exclude external credit, exchange, OLE units from 2025 and units outside your course. Faculty-specific weighting and CWAM are not applied. <a href="https://www.sydney.edu.au/students/weighted-average-mark.html" target="_blank" rel="noreferrer">USYD WAM guidance</a></p>
            {wam.excluded.map(p=><button key={p.id} disabled={disabled} onClick={()=>openEditor(data.plans.find(unit=>unit.id===p.id))}>{p.code} · {period(p)} — {p.reason}</button>)}
          </details>
        </section>
        <div className="course-semesters">{(["S1C","S2C"] as const).map(session=>{
          const units=data.plans.filter(p=>p.year===year&&p.session===session),credits=creditSummary(units,["planned","enrolled"]);
          return <section className="course-term" key={session} aria-label={period({year,session})}>
            <div className="course-term-heading"><div><h2>Semester {session==="S1C"?1:2}</h2><p className="muted">{credits.known} planned / enrolled cp{credits.unknown?` · ${credits.unknown} unit${credits.unknown===1?"":"s"} missing credits`:""}</p></div><button disabled={disabled} aria-label={`Add unit to Semester ${session==="S1C"?1:2}`} onClick={()=>openEditor(undefined,session)}><Plus size={16}/></button></div>
            {!units.length&&<div className="course-empty"><strong>A semester to shape.</strong><p>Add units you’re considering or planning to take.</p><button disabled={disabled} onClick={()=>openEditor(undefined,session)}>Add your first unit</button></div>}
            {units.map(unit=>{const matches=matchesFor(unit,data.sharedPlans);return <article className="course-unit" key={unit.id}>
              <div className="course-unit-top"><strong>{unit.code}</strong><span className={`course-status status-${unit.status}`}>{STATUS_LABEL[unit.status]}</span></div><h3>{unit.name}</h3>
              <p className="muted">{unit.credits===null?"Credits not entered":`${unit.credits} cp`}</p>
              {(unit.finalMark!==null||unit.finalGrade)&&<div className="course-final-result"><span>Final result · {unit.finalMark!==null?`${unit.finalMark} / 100`:"No numeric mark"}{unit.finalGrade?` · ${unit.finalGrade}`:""}</span>{wamExclusion(unit)&&<small>WAM: {wamExclusion(unit)}</small>}</div>}
              <div className="course-unit-actions"><button onClick={()=>{setSelected(unit.id);setError("");}}>{matches.length?`${matches.length} friend${matches.length===1?"":"s"} considering / taking this`:"See friends in this unit"}<ArrowRight size={14}/></button><button disabled={disabled} onClick={()=>openEditor(unit)}>Edit</button></div>
            </article>;})}
          </section>;
        })}</div>
        <p className="course-footnote">Plans, enrolment and completion are self-reported. Check official unit availability, prerequisites and degree requirements before enrolling. Credit totals exclude considering and completed entries.</p>
      </>:<>
        <div className="course-friends-heading"><div><h2>Your friends</h2><p className="muted">{friends.length} friend{friends.length===1?"":"s"}{incoming.length?` · ${incoming.length} pending request${incoming.length===1?"":"s"}`:""}</p></div><button className="primary" onClick={()=>setConnectOpen(!connectOpen)} aria-expanded={connectOpen}><Plus size={16}/>Add friend</button></div>
        {!data.profile&&<div className="course-onboarding"><div><strong>Introduce yourself</strong><p>Choose a name your friends recognise before sending or accepting requests.</p></div><button onClick={openProfileSettings}>Set up profile</button></div>}
        {data.friends.some(f=>f.state!=="blocked")?<section className="course-connections" aria-label="Friends and requests">{[...data.friends].filter(f=>f.state!=="blocked").sort((a,b)=>(a.state==="incoming"?0:a.state==="accepted"?1:2)-(b.state==="incoming"?0:b.state==="accepted"?1:2)||a.name.localeCompare(b.name)).map(friend=><div className="course-connection" key={friend.connectionId}><div><strong>{friend.name}</strong><span className="muted">{friend.state==="accepted"?"Friends":friend.state==="incoming"?"Wants to connect":"Request sent"}</span></div><div className="course-actions">
          {friend.state==="incoming"&&<button className="primary" disabled={disabled} onClick={()=>friendAction(friend,"accept")}>Accept</button>}
          <button disabled={disabled} onClick={()=>friendAction(friend,"remove")}>{friend.state==="incoming"?"Decline":friend.state==="outgoing"?"Cancel request":"Remove"}</button><button disabled={disabled} onClick={()=>friendAction(friend,"block")}>Block</button>
        </div></div>)}</section>:!connectOpen&&<div className="course-empty">Add a friend to start planning together.</div>}
        {connectOpen&&<div className="course-friend-setup">
          <section className="course-panel"><h2>Have an invitation?</h2><form onSubmit={async e=>{e.preventDefault();await checkInvite(code);}}><label htmlFor="friend-code">Friend’s link or code</label><div className="course-inline"><input id="friend-code" value={code} maxLength={2048} onChange={e=>{setCode(e.target.value);setPreview(null);}} autoComplete="off" required disabled={busy}/><button disabled={disabled||!code.trim()}>Check invitation</button></div></form>
            {preview&&<div className="course-invitation-preview"><strong>{preview.value.name}</strong>
              {preview.value.state==="available"?<><p>Send a friend request? Their units appear after they accept and choose to share.</p>{data.profile?<button className="primary" disabled={disabled} onClick={async()=>{if(await mutate({action:"request-friend",code:preview.code})){clearInvitation();window.dispatchEvent(new Event(PROFILE_CHANGED));}}}>Send request to {preview.value.name}</button>:<button onClick={openProfileSettings}>Set up profile to continue</button>}</>
              :<p>{preview.value.state==="self"?"This is your own invitation. Share it with a friend.":preview.value.state==="accepted"?"You are already friends.":preview.value.state==="outgoing"?"Your request has already been sent.":"They already sent you a request. Accept it in the list above."}</p>}
              <button disabled={busy} onClick={clearInvitation}>Dismiss invitation</button>
              <section className="course-panel"><h2>Invite a friend</h2><p className="muted">Share a link in your existing chat. You accept their request before sharing units.</p>
            {data.profile?<>
              <div className="course-inline"><button disabled={disabled} onClick={async()=>{const r=await mutate({action:"create-invite"});if(r?.inviteCode&&r.expiresAt)setInvite({code:r.inviteCode,expiresAt:r.expiresAt});}}>{invite?"Replace invitation link":"Create invitation link"}</button><button disabled={disabled} onClick={async()=>{if(await mutate({action:"revoke-invite"}))setInvite(null);}}>Revoke invitation</button></div>
              {invite&&origin&&<div className="course-invite"><label htmlFor="friend-invite">Your invitation link</label><div className="course-inline"><input id="friend-invite" value={invitationLink(origin,invite.code)} readOnly/><button onClick={()=>copy(invitationLink(origin,invite.code),"Invitation link copied.")}>Copy link</button></div><p className="muted">Expires {new Date(invite.expiresAt).toLocaleDateString("en-AU",{timeZone:"Australia/Sydney"})}.</p><details><summary>Use a code instead</summary><div className="course-inline"><input aria-label="Your invitation code" value={invite.code} readOnly/><button onClick={()=>copy(invite.code,"Invitation code copied.")}>Copy code</button></div></details></div>}
              <p className="muted">New invitations replace earlier links and codes. Revoking one leaves existing requests unchanged.</p>
            </>:<button onClick={openProfileSettings}>Set up profile to invite</button>}
            <p className="course-access-note">This trial website is invite-only. If your friend cannot open it, ask the website owner to grant access first. A friend link does not grant website access.</p>
          </section>
        </div>}
          </section>
        </div>}
        <section className="course-friend-plans"><div className="course-term-heading"><h2>Friends’ shared units · {year}</h2><label>Show <select value={friendFilter} onChange={e=>setFriendFilter(e.target.value)}><option value="all">All friends</option>{friends.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label></div>
          {!sharedForYear.length?<p className="course-empty">{friends.length?"No shared course plans for this year yet. A friend may have no units planned or have sharing switched off.":"Connect with a friend to see their shared course plan."}</p>:sharedForYear.map(p=>{const mine=data.plans.find(m=>sameOffering(m,p));return <article className="course-shared-row" key={`${p.friendId}-${p.code}-${p.year}-${p.session}`}><div><strong>{p.code} · {p.name}</strong><span>{p.friendName} · {STATUS_LABEL[p.status]} · {period(p)}</span><small className="muted">Updated {new Date(p.updatedAt).toLocaleDateString("en-AU",{timeZone:"Australia/Sydney"})} · self-reported</small></div>{mine?<span className="course-status">In your plan · {STATUS_LABEL[mine.status]}</span>:<button disabled={disabled} onClick={()=>openEditor(p)}>Add to my plan</button>}</article>;})}
        </section>
      </>}
    </>}
    <Sheet open={!!editor} onOpenChange={open=>{if(!open)closeEditor();}}><SheetContent className="detail-panel course-editor"><SheetHeader><SheetTitle>{editor?.id?"Edit planned unit":"Add a unit"}</SheetTitle><SheetDescription>Plan any year or move a unit to another semester. This does not change official enrolment.</SheetDescription></SheetHeader>
      {editor&&<form onSubmit={async e=>{e.preventDefault();const result=await mutate({action:"save-plan",id:editor.id,revision:editor.revision,plan:editor.draft});if(result){chooseYear(editor.draft.year);setEditor(null);}}}><fieldset disabled={busy}>
        <label>Unit code<input value={editor.draft.code} maxLength={8} placeholder="ISYS2120" onChange={e=>patch({code:e.target.value.toUpperCase()})} required/></label>
        <label>Unit name<input value={editor.draft.name} maxLength={160} onChange={e=>patch({name:e.target.value})} required/></label>
        <div className="course-form-pair"><label>Year<input type="number" min={2000} max={2100} value={editor.draft.year||""} onChange={e=>patch({year:Number(e.target.value)})} required/></label><label>Semester<select value={editor.draft.session} onChange={e=>patch({session:e.target.value as PlanSession})}><option value="S1C">Semester 1</option><option value="S2C">Semester 2</option></select></label></div>
        <div className="course-form-pair"><label>Status<select value={editor.draft.status} onChange={e=>patch({status:e.target.value as PlanDraft["status"]})}>{PLAN_STATUSES.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label><label>Credit points<input type="number" min={0} max={60} step={0.5} value={editor.draft.credits??""} placeholder="Unknown" onChange={e=>patch({credits:e.target.value===""?null:Number(e.target.value)})}/></label></div>
        <section className="course-result-editor" aria-label="Final result"><h3>Final result</h3><p>Enter the released result from Sydney Student.</p>
          <div className="course-form-pair"><label>Final mark / 100<input type="number" min={0} max={100} step="any" value={editor.draft.finalMark??""} placeholder="Not released" onChange={e=>patch({finalMark:e.target.value===""?null:Number(e.target.value)})}/></label><label>Final grade code<input value={editor.draft.finalGrade??""} maxLength={24} placeholder="e.g. DI, CR, SR" onChange={e=>patch({finalGrade:e.target.value||null})}/></label></div>
          <label className="course-wam-choice"><input type="checkbox" checked={editor.draft.wamExcluded} onChange={e=>patch({wamExcluded:e.target.checked})}/><span>Exclude this result from WAM</span></label><p>For external credit, exchange, OLE units from 2025 or units outside your course. Non-numeric and incomplete result codes are excluded automatically.</p>
          {(editor.draft.finalMark!==null||editor.draft.finalGrade)&&<p className="course-wam-preview">{wamExclusion(editor.draft)??"Included in your WAM estimate when saved."}</p>}
        </section>
        {error&&<div className="notice error" role="alert">{error} <button type="button" disabled={busy} onClick={()=>refresh()}>Refresh records</button></div>}{loadError&&<div className="notice error" role="alert">{loadError} <button type="button" disabled={busy} onClick={()=>refresh()}>Retry loading</button></div>}
        {editor.id&&data?.plans.find(p=>p.id===editor.id)?.revision!==editor.revision&&<div className="notice error">This unit changed or was removed elsewhere. Your unsaved edits are still shown. {data?.plans.some(p=>p.id===editor.id)&&<button type="button" disabled={busy} onClick={()=>openEditor(data.plans.find(p=>p.id===editor.id))}>Reload saved version</button>}</div>}
        <div className="course-actions"><button className="primary" disabled={disabled}>{busy?"Saving…":"Save unit"}</button><button type="button" disabled={busy} onClick={closeEditor}>Cancel</button></div>
        {editor.id&&<button type="button" className="course-delete" disabled={disabled} onClick={async()=>{if(window.confirm(`Remove ${editor.draft.code} from your course plan?`)&&await mutate({action:"delete-plan",id:editor.id,revision:editor.revision})){setEditor(null);setSelected(null);}}}>Remove from plan</button>}
      </fieldset></form>}
    </SheetContent></Sheet>
    <Sheet open={!!selectedPlan} onOpenChange={open=>{if(!open)setSelected(null);}}><SheetContent className="detail-panel course-editor"><SheetHeader><SheetTitle>{selectedPlan?.code} · Friends</SheetTitle><SheetDescription>{selectedPlan&&period(selectedPlan)} · Same unit and semester</SheetDescription></SheetHeader>
      {selectedPlan&&<><p>{selectedPlan.name}</p>{!data?.profile?.sharing&&<p className="course-private-note"><LockKeyhole size={16}/> Your course plan is private. Friends cannot see that you’re taking this unit.</p>}
        {matchesFor(selectedPlan,data?.sharedPlans??[]).length?matchesFor(selectedPlan,data?.sharedPlans??[]).map(p=><div className="course-match" key={p.friendId}><strong>{p.friendName}</strong><span>{STATUS_LABEL[p.status]}</span><small className="muted">Updated {new Date(p.updatedAt).toLocaleDateString("en-AU",{timeZone:"Australia/Sydney"})} · self-reported</small></div>):<p className="course-empty">No shared friend plans match yet. A missing plan does not mean your friends aren’t taking this unit.</p>}
        {selectedPlan.status!=="completed"&&<><h3>Plan together</h3><p className="muted">Start a conversation in your group chat. Tutorial preferences and allocation tracking are coming later.</p>
        <textarea aria-label="Coordination message" readOnly value={`I'm ${selectedPlan.status==="considering"?"considering":"planning to take"} ${selectedPlan.code} (${selectedPlan.name}) in ${period(selectedPlan)} at USYD. Would you like to take it together and choose the same tutorial group when options are available?`}/>
        <button onClick={()=>copy(`I'm ${selectedPlan.status==="considering"?"considering":"planning to take"} ${selectedPlan.code} (${selectedPlan.name}) in ${period(selectedPlan)} at USYD. Would you like to take it together and choose the same tutorial group when options are available?`,"Coordination message copied. Nothing was sent.")}>Copy message</button></>}
        <div className="course-actions"><button disabled={disabled} onClick={()=>{setSelected(null);openEditor(selectedPlan);}}>Edit unit / status</button></div>
      </>}
    </SheetContent></Sheet>
  </main>;
}
